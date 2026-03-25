import { NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { requireTenantWithConfig } from "@/lib/tenant";
import { getPublicAvailableSlots } from "@/lib/data/public";
import { APPOINTMENT_STATUS } from "@/lib/types/database";
import { logAuditEvent } from "@/lib/audit-log";
import { computeEndTime } from "@/lib/timezone";
import { logger } from "@/lib/logger";
import { rescheduleSchema, safeParse } from "@/lib/validations";
import { STAFF_ROLES } from "@/lib/auth-roles";
import type { UserRole } from "@/lib/types/database";

const RESCHEDULE_ROLES: UserRole[] = [...STAFF_ROLES, "patient"];

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

    const { tenant, config: tenantConfig } = await requireTenantWithConfig();
    const clinicId = tenant.clinicId;

    // Reject past dates
    const todayInTz = new Date().toLocaleDateString("en-CA", { timeZone: tenantConfig.timezone });
    if (body.newDate < todayInTz) {
      return NextResponse.json(
        { error: "Cannot reschedule to a date in the past" },
        { status: 400 },
      );
    }

    // Validate working hours for the new date.
    // Use Intl.DateTimeFormat with the clinic's timezone (same approach as
    // the main booking route) to avoid midnight-boundary bugs where the
    // server's UTC date differs from the clinic's local date.
    const parsedDate = new Date(body.newDate + "T12:00:00");
    const dayFormatter = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      timeZone: tenantConfig.timezone,
    });
    const dayMap: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    const dayOfWeek = dayMap[dayFormatter.format(parsedDate)] ?? parsedDate.getDay();
    const hours = tenantConfig.workingHours[dayOfWeek];
    if (!hours?.enabled) {
      return NextResponse.json(
        { error: "Selected date is not a working day" },
        { status: 400 },
      );
    }

    // Get the existing appointment (include patient_id for ownership check)
    const { data: existing, error: fetchError } = await supabase
      .from("appointments")
      .select("id, status, clinic_id, patient_id, doctor_id, service_id, appointment_date, start_time, end_time, slot_start, slot_end")
      .eq("id", body.appointmentId)
      .eq("clinic_id", clinicId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    // Ownership check: patients can only reschedule their OWN appointments
    if (profile.role === "patient" && existing.patient_id !== profile.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

    // Calculate end_time and slot boundaries using shared computeEndTime
    let duration = tenantConfig.booking.slotDuration;
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

    const { endTime, overflows } = computeEndTime(body.newTime, duration);
    if (overflows) {
      return NextResponse.json(
        { error: "Appointment would extend past midnight. Please choose an earlier time." },
        { status: 400 },
      );
    }
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
        status: APPOINTMENT_STATUS.CONFIRMED,
      })
      .eq("id", body.appointmentId);

    if (updateError) {
      return NextResponse.json({ error: "Failed to update appointment" }, { status: 500 });
    }

    // ── Post-update maxPerSlot enforcement (TOCTOU guard) ──────────────
    // Same pattern as the main booking route: after updating we count how
    // many active bookings now exist for this slot.  If the count exceeds
    // maxPerSlot the just-updated row lost a race and must be rolled back.
    const maxPerSlot = tenantConfig.booking.maxPerSlot;
    const { count: slotCount } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("doctor_id", existing.doctor_id)
      .eq("appointment_date", body.newDate)
      .eq("start_time", body.newTime)
      .in("status", [
        APPOINTMENT_STATUS.CONFIRMED,
        APPOINTMENT_STATUS.PENDING,
        APPOINTMENT_STATUS.RESCHEDULED,
      ]);

    if (slotCount !== null && slotCount > maxPerSlot) {
      // Roll back: revert the appointment to its original state
      await supabase
        .from("appointments")
        .update({
          appointment_date: existing.appointment_date,
          start_time: existing.start_time,
          end_time: existing.end_time,
          slot_start: existing.slot_start,
          slot_end: existing.slot_end,
          status: existing.status,
        })
        .eq("id", body.appointmentId);

      return NextResponse.json(
        { error: "This slot has just been fully booked. Please choose another time." },
        { status: 409 },
      );
    }

    await logAuditEvent({
      supabase,
      action: "appointment.rescheduled",
      type: "booking",
      actor: profile.id,
      clinicId: profile.clinic_id ?? clinicId,
      description: `Appointment ${body.appointmentId} rescheduled to ${body.newDate} ${body.newTime}`,
    });

    return NextResponse.json({
      status: APPOINTMENT_STATUS.RESCHEDULED,
      message: "Appointment rescheduled successfully",
      newAppointmentId: body.appointmentId,
    });
  } catch (err) {
    logger.warn("Operation failed", { context: "booking/reschedule", error: err });
    return NextResponse.json({ error: "Failed to reschedule appointment" }, { status: 500 });
  }
}, RESCHEDULE_ROLES);
