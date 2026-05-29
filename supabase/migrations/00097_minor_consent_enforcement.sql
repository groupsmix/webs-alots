-- ============================================================================
-- A200: Minor patient consent enforcement
--
-- Adds:
--   1. is_minor computed flag (generated column) based on date_of_birth
--   2. Index for efficient minor-patient queries
--   3. Comment documenting the guardian consent requirement
--
-- The guardian_user_id and date_of_birth columns were added in migration
-- 00077_audit_hardening_a250.sql. This migration adds the computed flag
-- and supporting indexes for the application-level consent enforcement.
-- ============================================================================

-- Generated column: true when patient is under 18 (Moroccan Law 09-08 majority age)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'is_minor'
  ) THEN
    ALTER TABLE users
      ADD COLUMN is_minor BOOLEAN GENERATED ALWAYS AS (
        date_of_birth IS NOT NULL
        AND date_of_birth > (CURRENT_DATE - INTERVAL '18 years')
      ) STORED;
  END IF;
END $$;

-- Index for querying minor patients efficiently
CREATE INDEX IF NOT EXISTS idx_users_is_minor
  ON users(is_minor)
  WHERE is_minor = true;

COMMENT ON COLUMN users.is_minor IS
  'A200: Computed flag — true when date_of_birth indicates patient is under 18 (Law 09-08 / GDPR Art. 8). Application layer enforces guardian consent for minors.';
