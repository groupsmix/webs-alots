import { apiError, apiInternalError, apiNotFound, apiSuccess } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { requireTenant } from "@/lib/tenant";
import type { UserRole } from "@/lib/types/database";
import { paymentRefundSchema } from "@/lib/validations";

const ADMIN_ROLES: UserRole[] = ["super_admin", "clinic_admin"];

/**
 * Refunds above this threshold (in MAD) require a two-person approval
 * workflow. The initiating admin creates a refund_request; a second admin
 * must approve it before the payment status is actually updated.
 *
 * Issue #673 / Audit A169-02.
 */
const DUAL_CONTROL_THRESHOLD_MAD = 5_000;

/**
 * POST /api/booking/payment/refund
 *
 * Refund a completed payment (full or partial).
 * Auth: clinic_admin + super_admin only.
 *
 * For refunds ≤ 5 000 MAD: executes immediately (single-admin flow).
 * For refunds >  5 000 MAD: creates a pending refund_request requiring
 *   a second admin to approve at POST /api/booking/payment/refund/approve.
 *   Returns HTTP 202 with a `refund_request_id` for polling/notification.
 */
export const POST = withAuthValidation(
  paymentRefundSchema,
  async (body, request, { supabase, profile }) => {
    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;

    // F-A18-02: Fetch the payment with refunded_amount for optimistic
    // concurrency control. The DB CHECK constraint
    // (chk_refund_not_exceeds_amount) is the final safety net.
    const { data: payment, error: fetchError } = await supabase
      .from("payments")
      .select("id, status, amount, refunded_amount")
      .eq("id", body.paymentId)
      .eq("clinic_id", clinicId)
      .single();

    if (fetchError || !payment) {
      return apiNotFound("Payment not found");
    }

    if (payment.status !== "completed" && payment.status !== "partially_refunded") {
      return apiError("Only completed or partially refunded payments can be refunded");
    }

    const refundAmount = body.amount ?? payment.amount;

    if (typeof refundAmount !== "number" || !Number.isFinite(refundAmount) || refundAmount <= 0) {
      return apiError("Refund amount must be a positive number");
    }

    const alreadyRefunded = (payment.refunded_amount as number) ?? 0;
    const remaining = payment.amount - alreadyRefunded;

    if (refundAmount > remaining) {
      return apiError(
        `Refund amount (${refundAmount}) exceeds remaining refundable amount (${remaining})`,
      );
    }

    // ── Dual-control gate ─────────────────────────────────────────────────
    if (refundAmount > DUAL_CONTROL_THRESHOLD_MAD) {
      // Check for an existing pending request to prevent duplicates
      const { data: existing } = await supabase
        .from("refund_requests" as never)
        .select("id, status")
        .eq("payment_id", body.paymentId)
        .eq("status", "pending")
        .maybeSingle() as { data: { id: string; status: string } | null };

      if (existing) {
        return apiError(
          `A refund request for this payment is already pending approval (id: ${existing.id}). ` +
            "A second admin must approve it before proceeding.",
          409,
        );
      }

      // Create the pending approval request
      const { data: refundRequest, error: reqError } = await supabase
        .from("refund_requests" as never)
        .insert({
          clinic_id: clinicId,
          payment_id: body.paymentId,
          initiator_id: profile.id,
          amount: refundAmount,
          reason: body.reason ?? null,
        })
        .select("id")
        .single() as { data: { id: string } | null; error: unknown };

      if (reqError || !refundRequest) {
        logger.error("Failed to create refund_request", { context: "refund", clinicId, error: reqError });
        return apiInternalError("Failed to create refund approval request");
      }

      await logAuditEvent({
        supabase,
        action: "refund_request_initiated",
        type: "payment",
        actor: profile.id,
        clinicId,
        description:
          `Refund of ${refundAmount} MAD requested for payment ${body.paymentId} — ` +
          `exceeds ${DUAL_CONTROL_THRESHOLD_MAD} MAD threshold; awaiting second-admin approval. ` +
          `Request ID: ${refundRequest.id}`,
        metadata: {
          refund_request_id: refundRequest.id,
          payment_id: body.paymentId,
          amount: refundAmount,
          threshold: DUAL_CONTROL_THRESHOLD_MAD,
        },
      });

      return new Response(
        JSON.stringify({
          status: "pending_approval",
          message:
            `Refund of ${refundAmount} MAD exceeds the ${DUAL_CONTROL_THRESHOLD_MAD} MAD ` +
            "dual-control threshold. A second admin must approve this request.",
          refund_request_id: refundRequest.id,
        }),
        { status: 202, headers: { "Content-Type": "application/json" } },
      );
    }

    // ── Immediate execution (≤ 5 000 MAD) ────────────────────────────────
    const newRefundedTotal = alreadyRefunded + refundAmount;
    const isFullyRefunded = newRefundedTotal >= payment.amount;

    // F-A18-02: Optimistic concurrency — include refunded_amount in WHERE
    // so a concurrent refund that changed the value between our SELECT and
    // this UPDATE will find zero rows and fail cleanly.
    const { data: updated, error: updateError } = await supabase
      .from("payments")
      .update({
        status: isFullyRefunded ? "refunded" : "partially_refunded",
        refunded_amount: newRefundedTotal,
      })
      .eq("id", body.paymentId)
      .eq("clinic_id", clinicId)
      .eq("refunded_amount", alreadyRefunded)
      .select("id")
      .maybeSingle();

    if (updateError) {
      logger.error("Refund update failed", { context: "refund", clinicId, error: updateError });
      return apiInternalError("Failed to refund payment");
    }

    if (!updated) {
      return apiError("Concurrent refund detected — please retry", 409, "CONCURRENT_REFUND");
    }

    await logAuditEvent({
      supabase,
      action: "payment_refunded",
      type: "payment",
      actor: profile.id,
      clinicId,
      description: `Payment ${body.paymentId} refunded: ${refundAmount} MAD of ${payment.amount} MAD (single-admin, below threshold)`,
      metadata: {
        payment_id: body.paymentId,
        refund_amount: refundAmount,
        payment_amount: payment.amount,
        threshold: DUAL_CONTROL_THRESHOLD_MAD,
      },
    });

    return apiSuccess({ status: "refunded", message: "Payment refunded" });
  },
  ADMIN_ROLES,
);
