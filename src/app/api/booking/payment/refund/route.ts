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
 * A18-03: Race-safe payment refund using the process_payment_refund RPC.
 *
 * The previous implementation fetched refunded_amount, computed the new total,
 * then ran an UPDATE — a TOCTOU race. Two concurrent refund requests for the
 * same payment could both read refunded_amount=0 and both commit, causing a
 * double-refund exceeding the original payment amount.
 *
 * The RPC uses SELECT FOR UPDATE to lock the payment row before reading
 * refunded_amount, ensuring only one refund proceeds at a time.
 */
export const POST = withAuthValidation(paymentRefundSchema, async (body, request, { supabase }) => {

    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;

    // A18-03: Use the race-safe RPC instead of read-compute-write.
    type RefundResult = {
      ok: boolean;
      payment_id?: string;
      refund_amount?: number;
      new_total?: number;
      new_status?: string;
      error?: string;
      code?: string;
    };

    const { data: rpcResult, error: rpcError } = await (supabase.rpc as (
      fn: "process_payment_refund",
      args: { p_payment_id: string; p_clinic_id: string; p_amount: number | null }
    ) => ReturnType<typeof supabase.rpc>)(
      "process_payment_refund",
      {
        p_payment_id: body.paymentId,
        p_clinic_id: clinicId,
        p_amount: body.amount ?? null,
      }
    );

    if (rpcError) {
      logger.error("process_payment_refund RPC failed", {
        context: "booking/payment/refund",
        paymentId: body.paymentId,
        clinicId,
        error: rpcError,
      });
      return apiInternalError("Failed to process refund");
    }

    const result = rpcResult as RefundResult | null;

    if (!result?.ok) {
      const code = result?.code;
      if (code === "NOT_FOUND") return apiNotFound("Payment not found");
      if (code === "WRONG_STATE") return apiError("Only completed or partially refunded payments can be refunded", 409);
      if (code === "INVALID_AMOUNT") return apiError("Refund amount must be a positive number", 400);
      if (code === "EXCEEDS_REMAINING") return apiError(result?.error ?? "Refund exceeds remaining amount", 400);
      return apiInternalError("Failed to process refund");
    }

    await logAuditEvent({
      supabase,
      action: "payment_refunded",
      type: "payment",
      clinicId,
      description: `Payment ${body.paymentId} refunded: ${result.refund_amount} (total refunded: ${result.new_total})`,
    });

    return apiSuccess({
      status: result.new_status,
      message: "Payment refunded",
      refund_amount: result.refund_amount,
    });
}, ADMIN_ROLES);
