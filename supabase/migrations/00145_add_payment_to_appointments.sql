-- ============================================================
-- Migration 00145: Add CMI payment tracking columns to appointments
--
-- Adds four columns required by the CMI payment integration:
--   payment_status   — lifecycle state of the payment for this appointment
--   payment_amount   — amount charged in MAD (2 decimal places)
--   payment_order_id — unique order ID generated per transaction and sent
--                      to CMI; included in the callback oid field as
--                      `{clinic_id}-{payment_order_id}`
--   payment_reference— CMI's approval/authorisation code returned in the
--                      callback, stored for reconciliation and refunds
--
-- No new RLS policies are needed: appointments already has RLS enabled
-- and all existing policies scope reads/writes to the clinic.
-- ============================================================

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'refunded')),
  ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS payment_order_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT;

COMMENT ON COLUMN appointments.payment_status IS
  'CMI payment lifecycle: unpaid (default) → pending (form submitted) → paid (callback approved) → refunded.';

COMMENT ON COLUMN appointments.payment_amount IS
  'Amount charged in MAD (Moroccan Dirham). NULL until payment is initiated.';

COMMENT ON COLUMN appointments.payment_order_id IS
  'Unique order ID generated per transaction. Used to correlate the CMI callback '
  'with the appointment row. Sent to CMI as part of the oid field.';

COMMENT ON COLUMN appointments.payment_reference IS
  'CMI authorisation / approval code returned in the POST-back callback. '
  'Stored for reconciliation and refund processing.';
