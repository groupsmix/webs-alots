/**
 * Appointment availability engine.
 *
 * Computes available time slots for a given doctor/clinic by:
 * 1. Generating candidate slots from the doctor's working hours
 * 2. Subtracting already-booked appointments
 * 3. Applying appointment type duration constraints
 */

export interface WorkingHours {
  dayOfWeek: number; // 0=Sunday, 6=Saturday
  startTime: string; // "09:00"
  endTime: string; // "17:00"
  slotDurationMinutes: number;
}

export interface BookedSlot {
  start: Date;
  end: Date;
}

export interface AvailableSlot {
  start: Date;
  end: Date;
  durationMinutes: number;
}

export interface AvailabilityQuery {
  date: Date;
  doctorWorkingHours: WorkingHours[];
  existingBookings: BookedSlot[];
  appointmentDurationMinutes: number;
  bufferMinutes?: number;
}

/**
 * Compute available slots for a given date.
 */
export function getAvailableSlots(query: AvailabilityQuery): AvailableSlot[] {
  const {
    date,
    doctorWorkingHours,
    existingBookings,
    appointmentDurationMinutes,
    bufferMinutes = 0,
  } = query;

  const dayOfWeek = date.getDay();
  const todayHours = doctorWorkingHours.filter((wh) => wh.dayOfWeek === dayOfWeek);

  if (todayHours.length === 0) return [];

  const slots: AvailableSlot[] = [];

  for (const hours of todayHours) {
    const [startH, startM] = hours.startTime.split(":").map(Number);
    const [endH, endM] = hours.endTime.split(":").map(Number);

    const periodStart = new Date(date);
    periodStart.setHours(startH, startM, 0, 0);

    const periodEnd = new Date(date);
    periodEnd.setHours(endH, endM, 0, 0);

    const slotDuration = appointmentDurationMinutes + bufferMinutes;
    let cursor = new Date(periodStart);

    while (cursor.getTime() + slotDuration * 60000 <= periodEnd.getTime()) {
      const slotEnd = new Date(cursor.getTime() + appointmentDurationMinutes * 60000);

      const hasConflict = existingBookings.some((booking) => {
        const bookingStart = new Date(booking.start).getTime();
        const bookingEnd = new Date(booking.end).getTime();
        const candidateStart = cursor.getTime();
        const candidateEnd = slotEnd.getTime();
        return candidateStart < bookingEnd && candidateEnd > bookingStart;
      });

      if (!hasConflict) {
        slots.push({
          start: new Date(cursor),
          end: slotEnd,
          durationMinutes: appointmentDurationMinutes,
        });
      }

      cursor = new Date(cursor.getTime() + slotDuration * 60000);
    }
  }

  return slots;
}
