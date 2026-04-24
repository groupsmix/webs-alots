import { apiError, apiInternalError, apiNotFound, apiSuccess } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { STAFF_ROLES } from "@/lib/auth-roles";
import { findOrCreatePatient } from "@/lib/find-or-create-patient";
import { requireTenant } from "@/lib/tenant";
import { paymentInitiateSchema } from "@/lib/validations";
/**
 * POST /api/booking/payment/initiate
 *
 * Initiate a payment for an appointment.
 */
export const POST = withAuthValidation(paymentInitiateSchema, async (body, request, { supabase }) => {

    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;

    // Verify the appointment exists
    const { data: appt, error: apptError } = await supabase
      .from("appointments")
      .select("id")
      .eq("id", body.appointmentId)
      .eq("clinic_id", clinicId)
      .single();

    if (apptError || !appt) {
      return apiNotFound("Appointment not found");
    }

    // Check for existing active payment on this appointment
    const { data: existingPayment } = await supabase
      .from("payments")
      .select("id")
      .eq("appointment_id", body.appointmentId)
      .eq("clinic_id", clinicId)
      .not("status", "in", '("refunded","failed")')
      .limit(1)
      .single();

    if (existingPayment) {
      return apiError("A payment already exists for this appointment");
    }

    // Find or create patient using shared utility (prefers phone-based lookup
    // over name-based to avoid assigning payments to the wrong patient).
    const patientId = await findOrCreatePatient(
      supabase, clinicId, body.patientId, body.patientName,
    );
    if (!patientId) {
      return apiInternalError("Failed to resolve patient");
    }

    const method = body.method ?? "online";
    const gatewaySessionId = method === "online" ? crypto.randomUUID() : null;

    const { data: payment, error: insertError } = await supabase
      .from("payments")
      .insert({
        clinic_id: clinicId,
        appointment_id: body.appointmentId,
        patient_id: patientId,
        amount: body.amount,
        method,
        status: "pending",
        payment_type: body.paymentType,
        gateway_session_id: gatewaySessionId,
        refunded_amount: 0,
      })
      .select("id")
      .single();

    if (insertError || !payment) {
      // Handle unique constraint violation (duplicate active payment)
      if (insertError?.code === "23505") {
        return apiError("A payment already exists for this appointment", 409);
      }
      void insertError;
      return apiInternalError("Failed to initiate payment");
    }

    await logAuditEvent({
      supabase,
      action: "payment_initiated",
      type: "payment",
      clinicId,
      description: `Payment initiated: ${body.paymentType} ${body.amount} via ${method} for appointment ${body.appointmentId}`,
    });

    return apiSuccess({
      status: "initiated",
      message: "Payment initiated",
      paymentId: payment.id,
      gatewaySessionId,
    });
}, STAFF_ROLES);
