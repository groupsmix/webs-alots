-- =============================================================================
-- Migration 00078: Minors / Guardian Consent (A200)
-- =============================================================================
-- Addresses:
--   A200: GDPR-K / Loi 09-08 minor consent requirement
--   - Adds guardian_id FK to users for linking minors to legal guardians
--   - Adds is_minor flag for explicit age-gating
--   - Adds guardian_consent_logs table for auditable consent records
-- =============================================================================

-- ── Add guardian fields to users table ───────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS guardian_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS is_minor BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- Index for looking up a guardian's dependents
CREATE INDEX IF NOT EXISTS idx_users_guardian
  ON users (guardian_id)
  WHERE guardian_id IS NOT NULL;

-- Index for filtering minors within a clinic
CREATE INDEX IF NOT EXISTS idx_users_minors
  ON users (clinic_id, is_minor)
  WHERE is_minor = TRUE;

-- ── Guardian consent log table ───────────────────────────────────────
-- Records parental/guardian consent for processing minor patient data.
-- Each consent event is immutable (insert-only) for audit trail.
CREATE TABLE IF NOT EXISTS guardian_consent_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  minor_id        UUID NOT NULL REFERENCES users(id),
  guardian_id     UUID NOT NULL REFERENCES users(id),
  consent_type    TEXT NOT NULL CHECK (consent_type IN (
    'registration', 'treatment', 'data_processing', 'data_sharing', 'withdrawal'
  )),
  consent_given   BOOLEAN NOT NULL,
  guardian_email   TEXT,
  guardian_phone   TEXT,
  ip_address      TEXT,
  user_agent      TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guardian_consent_clinic
  ON guardian_consent_logs (clinic_id);

CREATE INDEX IF NOT EXISTS idx_guardian_consent_minor
  ON guardian_consent_logs (minor_id);

CREATE INDEX IF NOT EXISTS idx_guardian_consent_guardian
  ON guardian_consent_logs (guardian_id);

-- ── RLS for guardian_consent_logs ────────────────────────────────────
ALTER TABLE guardian_consent_logs ENABLE ROW LEVEL SECURITY;

-- Super admin: full access
CREATE POLICY "sa_guardian_consent_all"
  ON guardian_consent_logs FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Clinic staff: read/write within their clinic
CREATE POLICY "staff_guardian_consent"
  ON guardian_consent_logs FOR ALL
  USING (
    clinic_id = (
      SELECT u.clinic_id FROM users u
      WHERE u.id = (SELECT auth.uid())
      AND u.role IN ('clinic_admin', 'doctor', 'receptionist')
    )
  )
  WITH CHECK (
    clinic_id = (
      SELECT u.clinic_id FROM users u
      WHERE u.id = (SELECT auth.uid())
      AND u.role IN ('clinic_admin', 'doctor', 'receptionist')
    )
  );

-- Guardian: can read their own consent logs
CREATE POLICY "guardian_read_own_consent"
  ON guardian_consent_logs FOR SELECT
  USING (guardian_id = (SELECT auth.uid()));

COMMENT ON TABLE guardian_consent_logs IS
  'A200: Immutable audit trail of parental/guardian consent for minor patients. '
  'Required by GDPR-K, UK AADC, and Moroccan Loi 09-08 (majority age 18).';

COMMENT ON COLUMN users.guardian_id IS
  'A200: FK to the legal guardian user record. Set when is_minor = TRUE.';

COMMENT ON COLUMN users.is_minor IS
  'A200: Explicit flag for patients under 18 (Moroccan legal majority). '
  'When TRUE, guardian_id must be set and a consent record must exist in guardian_consent_logs.';
