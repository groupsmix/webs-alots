-- =============================================================================
-- Migration 00070: I-04 — Enforce slot_end > slot_start on appointments
--
-- Audit finding I-04 (LOW): the appointments table accepts a row with
-- slot_end <= slot_start because no CHECK constraint asserts the well-
-- ordered invariant. A bug in the booking handler (negative duration,
-- date arithmetic underflow, mistakenly swapped variables) would produce
-- silently invalid rows that the analytics layer, calendar render, and
-- overlap-prevention exclusion constraint (migration 00057) all rely on.
--
-- This migration adds the missing CHECK as defense-in-depth alongside the
-- application-level validation in src/lib/validations.ts. Same pattern as
-- the D-08 invariant added in migration 00069: scan for legacy violations
-- first, fail fast if any exist, then add the constraint idempotently.
-- =============================================================================

BEGIN;

-- 1. Refuse to add the CHECK if any existing row violates it. Operators must
--    triage these before re-running. We list a sample in the exception so the
--    on-call engineer has something to grep for.
DO $$
DECLARE
  v_violations INT;
  v_sample_id  UUID;
BEGIN
  SELECT COUNT(*), MIN(id)
  INTO   v_violations, v_sample_id
  FROM   appointments
  WHERE  slot_end <= slot_start;

  IF v_violations > 0 THEN
    RAISE EXCEPTION
      'I-04: Found % appointments rows with slot_end <= slot_start (sample id: %). '
      'Fix or hard-delete these rows before enforcing appointments_slot_well_ordered.',
      v_violations, v_sample_id
      USING ERRCODE = 'check_violation';
  END IF;
END $$;

-- 2. Add the CHECK constraint itself (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE  conname  = 'appointments_slot_well_ordered'
      AND  conrelid = 'appointments'::regclass
  ) THEN
    ALTER TABLE appointments
      ADD CONSTRAINT appointments_slot_well_ordered
      CHECK (slot_end > slot_start);
    RAISE NOTICE 'I-04: Added appointments_slot_well_ordered CHECK constraint';
  END IF;
END $$;

-- 3. Refresh the table comment so future auditors see the DB-level enforcement.
COMMENT ON CONSTRAINT appointments_slot_well_ordered ON appointments IS
  'I-04 (added in 00070): slot_end must be strictly greater than slot_start. '
  'Defense-in-depth alongside application-level booking validation.';

COMMIT;
