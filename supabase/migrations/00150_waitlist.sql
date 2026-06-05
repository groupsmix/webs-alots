-- ============================================================
-- Migration 00150: Create waitlist table
--
-- When no slots are available, patients can join a per-doctor
-- waitlist. When an appointment is cancelled, the cancellation
-- handler (src/app/api/appointments/[id]/cancel/route.ts) calls
-- promoteWaitlist() which:
--   1. Finds the oldest un-notified waitlist entry for that doctor.
--   2. Sets notified_at and expires_at (2-hour claim window).
--   3. Sends the patient a WhatsApp message with a claim link.
--
-- NOTE: This codebase has no separate `patients` table.
-- Patients are rows in the `users` table with role = 'patient'.
-- patient_id therefore references users(id).
--
-- Lifecycle columns:
--   notified_at  — set when the patient is notified of availability
--   claimed_at   — set when the patient confirms via the claim link
--   expires_at   — 2 hours after notification; un-claimed entries
--                  are skipped and the next waitlist entry is promoted
-- ============================================================

CREATE TABLE IF NOT EXISTS waitlist (
  id             UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id      UUID  NOT NULL REFERENCES clinics(id),
  doctor_id      UUID  NOT NULL REFERENCES users(id),
  patient_id     UUID  NOT NULL REFERENCES users(id),  -- role = 'patient'
  preferred_date DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified_at    TIMESTAMPTZ,
  claimed_at     TIMESTAMPTZ,
  expires_at     TIMESTAMPTZ
);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Clinic admins and staff can view and manage the waitlist.
CREATE POLICY "clinic_staff_manage_waitlist"
  ON waitlist
  FOR ALL
  USING  (is_clinic_admin(clinic_id) OR is_clinic_staff())
  WITH CHECK (is_clinic_admin(clinic_id) OR is_clinic_staff());

-- Patients can view their own waitlist entries.
CREATE POLICY "patient_view_own_waitlist"
  ON waitlist
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE  users.auth_id = auth.uid()
        AND  users.id       = waitlist.patient_id
        AND  users.role     = 'patient'
    )
  );

-- Patients can insert themselves onto the waitlist.
CREATE POLICY "patient_join_waitlist"
  ON waitlist
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE  users.auth_id = auth.uid()
        AND  users.id       = waitlist.patient_id
        AND  users.role     = 'patient'
    )
  );

-- Service role may update notification / claim timestamps.
CREATE POLICY "service_role_update_waitlist"
  ON waitlist
  FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Super admins have full access.
CREATE POLICY "superadmin_all_waitlist"
  ON waitlist
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Optimise promoteWaitlist() lookup: oldest un-notified entry per doctor.
CREATE INDEX IF NOT EXISTS idx_waitlist_doctor_unnotified
  ON waitlist(doctor_id, created_at)
  WHERE notified_at IS NULL;

COMMENT ON TABLE waitlist IS
  'Per-doctor appointment waitlist. When a confirmed appointment is '
  'cancelled the oldest un-notified entry for that doctor is promoted: '
  'notified_at is set, a WhatsApp claim link is sent, and the patient '
  'has until expires_at (2 hours) to confirm.';

COMMENT ON COLUMN waitlist.patient_id IS
  'References users(id) where role = ''patient''. '
  'No separate patients table exists in this schema.';
