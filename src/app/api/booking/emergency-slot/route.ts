import { withAuth } from "@/lib/with-auth";
import { requireTenant } from "@/lib/tenant";
import { findOrCreatePatient } from "@/lib/find-or-create-patient";
import { APPOINTMENT_STATUS, BOOKING_SOURCE } from "@/lib/types/database";
import { logAuditEvent } from "@/lib/audit-log";
import { computeEndTime } from "@/lib/timezone";
import { STAFF_ROLES } from "@/lib/auth-roles";
import { logger } from "@/lib/logger";
import { emergencySlotSchema } from "@/lib/validations";
import { withAuthValidation } from "@/lib/api-validate";
import { apiError, apiInternalError, apiNotFound, apiSuccess } from "@/lib/api-response";
/**
 * POST /api/booking/emergency-slot
 *
 * Create an emergency slot (doctor only) or book an existing one.
 */
export const POST = withAuthValidation(emergencySlotSchema, async (body, request, { supabase }) => {

    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;

    if (body.action === "create") {

      // Input length validation to prevent DoS via oversized payloads
      if (body.reason && body.reason.length > 1000) {
        return apiError("Reason exceeds maximum allowed length");
      }

      // Verify doctor exists
      const { data: doctor } = await supabase
        .from("users")
        .select("id")
        .eq("id", body.doctorId)
        .eq("clinic_id", clinicId)
        .eq("role", "doctor")
        .single();

      if (!doctor) {
        return apiNotFound("Doctor not found");
      }

      // Calculate end time with midnight overflow guard
      const { endTime, overflows } = computeEndTime(body.startTime, body.durationMin);
      if (overflows) {
        return apiError("Emergency slot would extend past midnight. Please choose an earlier time or shorter duration.");
      }

      const { data: slot, error: insertError } = await supabase
        .from("emergency_slots")
        .insert({
          clinic_id: clinicId,
          doctor_id: body.doctorId,
          slot_date: body.date,
          start_time: body.startTime,
          end_time: endTime,
          reason: body.reason ?? null,
          is_booked: false,
        })
        .select("id")
        .single();

      if (insertError || !slot) {
        return apiInternalError(insertError?.message ?? "Failed to create emergency slot");
      }

      return apiSuccess({
        status: "created",
        message: "Emergency slot created",
        slotId: slot.id,
      });
    }

    if (body.action === "book") {
      if (!body.slotId || !body.patientId || !body.patientName) {
        return apiError("slotId, patientId, and patientName are required");
      }

      // Input length validation to prevent DoS via oversized payloads
      if (body.patientName.length > 200 || (body.patientPhone && body.patientPhone.length > 30)) {
        return apiError("Input exceeds maximum allowed length");
      }

      // ATOMIC: Claim the slot only if it is currently unbooked.
      // This eliminates the TOCTOU race condition by combining check + update.
      const { data: claimedSlot, error: claimError } = await supabase
        .from("emergency_slots")
        .update({ is_booked: true })
        .eq("id", body.slotId)
        .eq("clinic_id", clinicId)
        .eq("is_booked", false)
        .select("id, doctor_id, slot_date, start_time, end_time")
        .single();

      if (claimError || !claimedSlot) {
        return apiError("Emergency slot is unavailable or already booked", 409);
      }

      // Find or create patient (prefer phone-based lookup to avoid name collisions)
      const patientId = await findOrCreatePatient(
        supabase, clinicId, body.patientId, body.patientName,
        { phone: body.patientPhone },
      );
      if (!patientId) {
        // Rollback: release the slot claim if patient resolution fails
        await supabase
          .from("emergency_slots")
          .update({ is_booked: false })
          .eq("id", body.slotId);
        return apiInternalError("Failed to resolve patient");
      }

      // Slot is now atomically claimed. Create the appointment.
      const slotStart = `${claimedSlot.slot_date}T${claimedSlot.start_time}:00`;
      const slotEnd = `${claimedSlot.slot_date}T${claimedSlot.end_time}:00`;

      const { data: appointment, error: apptError } = await supabase
        .from("appointments")
        .insert({
          clinic_id: clinicId,
          patient_id: patientId,
          doctor_id: claimedSlot.doctor_id,
          service_id: body.serviceId ?? null,
          appointment_date: claimedSlot.slot_date,
          start_time: claimedSlot.start_time,
          end_time: claimedSlot.end_time,
          slot_start: slotStart,
          slot_end: slotEnd,
          status: APPOINTMENT_STATUS.CONFIRMED,
          is_first_visit: false,
          insurance_flag: false,
          booking_source: BOOKING_SOURCE.ONLINE,
          is_emergency: true,
        })
        .select("id")
        .single();

      if (apptError || !appointment) {
        // Rollback: release the slot claim if appointment creation fails
        await supabase
          .from("emergency_slots")
          .update({ is_booked: false })
          .eq("id", body.slotId);

        return apiInternalError("Failed to create appointment");
      }

      // Audit log for healthcare compliance
      await logAuditEvent({
        supabase,
        action: "appointment.emergency_booked",
        type: "booking",
        clinicId,
        description: `Emergency appointment ${appointment.id} created for patient ${patientId} with doctor ${claimedSlot.doctor_id} on ${claimedSlot.slot_date}`,
      });

      return apiSuccess({
        status: "booked",
        message: "Emergency slot booked",
        appointmentId: appointment.id,
      });
    }

    return apiError("action must be 'create' or 'book'");
}, STAFF_ROLES);

/**
 * GET /api/booking/emergency-slot?doctorId=...&date=...
 *
 * Get available emergency slots. Requires authentication.
 */
export const GET = withAuth(async (request, { supabase }) => {
  const doctorId = request.nextUrl.searchParams.get("doctorId") ?? undefined;
  const date = request.nextUrl.searchParams.get("date") ?? undefined;

  const tenant = await requireTenant();

  let q = supabase
    .from("emergency_slots")
    .select("id, doctor_id, slot_date, start_time, end_time, reason, is_booked, created_at")
    .eq("clinic_id", tenant.clinicId);

  if (doctorId) {
    q = q.eq("doctor_id", doctorId);
  }
  if (date) {
    q = q.eq("slot_date", date);
  }

  const { data: slots, error } = await q.order("start_time", { ascending: true });

  if (error) {
    return apiSuccess({ slots: [] });
  }

  return apiSuccess({
    slots: (slots ?? []).map((s) => ({
      id: s.id,
      doctorId: s.doctor_id,
      date: s.slot_date,
      startTime: s.start_time,
      endTime: s.end_time,
      reason: s.reason,
      isBooked: s.is_booked,
      createdAt: s.created_at,
    })),
  });
}, STAFF_ROLES);
