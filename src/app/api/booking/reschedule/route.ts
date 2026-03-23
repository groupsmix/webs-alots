import { NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { clinicConfig } from "@/config/clinic.config";
import { getPublicAvailableSlots } from "@/lib/data/public";
import { APPOINTMENT_STATUS } from "@/lib/types/database";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { rescheduleSchema, safeParse } from "@/lib/validations";

export const runtime = "edge";

/**
 * POST /api/booking/reschedule
 *
 * Reschedule an existing appointment to a new date/time.
 * Validates working hours, slot availability, and prevents
 * rescheduling to past dates or double-booking conflicts.
 */
export const POST = withAuth(async (request, { supabase, profile }) => {
  try {
    const raw = await request.json();
    const parsed = safeParse(rescheduleSchema, raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const body = parsed.data;

    // Reject past dates
    const tz = clinicConfig.timezone ?? "Africa/Casablanca";
    const todayInTz = new Date().toLocaleDateString("en-CA", { timeZone: tz });
    if (body.newDate < todayInTz) {
      return NextResponse.json(
        { error: "Cannot reschedule to a date in the past" },
        { status: 400 },
      );
    }

    // Validate working hours for the new date
    const parsedDate = new Date(body.newDate + "T12:00:00");
    const dayOfWeek = parsedDate.getDay();
    const hours = clinicConfig.workingHours[dayOfWeek];
    if (!hours?.enabled) {
      return NextResponse.json(
        { error: "Selected date is not a working day" },
        { status: 400 },
      );
    }

    // Get the existing appointment (include doctor_id and service_id for validation)
    const { data: existing, error: fetchError } = await supabase
      .from("appointments")
      .select("id, status, clinic_id, doctor_id, service_id")
      .eq("id", body.appointmentId)
      .eq("clinic_id", clinicConfig.clinicId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    // Only allow rescheduling appointments in a valid state
    if (existing.status === APPOINTMENT_STATUS.CANCELLED || existing.status === APPOINTMENT_STATUS.COMPLETED || existing.status === APPOINTMENT_STATUS.RESCHEDULED) {
      return NextResponse.json(
        { error: "Appointment cannot be rescheduled in its current state" },
        { status: 400 },
      );
    }

    // Check for double-booking conflicts at the new time
    const availableSlots = await getPublicAvailableSlots(body.newDate, existing.doctor_id);
    if (!availableSlots.includes(body.newTime)) {
      return NextResponse.json(
        { error: "Selected time slot is not available or already fully booked" },
        { status: 409 },
      );
    }

    // Calculate end_time and slot boundaries
    let duration = clinicConfig.booking.slotDuration;
    if (existing.service_id) {
      const { data: svc } = await supabase
        .from("services")
        .select("duration_minutes, duration_min")
        .eq("id", existing.service_id)
        .single();
      if (svc) {
        duration = (svc.duration_minutes as number) ?? (svc.duration_min as number) ?? duration;
      }
    }

    const [h, m] = body.newTime.split(":").map(Number);
    const endMinutes = h * 60 + m + duration;
    const endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, "0")}:${(endMinutes % 60).toString().padStart(2, "0")}`;
    const slotStart = `${body.newDate}T${body.newTime}:00`;
    const slotEnd = `${body.newDate}T${endTime}:00`;

    // Update the existing appointment with new date/time and computed fields
    const { error: updateError } = await supabase
      .from("appointments")
      .update({
        appointment_date: body.newDate,
        start_time: body.newTime,
        end_time: endTime,
        slot_start: slotStart,
        slot_end: slotEnd,
        status: APPOINTMENT_STATUS.RESCHEDULED,
      })
      .eq("id", body.appointmentId);

    if (updateError) {
      return NextResponse.json({ error: "Failed to update appointment" }, { status: 500 });
    }

    await logAuditEvent({
      supabase,
      action: "appointment.rescheduled",
      type: "booking",
      actor: profile.id,
      clinicId: profile.clinic_id ?? clinicConfig.clinicId,
      description: `Appointment ${body.appointmentId} rescheduled to ${body.newDate} ${body.newTime}`,
    });

    return NextResponse.json({
      status: APPOINTMENT_STATUS.RESCHEDULED,
      message: "Appointment rescheduled successfully",
      newAppointmentId: body.appointmentId,
    });
  } catch (err) {
    logger.warn("Operation failed", { context: "route", error: err });
    return NextResponse.json({ error: "Failed to reschedule appointment" }, { status: 500 });
  }
}, null);
