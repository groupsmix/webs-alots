-- ============================================================
-- Migration 00148: Create appointment_reminders deduplication table
--
-- Tracks which reminder types (24h, 2h, 15min) have already been sent
-- for each appointment, preventing duplicate WhatsApp messages when the
-- cron job fires multiple times within the reminder window.
--
-- The UNIQUE constraint on (appointment_id, reminder_type) is the
-- primary deduplication guard — an INSERT will fail (and be caught by
-- the Edge Function) if a reminder has already been recorded.
-- ============================================================

CREATE TABLE IF NOT EXISTS appointment_reminders (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID        NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  clinic_id      UUID        NOT NULL REFERENCES clinics(id),
  reminder_type  TEXT        NOT NULL CHECK (reminder_type IN ('24h', '2h', '15min')),
  sent_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  wa_message_id  TEXT,

  -- Deduplication: each reminder type is sent exactly once per appointment.
  UNIQUE (appointment_id, reminder_type)
);

ALTER TABLE appointment_reminders ENABLE ROW LEVEL SECURITY;

-- Clinic staff can view reminder logs for their own clinic.
CREATE POLICY "clinic_staff_view_reminders"
  ON appointment_reminders
  FOR SELECT
  USING (
    is_clinic_admin(clinic_id)
    OR is_clinic_staff()
  );

-- Only the service role (Edge Function) may insert reminder records.
CREATE POLICY "service_role_insert_reminders"
  ON appointment_reminders
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Super admins have full access for audit/debugging purposes.
CREATE POLICY "superadmin_all_reminders"
  ON appointment_reminders
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Composite index optimises the "not yet reminded" subquery in the Edge Function.
CREATE INDEX IF NOT EXISTS idx_reminders_appt_type
  ON appointment_reminders(appointment_id, reminder_type);

COMMENT ON TABLE appointment_reminders IS
  'Deduplication log for WhatsApp appointment reminder messages. '
  'The UNIQUE (appointment_id, reminder_type) constraint prevents the '
  '15-minute cron job from sending the same reminder twice.';
