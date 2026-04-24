import { apiError, apiForbidden, apiInternalError, apiNotFound, apiSuccess } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { STAFF_ROLES } from "@/lib/auth-roles";
import { logger } from "@/lib/logger";
import { dispatchNotification } from "@/lib/notifications";
import type { TemplateVariables } from "@/lib/notifications";
import { requireTenantWithConfig } from "@/lib/tenant";
import { clinicDateTime } from "@/lib/timezone";
import { APPOINTMENT_STATUS } from "@/lib/types/database";
import type { UserRole } from "@/lib/types/database";
import { bookingCancelSchema } from "@/lib/validations";
import { withAuth } from "@/lib/with-auth";

const CANCEL_ROLES: UserRole[] = [...STAFF_ROLES, "patient"];
/**
 * POST /api/booking/cancel
 *
 * Cancel an appointment if within the cancellation window.
 */
export const POST = withAuthValidation(bookingCancelSchema, async (body, request, { supabase, profile }) => {

    const { tenant, config: tenantConfig } = await requireTenantWithConfig();
    const clinicId = tenant.clinicId;

    // Fetch the appointment (include patient_id for ownership check)
    const { data: appt, error: fetchError } = await supabase
      .from("appointments")
      .select("id, patient_id, doctor_id, service_id, appointment_date, start_time, status")
      .eq("id", body.appointmentId)
      .eq("clinic_id", clinicId)
      .single();

    if (fetchError || !appt) {
      return apiNotFound("Appointment not found");
    }

    // Ownership check: patients can only cancel their OWN appointments
    if (profile.role === "patient" && appt.patient_id !== profile.id) {
      return apiForbidden("Forbidden");
    }

    if (appt.status === APPOINTMENT_STATUS.CANCELLED || appt.status === APPOINTMENT_STATUS.COMPLETED || appt.status === APPOINTMENT_STATUS.RESCHEDULED) {
      return apiError("Appointment cannot be cancelled in its current state");
    }

    // Check cancellation window (timezone-aware)
    if (!appt.appointment_date || !appt.start_time) {
      return apiError("Appointment is missing date or time information");
    }

    const appointmentDateTime = clinicDateTime(appt.appointment_date, appt.start_time, tenantConfig.timezone);
    const hoursUntilAppt = (appointmentDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
    const cancellationWindowHours = tenantConfig.booking.cancellationHours;

    if (hoursUntilAppt < cancellationWindowHours) {
      return apiError(`Cancellations must be made at least ${cancellationWindowHours} hours before the appointment`);
    }

    // Cancel the appointment
    const { error: updateError } = await supabase
      .from("appointments")
      .update({
        status: APPOINTMENT_STATUS.CANCELLED,
        cancelled_at: new Date().toISOString(),
        cancellation_reason: body.reason ?? "Cancelled by patient",
      })
      .eq("id", body.appointmentId);

    if (updateError) {
      return apiInternalError("Failed to cancel appointment");
    }

    // RACE-02: Promote the first waiting-list entry for the freed slot
    // using the DB function with advisory locking to prevent concurrent
    // cancellations from promoting the same entry.
     
    await (supabase.rpc as (...args: unknown[]) => ReturnType<typeof supabase.rpc>)(
      "promote_waiting_list_entry", {
        p_clinic_id: clinicId,
        p_doctor_id: appt.doctor_id,
        p_preferred_date: appt.appointment_date,
      });

    await logAuditEvent({
      supabase,
      action: "appointment.cancelled",
      type: "booking",
      actor: profile.id,
      clinicId: profile.clinic_id ?? clinicId,
      description: `Appointment ${body.appointmentId} cancelled. Reason: ${body.reason ?? "Cancelled by patient"}`,
    });

    // ── Dispatch cancellation notifications (fire-and-forget) ──────
    // Notification failure must NOT affect the cancellation outcome.
    try {
      // Fetch doctor and service names for notification variables
      const [doctorResult, serviceResult, patientResult] = await Promise.all([
        supabase.from("users").select("name").eq("id", appt.doctor_id).single(),
        appt.service_id
          ? supabase.from("services").select("name").eq("id", appt.service_id).single()
          : Promise.resolve({ data: null }),
        supabase.from("users").select("name").eq("id", appt.patient_id).single(),
      ]);

      const notifVars: TemplateVariables = {
        patient_name: patientResult.data?.name ?? "Patient",
        doctor_name: doctorResult.data?.name ?? "Doctor",
        clinic_name: tenant.clinicName,
        service_name: serviceResult.data?.name ?? "Consultation",
        date: appt.appointment_date ?? "",
        time: appt.start_time ?? "",
        cancellation_reason: body.reason ?? "Cancelled by patient",
      };

      // cancellation → patient, doctor, receptionist
      Promise.allSettled([
        dispatchNotification("cancellation", notifVars, appt.patient_id, ["in_app", "email", "whatsapp"]),
        dispatchNotification("cancellation", notifVars, appt.doctor_id, ["in_app"]),
      ]).catch((err) => {
        logger.warn("Cancellation notification dispatch failed", { context: "booking/cancel", error: err });
      });
    } catch (err) {
      logger.warn("Failed to prepare cancellation notifications", { context: "booking/cancel", error: err });
    }

    return apiSuccess({ status: APPOINTMENT_STATUS.CANCELLED, message: "Appointment cancelled successfully" });
}, CANCEL_ROLES);

/**
 * GET /api/booking/cancel?appointmentId=...
 *
 * Check if an appointment can be cancelled.
 */
export const GET = withAuth(async (request, { supabase, profile }) => {
  const appointmentId = request.nextUrl.searchParams.get("appointmentId");

  if (!appointmentId) {
    return apiError("appointmentId is required");
  }

  const { tenant, config: tenantCfg } = await requireTenantWithConfig();

  const { data: appt, error } = await supabase
    .from("appointments")
    .select("id, patient_id, appointment_date, start_time, status")
    .eq("id", appointmentId)
    .eq("clinic_id", tenant.clinicId)
    .single();

  if (error || !appt) {
    return apiSuccess({ canCancel: false, reason: "Appointment not found" });
  }

  // Ownership check: patients can only check cancellability of their OWN appointments
  if (profile.role === "patient" && appt.patient_id !== profile.id) {
    return apiSuccess({ canCancel: false, reason: "Appointment not found" });
  }

  if (appt.status === APPOINTMENT_STATUS.CANCELLED || appt.status === APPOINTMENT_STATUS.COMPLETED || appt.status === APPOINTMENT_STATUS.RESCHEDULED) {
    return apiSuccess({
      canCancel: false,
      reason: "Appointment cannot be cancelled in its current state",
    });
  }

  if (!appt.appointment_date || !appt.start_time) {
    return apiSuccess({
      canCancel: false,
      reason: "Appointment is missing date or time information",
    });
  }

  const appointmentDateTime = clinicDateTime(appt.appointment_date, appt.start_time, tenantCfg.timezone);
  const hoursUntilAppt = (appointmentDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
  const cancellationWindowHours = tenantCfg.booking.cancellationHours;

  if (hoursUntilAppt < cancellationWindowHours) {
    return apiSuccess({
      canCancel: false,
      reason: `Cancellations must be made at least ${cancellationWindowHours} hours before the appointment`,
      hoursRemaining: Math.max(0, hoursUntilAppt),
    });
  }

  return apiSuccess({ canCancel: true, hoursRemaining: hoursUntilAppt });
}, CANCEL_ROLES);
