import { apiError, apiInternalError, apiSuccess } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { STAFF_ROLES } from "@/lib/auth-roles";
import { findOrCreatePatient } from "@/lib/find-or-create-patient";
import { logger } from "@/lib/logger";
import { requireTenantWithConfig } from "@/lib/tenant";
import { computeEndTime } from "@/lib/timezone";
import { APPOINTMENT_STATUS, BOOKING_SOURCE } from "@/lib/types/database";
import type { UserRole } from "@/lib/types/database";
import { smartScheduleSchema, smartScheduleConfirmSchema } from "@/lib/validations/receptionist-ai";

const SMART_SCHEDULE_ROLES: UserRole[] = [...STAFF_ROLES, "patient"];

/**
 * POST /api/booking/smart-schedule
 *
 * AI-powered smart scheduling: finds optimal slots considering
 * doctor availability, service duration, buffer times, and existing bookings.
 */
export const POST = withAuthValidation(
  smartScheduleSchema,
  async (body, request, { supabase }) => {
    const { tenant, config } = await requireTenantWithConfig();
    const clinicId = tenant.clinicId;

    const { doctorId, serviceId, preferredDate, preferredTimeStart, preferredTimeEnd, urgency } =
      body;

    // Fetch service duration (custom per clinic/doctor, or default)
    const { data: serviceDuration } = await supabase
      .from("service_durations")
      .select("duration_minutes, buffer_minutes")
      .eq("clinic_id", clinicId)
      .eq("service_id", serviceId)
      .eq("doctor_id", doctorId)
      .maybeSingle();

    const slotDuration = serviceDuration?.duration_minutes ?? config.booking.slotDuration;
    const bufferTime = serviceDuration?.buffer_minutes ?? config.booking.bufferTime;

    // Fetch doctor availability for the day of week
    const dateObj = new Date(preferredDate + "T00:00:00");
    const dayOfWeek = dateObj.getUTCDay();

    const { data: availability } = await supabase
      .from("doctor_availability")
      .select("start_time, end_time")
      .eq("clinic_id", clinicId)
      .eq("doctor_id", doctorId)
      .eq("day_of_week", dayOfWeek)
      .eq("is_active", true)
      .maybeSingle();

    // Fallback to clinic working hours
    const workingHours = config.workingHours[dayOfWeek];
    if (!availability && (!workingHours || !workingHours.enabled)) {
      return apiError("Doctor is not available on this day", 400, "NOT_AVAILABLE");
    }

    const dayStart = availability?.start_time?.slice(0, 5) ?? workingHours?.open ?? "09:00";
    const dayEnd = availability?.end_time?.slice(0, 5) ?? workingHours?.close ?? "17:00";

    // Fetch existing appointments for this doctor on this date
    const { data: existingAppts } = await supabase
      .from("appointments")
      .select("slot_start, slot_end, status")
      .eq("clinic_id", clinicId)
      .eq("doctor_id", doctorId)
      .eq("appointment_date", preferredDate)
      .not("status", "in", `(${APPOINTMENT_STATUS.CANCELLED},${APPOINTMENT_STATUS.RESCHEDULED})`);

    // Fetch doctor unavailability periods
    // doctor_unavailability not yet in generated types — cast through unknown
    const unavailClient = supabase as unknown as {
      from(t: string): {
        select(s: string): {
          eq(
            col: string,
            val: string,
          ): {
            eq(
              col: string,
              val: string,
            ): {
              lte(
                col: string,
                val: string,
              ): {
                gte(
                  col: string,
                  val: string,
                ): Promise<{ data: Array<{ start_date: string; end_date: string }> | null }>;
              };
            };
          };
        };
      };
    };
    const { data: unavailable } = await unavailClient
      .from("doctor_unavailability")
      .select("start_date, end_date")
      .eq("clinic_id", clinicId)
      .eq("doctor_id", doctorId)
      .lte("start_date", preferredDate)
      .gte("end_date", preferredDate);

    if (unavailable && unavailable.length > 0) {
      return apiError("Doctor is unavailable on this date", 400, "DOCTOR_UNAVAILABLE");
    }

    // Check doctor no-show stats for overbooking suggestion
    const { data: doctorStats } = await supabase
      .from("doctor_no_show_stats")
      .select("no_show_rate, suggested_overbooking_pct")
      .eq("clinic_id", clinicId)
      .eq("doctor_id", doctorId)
      .maybeSingle();

    // Generate available slots
    const slots: Array<{
      time: string;
      endTime: string;
      score: number;
      reason: string;
    }> = [];

    const bookedSlots = (existingAppts ?? [])
      .filter(
        (a) =>
          a.status !== APPOINTMENT_STATUS.CANCELLED && a.status !== APPOINTMENT_STATUS.RESCHEDULED,
      )
      .map((a) => ({
        start: a.slot_start,
        end: a.slot_end,
      }));

    // Generate time slots
    const [startH, startM] = dayStart.split(":").map(Number);
    const [endH, endM] = dayEnd.split(":").map(Number);
    const dayStartMinutes = startH * 60 + startM;
    const dayEndMinutes = endH * 60 + endM;

    for (
      let m = dayStartMinutes;
      m + slotDuration <= dayEndMinutes;
      m += slotDuration + bufferTime
    ) {
      const slotTime = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      const slotEndMinutes = m + slotDuration;
      const slotEndTime = `${String(Math.floor(slotEndMinutes / 60)).padStart(2, "0")}:${String(slotEndMinutes % 60).padStart(2, "0")}`;

      // Check for conflicts with existing appointments
      const hasConflict = bookedSlots.some((booked) => {
        const bookedStart = booked.start;
        const bookedEnd = booked.end;
        return slotTime < bookedEnd && slotEndTime > bookedStart;
      });

      if (hasConflict) continue;

      // Score the slot (higher is better)
      let score = 50;
      let reason = "Available";

      // Prefer morning slots for urgent cases
      if (urgency === "urgent" || urgency === "high") {
        if (m < dayStartMinutes + 120) {
          score += 20;
          reason = "Early slot for urgent case";
        }
      }

      // Prefer requested time window
      if (preferredTimeStart && preferredTimeEnd) {
        if (slotTime >= preferredTimeStart && slotTime <= preferredTimeEnd) {
          score += 30;
          reason = "Within preferred time window";
        }
      } else if (preferredTimeStart) {
        const diff = Math.abs(m - timeToMinutes(preferredTimeStart));
        if (diff <= 30) {
          score += 25;
          reason = "Close to preferred time";
        }
      }

      // Prefer slots adjacent to existing bookings (reduce gaps)
      const hasAdjacentBooking = bookedSlots.some((booked) => {
        const bookedEndMinutes = timeToMinutes(booked.end);
        const bookedStartMinutes = timeToMinutes(booked.start);
        return (
          Math.abs(m - bookedEndMinutes) <= bufferTime ||
          Math.abs(slotEndMinutes - bookedStartMinutes) <= bufferTime
        );
      });
      if (hasAdjacentBooking) {
        score += 10;
      }

      slots.push({ time: slotTime, endTime: slotEndTime, score, reason });
    }

    // Sort by score descending
    slots.sort((a, b) => b.score - a.score);

    return apiSuccess({
      slots: slots.slice(0, 10),
      slotDuration,
      bufferTime,
      doctorNoShowRate: doctorStats?.no_show_rate ?? null,
      suggestedOverbooking: doctorStats?.suggested_overbooking_pct ?? null,
    });
  },
  SMART_SCHEDULE_ROLES,
);

/**
 * PUT /api/booking/smart-schedule
 *
 * Confirm a smart-scheduled slot and create the appointment.
 */
export const PUT = withAuthValidation(
  smartScheduleConfirmSchema,
  async (body, request, { supabase }) => {
    const { tenant } = await requireTenantWithConfig();
    const clinicId = tenant.clinicId;

    const {
      doctorId,
      serviceId,
      patientId,
      patientName,
      patientPhone,
      date,
      time,
      slotDuration,
      isFirstVisit,
      hasInsurance,
    } = body;

    // Resolve patient
    const resolvedPatientId = await findOrCreatePatient(
      supabase,
      clinicId,
      patientId,
      patientName,
      { phone: patientPhone },
    );

    if (!resolvedPatientId) {
      return apiInternalError("Failed to resolve patient");
    }

    const { endTime: slotEnd } = computeEndTime(time, slotDuration);

    // Double-check no conflict
    const { data: conflicts } = await supabase
      .from("appointments")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("doctor_id", doctorId)
      .eq("appointment_date", date)
      .lt("slot_start", slotEnd)
      .gt("slot_end", time)
      .not("status", "in", `(${APPOINTMENT_STATUS.CANCELLED},${APPOINTMENT_STATUS.RESCHEDULED})`)
      .limit(1);

    if (conflicts && conflicts.length > 0) {
      return apiError("Slot is no longer available", 409, "SLOT_CONFLICT");
    }

    const { data: appointment, error } = await supabase
      .from("appointments")
      .insert({
        clinic_id: clinicId,
        doctor_id: doctorId,
        patient_id: resolvedPatientId,
        service_id: serviceId,
        appointment_date: date,
        slot_start: time,
        slot_end: slotEnd,
        start_time: time,
        end_time: slotEnd,
        status: APPOINTMENT_STATUS.SCHEDULED,
        booking_source: BOOKING_SOURCE.PHONE,
        is_first_visit: isFirstVisit ?? false,
        insurance_flag: hasInsurance ?? false,
      })
      .select("id")
      .single();

    if (error || !appointment) {
      logger.error("Failed to create smart-scheduled appointment", {
        context: "booking/smart-schedule",
        error,
      });
      return apiInternalError("Failed to create appointment");
    }

    // Schedule reminders for this appointment
    const appointmentDateTime = new Date(`${date}T${time}:00`);
    const reminder24h = new Date(appointmentDateTime.getTime() - 24 * 60 * 60 * 1000);
    const reminder2h = new Date(appointmentDateTime.getTime() - 2 * 60 * 60 * 1000);

    const now = new Date();
    const reminders: Array<{
      clinic_id: string;
      appointment_id: string;
      reminder_type: string;
      channel: string;
      status: string;
      scheduled_at: string;
    }> = [];

    if (reminder24h > now) {
      reminders.push({
        clinic_id: clinicId,
        appointment_id: appointment.id,
        reminder_type: "24h",
        channel: "whatsapp",
        status: "pending",
        scheduled_at: reminder24h.toISOString(),
      });
    }

    if (reminder2h > now) {
      reminders.push({
        clinic_id: clinicId,
        appointment_id: appointment.id,
        reminder_type: "2h",
        channel: "whatsapp",
        status: "pending",
        scheduled_at: reminder2h.toISOString(),
      });
    }

    if (reminders.length > 0) {
      await supabase.from("appointment_reminders").insert(reminders);
    }

    await logAuditEvent({
      supabase,
      action: "appointment.smart_scheduled",
      type: "booking",
      clinicId,
      description: `Smart-scheduled appointment ${appointment.id} for patient ${resolvedPatientId} with doctor ${doctorId} on ${date} at ${time}`,
    });

    return apiSuccess({
      appointmentId: appointment.id,
      date,
      time,
      slotEnd,
    });
  },
  SMART_SCHEDULE_ROLES,
);

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
