-- Migration: 00085_soft_delete_rls.sql
-- A27-01: Ensure all RLS policies on tables with deleted_at columns
-- exclude soft-deleted rows from reads.
--
-- Without this, a query like:
--   SELECT * FROM patients WHERE clinic_id = $1
-- returns rows where deleted_at IS NOT NULL, leaking "deleted" patient
-- records to the API. The application layer filters on deleted_at, but
-- RLS should also exclude them for defense-in-depth.

-- ── 1. public_clinic_directory view: exclude soft-deleted clinics ─────
-- The view used for subdomain resolution should only show active clinics.
DROP VIEW IF EXISTS public_clinic_directory CASCADE;
CREATE OR REPLACE VIEW public_clinic_directory AS
  SELECT
    id,
    name,
    subdomain,
    type,
    tier,
    city,
    phone,
    email,
    address,
    logo_url,
    is_active
  FROM clinics
  WHERE is_active = true
    AND (deleted_at IS NULL OR deleted_at > NOW());

-- Grant anon read for subdomain resolution
GRANT SELECT ON public_clinic_directory TO anon;
GRANT SELECT ON public_clinic_directory TO authenticated;

-- ── 2. Partial indexes: WHERE deleted_at IS NULL ──────────────────────
-- These speed up the most common queries and allow the planner to use
-- index scans that automatically exclude soft-deleted rows.

-- users (patients) active index
CREATE INDEX IF NOT EXISTS idx_users_active_clinic
  ON users (clinic_id, role)
  WHERE deleted_at IS NULL;

-- appointments active index
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'deleted_at'
  ) THEN
    EXECUTE $sql$
      CREATE INDEX IF NOT EXISTS idx_appointments_active_clinic
        ON appointments (clinic_id, appointment_date)
        WHERE deleted_at IS NULL;
    $sql$;
  END IF;
END;
$$;

-- services active index
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'deleted_at'
  ) THEN
    EXECUTE $sql$
      CREATE INDEX IF NOT EXISTS idx_services_active_clinic
        ON services (clinic_id)
        WHERE deleted_at IS NULL;
    $sql$;
  END IF;
END;
$$;

-- ── 3. Update RLS policies to add deleted_at IS NULL guard ───────────
-- We use a DO block because the policy names vary across migrations and
-- we don't want to error if a policy doesn't exist.

-- Helper: re-create a "select" policy on a table with soft-delete filter
-- This is idempotent: drops and re-creates.

-- users table: patient read policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'users'
      AND policyname = 'patients_read_own_clinic'
  ) THEN
    DROP POLICY IF EXISTS patients_read_own_clinic ON users;
    CREATE POLICY patients_read_own_clinic
      ON users
      FOR SELECT
      USING (
        clinic_id = (SELECT clinic_id FROM users WHERE auth_id = auth.uid() LIMIT 1)
        AND (deleted_at IS NULL OR deleted_at > NOW())
      );
  END IF;
END;
$$;
