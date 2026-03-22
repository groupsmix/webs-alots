-- Prevent duplicate active payments for the same appointment.
-- Only one non-refunded/non-failed payment may exist per appointment.
CREATE UNIQUE INDEX IF NOT EXISTS idx_no_duplicate_active_payment
ON payments (appointment_id)
WHERE status NOT IN ('refunded', 'failed');
