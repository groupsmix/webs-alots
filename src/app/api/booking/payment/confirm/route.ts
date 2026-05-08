import { apiError, apiInternalError, apiNotFound, apiSuccess } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { STAFF_ROLES } from "@/lib/auth-roles";
import { requireTenant } from "@/lib/tenant";
import { paymentConfirmSchema } from "@/lib/validations";

/**
 * POST /api/booking/payment/confirm
 *
 * A18-02: Atomically confirm a payment AND the associated appointment.
 *
 * The previous implementation ran two sequential UPDATE statements.
 * If the payment update succeeded but the appointment update failed,
 * the database would be left in a divergent state: payment=completed
 * but appointment=pending.
 *
 * This version calls the `confirm_payment_and_appointment` RPC which
 * wraps both mutations in a single transaction with SELECT FOR UPDATE
 * to prevent concurrent double-confirms.
 */
export const POST = withAuthValidation(paymentConfirmSchema, async (body, request, { supabase, profile }) => {

    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;

    // A18-02: Use the atomic RPC instead of two sequential UPDATEs.
    // The RPC wraps both mutations in a single transaction with
    // SELECT FOR UPDATE on the payment row.
    type ConfirmResult = {
      ok: boolean;
      payment_id?: string;
      appointment_id?: string | null;
      error?: string;
      code?: string;
    };

    const { data: rpcResult, error: rpcError } = await (supabase.rpc as (
      fn: "confirm_payment_and_appointment",
      args: { p_payment_id: string; p_clinic_id: string; p_confirmed_by: string | null }
    ) => ReturnType<typeof supabase.rpc>)(
      "confirm_payment_and_appointment",
      {
        p_payment_id: body.paymentId,
        p_clinic_id: clinicId,
        p_confirmed_by: profile.id,
      }
    );

    if (rpcError) {
      logger.error("confirm_payment_and_appointment RPC failed", {
        context: "booking/payment/confirm",
        paymentId: body.paymentId,
        clinicId,
        error: rpcError,
      });
      return apiInternalError("Failed to confirm payment");
    }

    const result = rpcResult as ConfirmResult | null;

    if (!result?.ok) {
      const code = result?.code;
      if (code === "NOT_FOUND") return apiNotFound("Payment not found");
      if (code === "WRONG_STATE") return apiError("Payment is not in pending state", 409);
      return apiInternalError("Failed to confirm payment");
    }

    await logAuditEvent({
      supabase,
      action: "payment_confirmed",
      type: "payment",
      clinicId,
      description: `Payment ${body.paymentId} confirmed`,
    });

    return apiSuccess({ status: "confirmed", message: "Payment confirmed" });
}, STAFF_ROLES);
