-- ============================================================================
-- A200: Minor patient consent enforcement
--
-- Adds:
--   1. is_minor helper function (immutable approximation using age at INSERT)
--   2. Trigger to keep is_minor in sync on date_of_birth changes
--   3. Index for efficient minor-patient queries
--   4. Comment documenting the guardian consent requirement
--
-- The guardian_user_id and date_of_birth columns were added in migration
-- 00077_audit_hardening_a250.sql. This migration adds the is_minor flag
-- and supporting indexes for the application-level consent enforcement.
--
-- Note: GENERATED ALWAYS AS cannot use CURRENT_DATE (not immutable in PG).
-- We use a regular boolean column + trigger instead.
-- ============================================================================

-- Add is_minor column as a regular boolean (not generated)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'is_minor'
  ) THEN
    ALTER TABLE users ADD COLUMN is_minor BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Backfill existing rows that have date_of_birth set
UPDATE users
SET is_minor = (
  date_of_birth IS NOT NULL
  AND date_of_birth > (CURRENT_DATE - INTERVAL '18 years')
)
WHERE date_of_birth IS NOT NULL;

-- Trigger function: recalculate is_minor on INSERT or UPDATE of date_of_birth
CREATE OR REPLACE FUNCTION fn_set_is_minor()
RETURNS TRIGGER AS $$
BEGIN
  NEW.is_minor := (
    NEW.date_of_birth IS NOT NULL
    AND NEW.date_of_birth > (CURRENT_DATE - INTERVAL '18 years')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger
DROP TRIGGER IF EXISTS trg_set_is_minor ON users;
CREATE TRIGGER trg_set_is_minor
  BEFORE INSERT OR UPDATE OF date_of_birth ON users
  FOR EACH ROW
  EXECUTE FUNCTION fn_set_is_minor();

-- Index for querying minor patients efficiently
CREATE INDEX IF NOT EXISTS idx_users_is_minor
  ON users(is_minor)
  WHERE is_minor = true;

COMMENT ON COLUMN users.is_minor IS
  'A200: Boolean flag — true when date_of_birth indicates patient is under 18 (Law 09-08 / GDPR Art. 8). Maintained by trg_set_is_minor trigger. Application layer enforces guardian consent for minors.';
