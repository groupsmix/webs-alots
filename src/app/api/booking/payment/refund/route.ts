// Node.js runtime required — uses crypto/file processing.
export const runtime = "nodejs";

import { apiError, apiInternalError, apiNotFound, apiSuccess } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { requireTenant } from "@/lib/tenant";
import type { UserRole } from "@/lib/types/database";
import { paymentRefundSchema } from "@/lib/validations";
const ADMIN_ROLES: UserRole[] = ["super_admin", "clinic_admin"];

/**
 * POST /api/booking/payment/refund
 *
 * Refund a completed payment (full or partial).
 * Auth: clinic_admin + super_admin only (ADMIN_ROLES).
 * A169-02: For refunds >5 000 MAD consider adding a two-person approval
 * workflow (e.g. a separate `refund_approvals` table requiring a second
 * admin to confirm before the refund executes).
 */
export const POST = withAuthValidation(
  paymentRefundSchema,
  async (body, request, { supabase }) => {
    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;

    // F-A18-02: Fetch the payment with refunded_amount for optimistic
    // concurrency control. The DB CHECK constraint
    // (chk_refund_not_exceeds_amount) is the final safety net, but
    // application-level validation prevents wasted work and clearer errors.
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

    // Validate refund amount
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

    const newRefundedTotal = alreadyRefunded + refundAmount;
    const isFullyRefunded = newRefundedTotal >= payment.amount;

    // F-A18-02: Optimistic concurrency — include refunded_amount in the
    // WHERE clause so a concurrent refund that changed the value between
    // our SELECT and this UPDATE will find zero rows and fail cleanly.
    // The DB-level CHECK (chk_refund_not_exceeds_amount) is the final
    // safety net if this CAS guard is somehow bypassed.
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
      clinicId,
      description: `Payment ${body.paymentId} refunded: ${refundAmount} of ${payment.amount}`,
    });

    return apiSuccess({ status: "refunded", message: "Payment refunded" });
  },
  ADMIN_ROLES,
);
