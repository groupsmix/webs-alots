import { NextRequest } from "next/server";
import { suggestSmartSlots, type PatientPreferences } from "@/lib/algorithms/smart-scheduler";
import { apiSuccess, apiError, apiValidationError, apiInternalError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { getAvailableSlots } from "@/lib/scheduling/availability";
import { withAuth } from "@/lib/with-auth";
import type { AuthContext } from "@/lib/with-auth";

/**
 * GET /api/appointments/smart-suggest?patientId=X&doctorId=Y&isUrgent=false
 *
 * Returns smart scheduling suggestions for a patient based on their
 * past preferences and current availability.
 */
async function handler(req: NextRequest, auth: AuthContext) {
  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get("patientId");
  const doctorId = searchParams.get("doctorId");
  const isUrgent = searchParams.get("isUrgent") === "true";

  if (!patientId || !doctorId) {
    return apiValidationError("patientId and doctorId are required");
  }

  const { supabase, profile } = auth;
  const clinicId = profile.clinic_id;

  if (!clinicId) {
    return apiError("No clinic associated with this account", 403, "NO_CLINIC");
  }

  try {
    // 1. Determine patient preferences from historical data
    // In a real application, this would query past appointments
    // Here we use mock logic to simulate the preference derivation
    const { data: pastAppointments, error: pastError } = await supabase
      .from("appointments")
      .select("start_time")
      .eq("patient_id", patientId)
      .eq("clinic_id", clinicId)
      .limit(5);

    if (pastError) throw pastError;

    const preferences: PatientPreferences = {
      preferredDaysOfWeek: [],
      preferredTimeOfDay: "any",
      isUrgent,
    };

    if (pastAppointments && pastAppointments.length > 0) {
      const daysCount: Record<number, number> = {};
      let morningCount = 0;
      let afternoonCount = 0;

      for (const apt of pastAppointments) {
        // start_time is nullable in the schema; skip rows missing it.
        if (!apt.start_time) continue;
        const d = new Date(apt.start_time);
        const day = d.getDay();
        const hour = d.getHours();

        daysCount[day] = (daysCount[day] || 0) + 1;
        if (hour < 12) morningCount++;
        else if (hour < 17) afternoonCount++;
      }

      // Find top day
      const sortedDays = Object.entries(daysCount).sort((a, b) => b[1] - a[1]);
      if (sortedDays.length > 0) {
        preferences.preferredDaysOfWeek.push(Number(sortedDays[0][0]));
      }

      // Determine preferred time
      if (morningCount > afternoonCount) preferences.preferredTimeOfDay = "morning";
      else if (afternoonCount > morningCount) preferences.preferredTimeOfDay = "afternoon";
    } else {
      // Default preferences for new patients
      preferences.preferredTimeOfDay = "any";
    }

    // 2. Fetch doctor's available slots for the next 7 days
    const today = new Date();
    const endDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Fetch doctor working hours (one row per day-of-week per doctor).
    // The table is `doctor_availability`; the slot length column is
    // `slot_duration` (in minutes).
    const { data: hours, error: hoursError } = await supabase
      .from("doctor_availability")
      .select("day_of_week, start_time, end_time, slot_duration")
      .eq("doctor_id", doctorId)
      .eq("clinic_id", clinicId)
      .eq("is_active", true);

    if (hoursError) throw hoursError;

    // Fetch existing bookings
    const { data: bookings, error: bookingsError } = await supabase
      .from("appointments")
      .select("start_time, end_time")
      .eq("doctor_id", doctorId)
      .eq("clinic_id", clinicId)
      .gte("start_time", today.toISOString())
      .lte("start_time", endDate.toISOString())
      .neq("status", "cancelled");

    if (bookingsError) throw bookingsError;

    const doctorWorkingHours =
      hours?.map((h) => ({
        dayOfWeek: h.day_of_week,
        startTime: h.start_time,
        endTime: h.end_time,
        slotDurationMinutes: h.slot_duration,
      })) || [];

    // bookings.start_time is nullable in the schema; drop rows missing it
    // (the slot computation requires a concrete start).
    const existingBookings = (bookings ?? []).flatMap((b) => {
      if (!b.start_time) return [];
      const start = new Date(b.start_time);
      const end = b.end_time ? new Date(b.end_time) : new Date(start.getTime() + 30 * 60000);
      return [{ start, end }];
    });

    // Generate slots day by day and concatenate
    const allAvailableSlots: ReturnType<typeof getAvailableSlots> = [];
    for (let i = 0; i < 7; i++) {
      const queryDate = new Date(today);
      queryDate.setDate(queryDate.getDate() + i);

      const daySlots = getAvailableSlots({
        date: queryDate,
        doctorWorkingHours,
        existingBookings,
        appointmentDurationMinutes: 30, // Assume standard 30 min duration
      });
      allAvailableSlots.push(...daySlots);
    }

    // 3. Score and suggest slots
    const suggestions = suggestSmartSlots(allAvailableSlots, preferences, 3);

    return apiSuccess({
      patientId,
      preferencesExtracted: preferences,
      suggestions,
    });
  } catch (err) {
    logger.error("Failed to generate smart schedule suggestions", {
      context: "api/appointments/smart-suggest",
      error: err instanceof Error ? err.message : String(err),
      patientId,
    });
    return apiInternalError("Failed to generate smart suggestions");
  }
}

export const GET = withAuth(handler, ["receptionist", "doctor", "clinic_admin"]);
