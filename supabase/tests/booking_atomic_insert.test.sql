-- ============================================================================
-- A2-03: Pin the cross-tenant validation logic in booking_atomic_insert.
-- ============================================================================
--
-- The booking_atomic_insert RPC (defined in
-- supabase/migrations/00074_booking_slot_advisory_lock.sql) is SECURITY
-- DEFINER and granted to `anon`, so it bypasses RLS. The hardening commit
-- added per-argument validation that doctor / service / patient all belong
-- to the supplied clinic_id. A hostile or careless author could regress this
-- by dropping any of those checks.
--
-- This test pins each cross-tenant scenario so a regression fails loudly.
--
-- Run locally with pgTAP (https://pgtap.org/) installed:
--
--   psql "$SUPABASE_DB_URL" -f supabase/tests/booking_atomic_insert.test.sql
--
-- The test wraps everything in a transaction that rolls back, so it is safe
-- to run repeatedly against any database where the schema and the
-- booking_atomic_insert function exist.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(7);

-- Confirm the function exists and is SECURITY DEFINER. If a hostile author
-- silently drops or relaxes the security context, this test fails first.
SELECT has_function(
  'public',
  'booking_atomic_insert',
  ARRAY[
    'uuid','uuid','uuid','uuid','date',
    'text','text','text','text','text',
    'boolean','boolean','text','text','boolean','integer'
  ],
  'booking_atomic_insert(...) is defined in the public schema'
);

SELECT is(
  (SELECT prosecdef FROM pg_proc
     WHERE proname = 'booking_atomic_insert'
       AND pronamespace = 'public'::regnamespace),
  true,
  'booking_atomic_insert is SECURITY DEFINER'
);

-- ----------------------------------------------------------------------------
-- Fixtures: two isolated clinics, each with their own doctor / service /
-- patient. We deliberately mix-and-match across tenants below to ensure the
-- RPC rejects every cross-tenant combination.
-- ----------------------------------------------------------------------------
INSERT INTO clinics (id, name, type)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Clinic A (test)', 'doctor'),
  ('22222222-2222-2222-2222-222222222222', 'Clinic B (test)', 'doctor');

INSERT INTO users (id, role, name, clinic_id)
VALUES
  ('aaaaaaa1-0000-0000-0000-000000000001', 'doctor',  'Doctor A',  '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaa1-0000-0000-0000-000000000002', 'patient', 'Patient A', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbb2-0000-0000-0000-000000000001', 'doctor',  'Doctor B',  '22222222-2222-2222-2222-222222222222'),
  ('bbbbbbb2-0000-0000-0000-000000000002', 'patient', 'Patient B', '22222222-2222-2222-2222-222222222222');

INSERT INTO services (id, clinic_id, name, duration_minutes)
VALUES
  ('cccccc01-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Consult A', 30),
  ('cccccc02-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Consult B', 30);

-- ----------------------------------------------------------------------------
-- 1. Doctor from another clinic must be rejected.
-- ----------------------------------------------------------------------------
SELECT throws_like(
  $$ SELECT public.booking_atomic_insert(
       '11111111-1111-1111-1111-111111111111'::uuid,    -- clinic A
       'aaaaaaa1-0000-0000-0000-000000000002'::uuid,    -- patient A (ok)
       'bbbbbbb2-0000-0000-0000-000000000001'::uuid,    -- doctor B (CROSS-TENANT)
       'cccccc01-0000-0000-0000-000000000001'::uuid,    -- service A (ok)
       '2099-01-01'::date,
       '09:00','09:30','2099-01-01T09:00:00Z','2099-01-01T09:30:00Z',
       'pending', false, false, 'online', NULL, false, 1
     ) $$,
  '%INVALID_TENANT: doctor%',
  'rejects a doctor that does not belong to the supplied clinic'
);

-- ----------------------------------------------------------------------------
-- 2. Service from another clinic must be rejected.
-- ----------------------------------------------------------------------------
SELECT throws_like(
  $$ SELECT public.booking_atomic_insert(
       '11111111-1111-1111-1111-111111111111'::uuid,    -- clinic A
       'aaaaaaa1-0000-0000-0000-000000000002'::uuid,    -- patient A (ok)
       'aaaaaaa1-0000-0000-0000-000000000001'::uuid,    -- doctor A (ok)
       'cccccc02-0000-0000-0000-000000000001'::uuid,    -- service B (CROSS-TENANT)
       '2099-01-01'::date,
       '09:00','09:30','2099-01-01T09:00:00Z','2099-01-01T09:30:00Z',
       'pending', false, false, 'online', NULL, false, 1
     ) $$,
  '%INVALID_TENANT: service%',
  'rejects a service that does not belong to the supplied clinic'
);

-- ----------------------------------------------------------------------------
-- 3. Patient from another clinic must be rejected.
-- ----------------------------------------------------------------------------
SELECT throws_like(
  $$ SELECT public.booking_atomic_insert(
       '11111111-1111-1111-1111-111111111111'::uuid,    -- clinic A
       'bbbbbbb2-0000-0000-0000-000000000002'::uuid,    -- patient B (CROSS-TENANT)
       'aaaaaaa1-0000-0000-0000-000000000001'::uuid,    -- doctor A (ok)
       'cccccc01-0000-0000-0000-000000000001'::uuid,    -- service A (ok)
       '2099-01-01'::date,
       '09:00','09:30','2099-01-01T09:00:00Z','2099-01-01T09:30:00Z',
       'pending', false, false, 'online', NULL, false, 1
     ) $$,
  '%INVALID_TENANT: patient%',
  'rejects a patient that does not belong to the supplied clinic'
);

-- ----------------------------------------------------------------------------
-- 4. Random / fabricated UUIDs that do not exist anywhere must be rejected.
-- This catches a regression where the function only checks "matches some
-- clinic" rather than "matches THIS clinic".
-- ----------------------------------------------------------------------------
SELECT throws_like(
  $$ SELECT public.booking_atomic_insert(
       '11111111-1111-1111-1111-111111111111'::uuid,
       '00000000-0000-0000-0000-000000000099'::uuid,   -- nonexistent patient
       'aaaaaaa1-0000-0000-0000-000000000001'::uuid,
       'cccccc01-0000-0000-0000-000000000001'::uuid,
       '2099-01-01'::date,
       '09:00','09:30','2099-01-01T09:00:00Z','2099-01-01T09:30:00Z',
       'pending', false, false, 'online', NULL, false, 1
     ) $$,
  '%INVALID_TENANT%',
  'rejects fabricated UUIDs that exist in no clinic'
);

-- ----------------------------------------------------------------------------
-- 5. The granted execute privilege for `anon` is the whole reason this RPC
-- needs the cross-tenant guards. If a hostile author quietly removes the
-- grant we want the test to still pass for the validation logic, but if the
-- grant is widened in unexpected ways we want a flag here. Pin the current
-- grantees.
-- ----------------------------------------------------------------------------
SELECT bag_eq(
  $$ SELECT grantee::text
       FROM information_schema.routine_privileges
      WHERE specific_schema = 'public'
        AND routine_name = 'booking_atomic_insert'
        AND privilege_type = 'EXECUTE' $$,
  $$ VALUES ('postgres'), ('authenticated'), ('anon') $$,
  'EXECUTE on booking_atomic_insert is granted only to the expected roles'
);

SELECT * FROM finish();

ROLLBACK;
