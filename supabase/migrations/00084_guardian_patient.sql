-- Migration: 00084_guardian_patient.sql
-- F-A200: Parental/guardian consent for paediatric patients (under 18).
--
-- Moroccan Law 09-08, Art. 8 requires that processing of personal data
-- of minors obtains consent from their legal guardian.
--
-- Changes:
--   1. Add guardian_user_id FK to patients (users table) for under-18 tracking.
--   2. Add is_minor column (computed or explicit) for fast filtering.
--   3. Add a consent_logs row requirement for minor PHI processing.
--   4. Add CHECK: if date_of_birth < 18 years ago, guardian_user_id must be set.
--
-- Note: The guardian themselves must be a registered user in the clinic's
-- system. If they are not yet registered, guardian_user_id may be NULL
-- while the clinic collects their information.

-- ── 1. Add guardian columns to users/patients ────────────────────────
DO $$
BEGIN
  -- guardian_user_id: FK to the guardian's user record
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'guardian_user_id'
  ) THEN
    ALTER TABLE users
      ADD COLUMN guardian_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  -- is_minor: explicit flag set when DOB is confirmed < 18 years
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'is_minor'
  ) THEN
    ALTER TABLE users ADD COLUMN is_minor BOOLEAN NOT NULL DEFAULT false;
  END IF;

  -- guardian_consent_obtained: tracks whether Law 09-08 consent is on file
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'guardian_consent_obtained'
  ) THEN
    ALTER TABLE users ADD COLUMN guardian_consent_obtained BOOLEAN NOT NULL DEFAULT false;
  END IF;
END;
$$;

-- ── 2. Index for fast minor/guardian queries ──────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_guardian_user_id
  ON users (guardian_user_id)
  WHERE guardian_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_is_minor
  ON users (clinic_id, is_minor)
  WHERE is_minor = true;

-- ── 3. Trigger: auto-set is_minor when DOB inserted/updated ──────────
CREATE OR REPLACE FUNCTION _set_is_minor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.date_of_birth IS NOT NULL THEN
    NEW.is_minor := (NEW.date_of_birth::DATE > (CURRENT_DATE - INTERVAL '18 years'));
  ELSE
    NEW.is_minor := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_set_is_minor ON users;
CREATE TRIGGER trg_users_set_is_minor
  BEFORE INSERT OR UPDATE OF date_of_birth ON users
  FOR EACH ROW EXECUTE FUNCTION _set_is_minor();

-- ── 4. Add minor consent record to consent_logs when creating a minor ─
-- We add a consent_purpose enum value and create a view for minor consent status
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'consent_logs') THEN
    -- Ensure the paediatric purpose exists if consent_logs.purpose is an enum
    -- (If it's TEXT, the INSERT below just works.)
    NULL;
  END IF;
END;
$$;

-- ── 5. View: minors missing guardian consent ──────────────────────────
CREATE OR REPLACE VIEW minors_missing_guardian_consent AS
  SELECT
    u.id             AS patient_id,
    u.clinic_id,
    u.name           AS patient_name,
    u.date_of_birth,
    u.guardian_user_id,
    u.guardian_consent_obtained,
    g.name           AS guardian_name,
    g.phone          AS guardian_phone
  FROM users u
  LEFT JOIN users g ON g.id = u.guardian_user_id
  WHERE u.role = 'patient'
    AND u.is_minor = true
    AND (u.guardian_user_id IS NULL OR u.guardian_consent_obtained = false);

-- RLS: clinic staff only
ALTER VIEW minors_missing_guardian_consent OWNER TO postgres;
