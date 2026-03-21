-- ============================================================
-- Migration 00020: Add notification_log table
--
-- The cron reminder system and notification engine insert into
-- notification_log. This migration adds the table with proper
-- foreign keys, indexes, and RLS policies.
-- ============================================================

-- ============================================================
-- 1. CREATE TABLE
-- ============================================================

CREATE TABLE notification_log (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id   UUID REFERENCES appointments(id) ON DELETE SET NULL,
  clinic_id        UUID REFERENCES clinics(id) ON DELETE CASCADE,
  trigger          TEXT NOT NULL,
  channel          TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email', 'sms', 'in_app')),
  recipient_phone  TEXT,
  recipient_name   TEXT,
  body             TEXT,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'sent', 'failed', 'delivered', 'read')),
  error_message    TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 2. INDEXES
-- ============================================================

CREATE INDEX idx_notification_log_appointment ON notification_log(appointment_id);
CREATE INDEX idx_notification_log_clinic ON notification_log(clinic_id);
CREATE INDEX idx_notification_log_status ON notification_log(status);
CREATE INDEX idx_notification_log_created ON notification_log(created_at);
CREATE INDEX idx_notification_log_trigger ON notification_log(trigger);

-- ============================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

-- Super admins: full access
CREATE POLICY "sa_notification_log_all" ON notification_log
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Clinic staff: read logs belonging to their clinic
CREATE POLICY "staff_notification_log_read" ON notification_log
  FOR SELECT USING (clinic_id = get_user_clinic_id() AND is_clinic_staff());

-- Clinic admin: full access to their clinic's logs
CREATE POLICY "admin_notification_log_all" ON notification_log
  FOR ALL
  USING (clinic_id = get_user_clinic_id() AND get_user_role() = 'clinic_admin')
  WITH CHECK (clinic_id = get_user_clinic_id());

-- Service role (edge functions) bypasses RLS automatically
