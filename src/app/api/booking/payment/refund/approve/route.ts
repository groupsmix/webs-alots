import { z } from "zod";
import { apiError, apiInternalError, apiNotFound, apiSuccess } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { requireTenant } from "@/lib/tenant";
import type { UserRole } from "@/lib/types/database";

const ADMIN_ROLES: UserRole[] = ["super_admin", "clinic_admin"];

const approveRefundSchema = z.object({
  refundRequestId: z.string().uuid("refundRequestId must be a valid UUID"),
  action: z.enum(["approve", "reject"]),
  rejectionReason: z.string().min(1).max(500).optional(),
});

/**
 * POST /api/booking/payment/refund/approve
 *
 * Second-admin approval or rejection of a pending refund_request.
 *
 * - The approver MUST be a different user than the initiator.
 * - On approval: executes the actual payment refund atomically.
 * - On rejection: marks the request as rejected; initiator may re-initiate.
 *
 * Auth: clinic_admin + super_admin.
 * Issue #673 / Audit A169-02.
 */
export const POST = withAuthValidation(
  approveRefundSchema,
  async (body, request, { supabase, profile }) => {
    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;

    // Fetch the pending request (RLS ensures it belongs to this clinic)
    type RefundRequestRow = {
      id: string;
      clinic_id: string;
      payment_id: string;
      initiator_id: string;
      amount: number;
      status: string;
    };
    const { data: refundReq, error: fetchErr } = await supabase
      .from("refund_requests" as never)
      .select("id, clinic_id, payment_id, initiator_id, amount, status")
      .eq("id", body.refundRequestId)
      .eq("clinic_id", clinicId)
      .single() as { data: RefundRequestRow | null; error: unknown };

    if (fetchErr || !refundReq) {
      return apiNotFound("Refund request not found");
    }

    if (refundReq.status !== "pending") {
      return apiError(`Refund request is already ${refundReq.status} — cannot ${body.action}`);
    }

    // Enforce dual-control: approver must differ from initiator
    if (profile.id === refundReq.initiator_id) {
      return apiError(
        "Dual-control violation: the approver must be a different admin than the initiator.",
        403,
      );
    }

    // ── Rejection path ──────────────────────────────────────────────────
    if (body.action === "reject") {
      const { error: rejectErr } = await supabase
        .from("refund_requests" as never)
        .update({
          status: "rejected",
          approver_id: profile.id,
          rejection_reason: body.rejectionReason ?? "No reason provided",
          approved_at: new Date().toISOString(),
        })
        .eq("id", body.refundRequestId);

      if (rejectErr) {
        logger.error("Failed to reject refund request", { context: "refund/approve", clinicId, error: rejectErr });
        return apiInternalError("Failed to reject refund request");
      }

      await logAuditEvent({
        supabase,
        action: "refund_request_rejected",
        type: "payment",
        actor: profile.id,
        clinicId,
        description:
          `Refund request ${body.refundRequestId} rejected by ${profile.id}. ` +
          `Reason: ${body.rejectionReason ?? "none"}`,
        metadata: {
          refund_request_id: body.refundRequestId,
          payment_id: refundReq.payment_id,
          amount: refundReq.amount,
          rejection_reason: body.rejectionReason,
        },
      });

      return apiSuccess({ status: "rejected", message: "Refund request rejected" });
    }

    // ── Approval + execution path ────────────────────────────────────────
    // Fetch the payment to apply the refund with optimistic concurrency
    const { data: payment, error: payFetchErr } = await supabase
      .from("payments")
      .select("id, status, amount, refunded_amount")
      .eq("id", refundReq.payment_id)
      .eq("clinic_id", clinicId)
      .single();

    if (payFetchErr || !payment) {
      return apiNotFound("Payment no longer exists");
    }

    if (payment.status !== "completed" && payment.status !== "partially_refunded") {
      return apiError("Payment is no longer in a refundable state");
    }

    const alreadyRefunded = (payment.refunded_amount as number) ?? 0;
    const remaining = payment.amount - alreadyRefunded;

    if (refundReq.amount > remaining) {
      return apiError(
        `Refund amount (${refundReq.amount}) exceeds remaining refundable amount (${remaining})`,
      );
    }

    const newRefundedTotal = alreadyRefunded + refundReq.amount;
    const isFullyRefunded = newRefundedTotal >= payment.amount;

    // Execute the refund (optimistic concurrency)
    const { data: updated, error: updateErr } = await supabase
      .from("payments")
      .update({
        status: isFullyRefunded ? "refunded" : "partially_refunded",
        refunded_amount: newRefundedTotal,
      })
      .eq("id", refundReq.payment_id)
      .eq("clinic_id", clinicId)
      .eq("refunded_amount", alreadyRefunded)
      .select("id")
      .maybeSingle();

    if (updateErr) {
      logger.error("Approved refund execution failed", { context: "refund/approve", clinicId, error: updateErr });
      return apiInternalError("Failed to execute approved refund");
    }

    if (!updated) {
      return apiError("Concurrent refund detected — please retry", 409, "CONCURRENT_REFUND");
    }

    // Mark the request as executed
    await supabase
      .from("refund_requests" as never)
      .update({
        status: "executed",
        approver_id: profile.id,
        approved_at: new Date().toISOString(),
        executed_at: new Date().toISOString(),
        executed_by: profile.id,
      })
      .eq("id", body.refundRequestId);

    await logAuditEvent({
      supabase,
      action: "refund_request_approved_and_executed",
      type: "payment",
      actor: profile.id,
      clinicId,
      description:
        `Refund request ${body.refundRequestId} approved and executed by ${profile.id}. ` +
        `Amount: ${refundReq.amount} MAD refunded from payment ${refundReq.payment_id}.`,
      metadata: {
        refund_request_id: body.refundRequestId,
        payment_id: refundReq.payment_id,
        amount: refundReq.amount,
        approver_id: profile.id,
      },
    });

    return apiSuccess({
      status: "executed",
      message: `Refund of ${refundReq.amount} MAD approved and executed`,
    });
  },
  ADMIN_ROLES,
);
