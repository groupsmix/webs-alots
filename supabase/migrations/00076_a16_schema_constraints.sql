-- =============================================================================
-- Migration 00076: A16 — Schema review remediation (A16-04, A16-05)
--
-- A16-04 (MEDIUM): services.price has no CHECK preventing negative values.
-- A16-05 (MEDIUM): time_slots is missing a UNIQUE on
--                  (doctor_id, day_of_week, start_time), so the same slot
--                  can be inserted twice and the booking flow's "first
--                  available" lookup becomes non-deterministic.
--
-- A16-03 (slot_end > slot_start) was previously enforced in 00070 and is
-- intentionally not duplicated here.
--
-- Same defensive pattern as 00070: scan for legacy violations first so we
-- fail fast with a clear message instead of leaving the operator with an
-- opaque ALTER TABLE error.
-- =============================================================================

BEGIN;

-- ── A16-04: services.price >= 0 ────────────────────────────────────────────
DO $$
DECLARE
  v_violations INT;
BEGIN
  SELECT COUNT(*) INTO v_violations FROM services WHERE price < 0;
  IF v_violations > 0 THEN
    RAISE EXCEPTION
      'A16-04: Found % services rows with price < 0. '
      'Correct or null these rows before enforcing services_price_non_negative.',
      v_violations
      USING ERRCODE = 'check_violation';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE  conname  = 'services_price_non_negative'
      AND  conrelid = 'services'::regclass
  ) THEN
    ALTER TABLE services
      ADD CONSTRAINT services_price_non_negative
      CHECK (price IS NULL OR price >= 0);
    RAISE NOTICE 'A16-04: Added services_price_non_negative CHECK constraint';
  END IF;
END $$;

COMMENT ON CONSTRAINT services_price_non_negative ON services IS
  'A16-04 (added in 00076): price must be NULL or non-negative. '
  'Prevents accidental negative pricing from billing/import bugs.';

-- ── A16-05: UNIQUE (doctor_id, day_of_week, start_time) on time_slots ──────
-- A duplicate row with the same (doctor, day, start_time) silently
-- shadows the original — the booking flow's `.eq().limit(1)` lookup picks
-- whichever the planner returns first, so an admin importing a duplicate
-- effectively rewrites availability for that doctor.
DO $$
DECLARE
  v_dupes INT;
BEGIN
  SELECT COUNT(*) INTO v_dupes FROM (
    SELECT 1
    FROM   time_slots
    GROUP  BY doctor_id, day_of_week, start_time
    HAVING COUNT(*) > 1
  ) dupes;

  IF v_dupes > 0 THEN
    RAISE EXCEPTION
      'A16-05: Found % duplicate (doctor_id, day_of_week, start_time) groups in time_slots. '
      'Deduplicate via supabase/migrations data scripts before enforcing the UNIQUE index.',
      v_dupes
      USING ERRCODE = 'unique_violation';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE  indexname = 'time_slots_doctor_day_start_unique'
  ) THEN
    CREATE UNIQUE INDEX time_slots_doctor_day_start_unique
      ON time_slots (doctor_id, day_of_week, start_time);
    RAISE NOTICE 'A16-05: Created UNIQUE index time_slots_doctor_day_start_unique';
  END IF;
END $$;

COMMENT ON INDEX time_slots_doctor_day_start_unique IS
  'A16-05 (added in 00076): prevents two time_slots rows for the same '
  'doctor/day-of-week/start-time, which would otherwise cause '
  'non-deterministic availability lookups in the booking flow.';

COMMIT;
