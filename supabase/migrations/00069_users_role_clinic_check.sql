-- =============================================================================
-- Migration 00069: D-08 — Enforce users.role / clinic_id invariant at DB level
--
-- Supersedes the D-08 note in migration 00068 that deferred this invariant to
-- application code. Tenant-isolation invariants belong at the database layer
-- as defense-in-depth: RLS + CHECK together prevent a bug, a rogue service-
-- role script, or a future ORM migration from silently producing rows that
-- violate the cross-tenant contract.
--
-- Invariant enforced:
--   * role = 'super_admin'                                → clinic_id IS NULL
--   * role IN ('clinic_admin','receptionist','doctor')    → clinic_id IS NOT NULL
--   * role = 'patient'                                    → clinic_id may be
--       NULL (self-signup before clinic assignment) or NOT NULL (booked/staff-
--       created). This carve-out is required by the hardened handle_new_auth_user
--       trigger (migration 00068 §S-03) which creates self-signup users as
--       (role='patient', clinic_id=NULL) before any clinic context exists.
--
-- Prior D-08 concern re-evaluated:
--   * "super_admin may temporarily have clinic_id set for impersonation" —
--     FALSE in the current code. Impersonation is implemented via httpOnly
--     cookies (`sa_impersonate_clinic_id`) in src/app/api/impersonate/route.ts;
--     the super_admin's users row is never mutated.
-- =============================================================================

BEGIN;

-- 1. Defensive backfill: clear any stray clinic_id on super_admin rows so the
--    VALIDATE step below succeeds on legacy data. No-op on a clean database.
UPDATE users
SET clinic_id = NULL
WHERE role = 'super_admin'
  AND clinic_id IS NOT NULL;

-- 2. Fail fast with a clear error if any staff row is missing a clinic_id.
--    We refuse to silently assign these to a clinic — the operator must
--    triage them before re-running the migration.
DO $$
DECLARE
  v_violations INT;
BEGIN
  SELECT COUNT(*) INTO v_violations
  FROM users
  WHERE role IN ('clinic_admin', 'receptionist', 'doctor')
    AND clinic_id IS NULL;

  IF v_violations > 0 THEN
    RAISE EXCEPTION
      'D-08: Found % staff users (clinic_admin/receptionist/doctor) with clinic_id IS NULL. '
      'Fix these rows before enforcing users_role_clinic_id_valid.',
      v_violations
      USING ERRCODE = 'check_violation';
  END IF;
END $$;

-- 3. Add the CHECK constraint itself (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_role_clinic_id_valid'
      AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_role_clinic_id_valid
      CHECK (
        (role = 'super_admin' AND clinic_id IS NULL)
        OR (role = 'patient')
        OR (role IN ('clinic_admin', 'receptionist', 'doctor')
            AND clinic_id IS NOT NULL)
      );
    RAISE NOTICE 'D-08: Added users_role_clinic_id_valid CHECK constraint';
  END IF;
END $$;

-- 4. Refresh the table comment so future auditors see the DB-level enforcement.
COMMENT ON TABLE users IS
  'D-08 (enforced in 00069 via users_role_clinic_id_valid): '
  'super_admin.clinic_id must be NULL; '
  'clinic_admin/receptionist/doctor.clinic_id must be NOT NULL; '
  'patient.clinic_id may be NULL (self-signup pre-assignment) or NOT NULL.';

COMMIT;
