/**
 * Find Alternative Slots
 *
 * When a doctor marks themselves unavailable for a date range,
 * this module finds alternative available slots for affected appointments.
 * It looks at the same doctor's schedule on subsequent available dates.
 */

import { clinicConfig } from "@/config/clinic.config";

export interface AlternativeSlot {
  date: string;
  time: string;
  slotStart: string;
  slotEnd: string;
  label: string;
}

export interface AffectedAppointment {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  doctorId: string;
  doctorName: string;
  serviceName: string;
  date: string;
  time: string;
  status: string;
}

/**
 * Generate time slots for a given day based on clinic working hours.
 */
function generateTimeSlots(dayOfWeek: number): string[] {
  const wh = clinicConfig.workingHours[dayOfWeek];
  if (!wh?.enabled) return [];

  const slots: string[] = [];
  const slotDuration = clinicConfig.booking.slotDuration || 30;
  const [openH, openM] = wh.open.split(":").map(Number);
  const [closeH, closeM] = wh.close.split(":").map(Number);

  let currentMinutes = openH * 60 + openM;
  const endMinutes = closeH * 60 + closeM;

  while (currentMinutes + slotDuration <= endMinutes) {
    const h = Math.floor(currentMinutes / 60);
    const m = currentMinutes % 60;
    slots.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
    currentMinutes += slotDuration;
  }

  return slots;
}

/**
 * Find up to `count` alternative available slots for a doctor,
 * starting from `afterDate`, skipping dates in `unavailableDates`.
 *
 * @param bookedSlots - Set of "YYYY-MM-DD|HH:MM" strings already booked for this doctor
 * @param unavailableStartDate - Start of unavailable range (inclusive, YYYY-MM-DD)
 * @param unavailableEndDate - End of unavailable range (inclusive, YYYY-MM-DD)
 * @param count - Number of alternative slots to find (default: 3)
 */
export function findAlternativeSlots(
  bookedSlots: Set<string>,
  unavailableStartDate: string,
  unavailableEndDate: string,
  count = 3,
): AlternativeSlot[] {
  const results: AlternativeSlot[] = [];
  const unavailStart = new Date(unavailableStartDate);
  const unavailEnd = new Date(unavailableEndDate);

  // Start searching from the day after the unavailable end date
  const searchStart = new Date(unavailEnd);
  searchStart.setDate(searchStart.getDate() + 1);

  // Search up to 30 days ahead
  const maxSearchDays = 30;

  for (let dayOffset = 0; dayOffset < maxSearchDays && results.length < count; dayOffset++) {
    const candidateDate = new Date(searchStart);
    candidateDate.setDate(searchStart.getDate() + dayOffset);

    const dateStr = candidateDate.toISOString().split("T")[0];
    const dayOfWeek = candidateDate.getDay();

    // Skip if this date falls in the unavailable range
    if (candidateDate >= unavailStart && candidateDate <= unavailEnd) continue;

    const slots = generateTimeSlots(dayOfWeek);

    for (const time of slots) {
      if (results.length >= count) break;

      const slotKey = `${dateStr}|${time}`;
      if (bookedSlots.has(slotKey)) continue;

      const slotDuration = clinicConfig.booking.slotDuration || 30;
      const [h, m] = time.split(":").map(Number);
      const endMinutes = h * 60 + m + slotDuration;
      const endH = Math.floor(endMinutes / 60);
      const endM = endMinutes % 60;
      const endTime = `${endH.toString().padStart(2, "0")}:${endM.toString().padStart(2, "0")}`;

      const displayDate = candidateDate.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });

      results.push({
        date: dateStr,
        time,
        slotStart: `${dateStr}T${time}:00`,
        slotEnd: `${dateStr}T${endTime}:00`,
        label: `${displayDate} at ${time}`,
      });
    }
  }

  return results;
}

/**
 * Build a set of booked slot keys ("YYYY-MM-DD|HH:MM") for a doctor
 * from a list of appointment rows.
 */
export function buildBookedSlotsSet(
  appointments: Array<{
    appointment_date: string | null;
    start_time: string | null;
    status: string;
  }>,
): Set<string> {
  const set = new Set<string>();
  const activeStatuses = new Set(["confirmed", "pending", "scheduled", "in_progress", "in-progress"]);

  for (const appt of appointments) {
    if (!appt.appointment_date || !appt.start_time) continue;
    if (!activeStatuses.has(appt.status)) continue;
    const time = appt.start_time.slice(0, 5);
    set.add(`${appt.appointment_date}|${time}`);
  }

  return set;
}
