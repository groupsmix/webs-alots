-- Prevent double-booking: only one active appointment per
-- (clinic, doctor, date, start_time) where the appointment has not been
-- cancelled or marked as a no-show.
CREATE UNIQUE INDEX IF NOT EXISTS idx_no_double_booking
ON appointments (clinic_id, doctor_id, appointment_date, start_time)
WHERE status NOT IN ('cancelled', 'no_show');
