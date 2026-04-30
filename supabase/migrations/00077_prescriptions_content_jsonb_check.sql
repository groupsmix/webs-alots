-- =============================================================================
-- Migration 00077: A16-06 — prescriptions.content JSONB type enforcement
--
-- A16-06 (LOW): prescriptions.content is typed JSONB but has no DB-level
-- CHECK ensuring the value is a JSON array. Application-level Zod validation
-- enforces this, but a direct SQL INSERT (migration backfill, admin tooling,
-- Supabase dashboard) can insert an object or scalar, which would confuse
-- the prescription renderer and any downstream analytics queries that
-- assume `jsonb_array_elements(content)`.
--
-- This adds a lightweight CHECK that the top-level JSONB type is 'array'
-- (or NULL). It does NOT validate the inner element schema — that remains
-- the responsibility of the Zod schema in src/lib/validations.ts.
-- =============================================================================

BEGIN;

-- 1. Scan for violations so we fail fast with a clear message.
DO $$
DECLARE
  v_violations INT;
BEGIN
  SELECT COUNT(*) INTO v_violations
  FROM   prescriptions
  WHERE  content IS NOT NULL
    AND  jsonb_typeof(content) <> 'array';

  IF v_violations > 0 THEN
    RAISE EXCEPTION
      'A16-06: Found % prescriptions rows where content is not a JSON array. '
      'Correct these rows before enforcing prescriptions_content_is_array.',
      v_violations
      USING ERRCODE = 'check_violation';
  END IF;
END $$;

-- 2. Add the CHECK constraint (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE  conname  = 'prescriptions_content_is_array'
      AND  conrelid = 'prescriptions'::regclass
  ) THEN
    ALTER TABLE prescriptions
      ADD CONSTRAINT prescriptions_content_is_array
      CHECK (content IS NULL OR jsonb_typeof(content) = 'array');
    RAISE NOTICE 'A16-06: Added prescriptions_content_is_array CHECK constraint';
  END IF;
END $$;

COMMENT ON CONSTRAINT prescriptions_content_is_array ON prescriptions IS
  'A16-06 (added in 00077): content must be NULL or a JSON array. '
  'Prevents scalar/object values that would break jsonb_array_elements() '
  'in the prescription renderer and analytics queries.';

COMMIT;
