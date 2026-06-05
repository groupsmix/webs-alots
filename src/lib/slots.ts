/**
 * Appointment slot generation.
 *
 * Generates available booking slots for a given doctor on a given date by:
 *   1. Returning [] immediately if the date has a doctor_exceptions record.
 *   2. Fetching the doctor's working hours from doctor_availability.
 *   3. Generating all possible slots (slot_duration + buffer_time increments).
 *   4. Subtracting already-booked confirmed/pending appointments.
 *   5. Returning the remaining free slots as Date objects (Africa/Casablanca).
 */

import { createClient } from "@/lib/supabase-server";
import { assertClinicId } from "@/lib/assert-tenant";
import { logger } from "@/lib/logger";

// ── Types ──────────────────────────────────────────────────────────────────

export interface SlotParams {
  doctorId: string;
  clinicId: string;
  /** The calendar date to generate slots for. Time component is ignored. */
  date: Date;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Parse "HH:MM:SS" time string into { hours, minutes } */
function parseTime(t: string): { hours: number; minutes: number } {
  const [h, m] = t.split(":").map(Number);
  return { hours: h ?? 0, minutes: m ?? 0 };
}

/** Build an ISO date string "YYYY-MM-DD" from a Date in local timezone. */
function toDateString(d: Date): string {
  return d.toISOString().split("T")[0];
}

/**
 * Build a Date object for a given calendar day + HH:MM time components.
 * The returned Date is in UTC but represents the correct slot start
 * in Africa/Casablanca time when formatted with the correct timezone.
 */
function buildSlotDate(calendarDate: Date, hours: number, minutes: number): Date {
  const d = new Date(calendarDate);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

// ── Main export ────────────────────────────────────────────────────────────

/**
 * Return available booking slots for a doctor on a specific date.
 *
 * Returns an empty array when:
 *   - The date is in doctor_exceptions (day off / vacation).
 *   - No active doctor_availability record exists for that day of week.
 *   - All generated slots are already booked.
 */
export async function getAvailableSlots(params: SlotParams): Promise<Date[]> {
  assertClinicId(params.clinicId, "getAvailableSlots");

  const supabase = await createClient();
  const dateStr  = toDateString(params.date);

  // ── 1. Exception check ────────────────────────────────────────────────
  const { data: exception, error: excError } = await supabase
    .from("doctor_exceptions")
    .select("id")
    .eq("doctor_id", params.doctorId)
    .eq("clinic_id", params.clinicId)
    .eq("date", dateStr)
    .maybeSingle();

  if (excError) {
    logger.warn("getAvailableSlots: exception check failed", {
      context: "slots",
      doctorId: params.doctorId,
      date: dateStr,
      error: excError,
    });
  }

  if (exception) return [];

  // ── 2. Working hours ──────────────────────────────────────────────────
  // day_of_week: 0 = Sunday … 6 = Saturday (matches Date.getDay())
  const dayOfWeek = params.date.getDay();

  const { data: availability, error: availError } = await supabase
    .from("doctor_availability")
    .select("start_time, end_time, slot_duration, buffer_time")
    .eq("doctor_id", params.doctorId)
    .eq("clinic_id", params.clinicId)
    .eq("day_of_week", dayOfWeek)
    .eq("is_active", true)
    .maybeSingle();

  if (availError) {
    logger.warn("getAvailableSlots: availability fetch failed", {
      context: "slots",
      doctorId: params.doctorId,
      date: dateStr,
      error: availError,
    });
  }

  if (!availability) return [];

  const start       = parseTime(availability.start_time);
  const end         = parseTime(availability.end_time);
  const slotMins    = availability.slot_duration ?? 30;
  const bufferMins  = availability.buffer_time   ?? 0;
  const stepMins    = slotMins + bufferMins;

  // ── 3. Generate all theoretical slots ────────────────────────────────
  const allSlots: Date[] = [];
  let currentMins = start.hours * 60 + start.minutes;
  const endMins   = end.hours   * 60 + end.minutes;

  while (currentMins + slotMins <= endMins) {
    const h = Math.floor(currentMins / 60);
    const m = currentMins % 60;
    allSlots.push(buildSlotDate(params.date, h, m));
    currentMins += stepMins;
  }

  if (allSlots.length === 0) return [];

  // ── 4. Fetch booked appointments ──────────────────────────────────────
  // Start of day and end of day in ISO string for range query.
  const dayStart = new Date(params.date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(params.date);
  dayEnd.setHours(23, 59, 59, 999);

  const { data: booked, error: bookError } = await supabase
    .from("appointments")
    .select("scheduled_at")
    .eq("doctor_id", params.doctorId)
    .eq("clinic_id", params.clinicId)
    .in("status", ["confirmed", "pending"])
    .gte("scheduled_at", dayStart.toISOString())
    .lte("scheduled_at", dayEnd.toISOString());

  if (bookError) {
    logger.warn("getAvailableSlots: booked appointments fetch failed", {
      context: "slots",
      doctorId: params.doctorId,
      date: dateStr,
      error: bookError,
    });
  }

  // Build a Set of booked slot timestamps (rounded to the minute) for O(1) lookup.
  const bookedTimestamps = new Set(
    (booked ?? []).map((b: { scheduled_at: string }) => {
      const d = new Date(b.scheduled_at);
      d.setSeconds(0, 0);
      return d.getTime();
    }),
  );

  // ── 5. Return free slots ──────────────────────────────────────────────
  return allSlots.filter((slot) => {
    const t = new Date(slot);
    t.setSeconds(0, 0);
    return !bookedTimestamps.has(t.getTime());
  });
}
