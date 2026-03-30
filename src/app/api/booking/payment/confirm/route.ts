import { logAuditEvent } from "@/lib/audit-log";
import { requireTenant } from "@/lib/tenant";
import { APPOINTMENT_STATUS } from "@/lib/types/database";
import { STAFF_ROLES } from "@/lib/auth-roles";
import { paymentConfirmSchema } from "@/lib/validations";
import { withAuthValidation } from "@/lib/api-validate";
import { apiError, apiInternalError, apiNotFound, apiSuccess } from "@/lib/api-response";
/**
 * POST /api/booking/payment/confirm
 *
 * Confirm a pending payment.
 */
export const POST = withAuthValidation(paymentConfirmSchema, async (body, request, { supabase }) => {

    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;

    // Fetch the payment
    const { data: payment, error: fetchError } = await supabase
      .from("payments")
      .select("id, status, appointment_id")
      .eq("id", body.paymentId)
      .eq("clinic_id", clinicId)
      .single();

    if (fetchError || !payment) {
      return apiNotFound("Payment not found");
    }

    if (payment.status !== "pending") {
      return apiError("Payment is not in pending state");
    }

    // Mark payment as completed
    const { error: updateError } = await supabase
      .from("payments")
      .update({ status: "completed" })
      .eq("id", body.paymentId);

    if (updateError) {
      void updateError;
      return apiInternalError("Failed to confirm payment");
    }

    // Also confirm the associated appointment if it is still scheduled
    if (payment.appointment_id) {
      await supabase
        .from("appointments")
        .update({ status: APPOINTMENT_STATUS.CONFIRMED })
        .eq("id", payment.appointment_id)
        .in("status", [APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.SCHEDULED]);
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
