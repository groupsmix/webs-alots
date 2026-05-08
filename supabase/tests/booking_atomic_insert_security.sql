-- ============================================================================
-- Task 3.2: RPC Regression Tests (A2-03) - Phase 3 Security Fixes
-- ============================================================================
--
-- This test verifies that the booking_atomic_insert RPC enforces cross-tenant
-- validation for doctor_id, service_id, and patient_id. The RPC is SECURITY
-- DEFINER and granted to `anon`, so it bypasses RLS. Without these checks,
-- any unauthenticated client could insert bookings across tenant boundaries.
--
-- Run locally with pgTAP:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/booking_atomic_insert_security.sql
--
-- This test wraps everything in a transaction that rolls back, so it is safe
-- to run repeatedly against any database.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(3);

-- ----------------------------------------------------------------------------
-- Test Data Setup: Create two isolated clinics with their own resources
-- ----------------------------------------------------------------------------
INSERT INTO clinics (id, name, type)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Clinic A Security Test', 'doctor'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Clinic B Security Test', 'doctor');

INSERT INTO users (id, role, name, clinic_id)
VALUES
  ('a0000001-0000-0000-0000-000000000001', 'doctor',  'Doctor A',  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('a0000002-0000-0000-0000-000000000002', 'patient', 'Patient A', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('b0000001-0000-0000-0000-000000000001', 'doctor',  'Doctor B',  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  ('b0000002-0000-0000-0000-000000000002', 'patient', 'Patient B', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

INSERT INTO services (id, clinic_id, name, duration_minutes)
VALUES
  ('a0000003-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Service A', 30),
  ('b0000003-0000-0000-0000-000000000003', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Service B', 30);

-- ----------------------------------------------------------------------------
-- Test 1: Cross-Tenant Doctor Rejection
-- Call booking_atomic_insert with doctor_id from Clinic B and clinic_id for
-- Clinic A. The RPC must reject this with INVALID_TENANT error.
-- ----------------------------------------------------------------------------
SELECT throws_like(
  $$ SELECT public.booking_atomic_insert(
       'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,    -- clinic_id: Clinic A
       'a0000002-0000-0000-0000-000000000002'::uuid,    -- patient_id: Patient A (valid)
       'b0000001-0000-0000-0000-000000000001'::uuid,    -- doctor_id: Doctor B (CROSS-TENANT)
       'a0000003-0000-0000-0000-000000000003'::uuid,    -- service_id: Service A (valid)
       '2099-06-01'::date,
       '10:00', '10:30',
       '2099-06-01T10:00:00Z', '2099-06-01T10:30:00Z',
       'pending', false, false, 'online', NULL, false, 1
     ) $$,
  '%INVALID_TENANT: doctor%',
  'booking_atomic_insert rejects doctor_id from different clinic'
);

-- ----------------------------------------------------------------------------
-- Test 2: Cross-Tenant Service Rejection
-- Call booking_atomic_insert with service_id from Clinic B and clinic_id for
-- Clinic A. The RPC must reject this with INVALID_TENANT error.
-- ----------------------------------------------------------------------------
SELECT throws_like(
  $$ SELECT public.booking_atomic_insert(
       'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,    -- clinic_id: Clinic A
       'a0000002-0000-0000-0000-000000000002'::uuid,    -- patient_id: Patient A (valid)
       'a0000001-0000-0000-0000-000000000001'::uuid,    -- doctor_id: Doctor A (valid)
       'b0000003-0000-0000-0000-000000000003'::uuid,    -- service_id: Service B (CROSS-TENANT)
       '2099-06-01'::date,
       '10:00', '10:30',
       '2099-06-01T10:00:00Z', '2099-06-01T10:30:00Z',
       'pending', false, false, 'online', NULL, false, 1
     ) $$,
  '%INVALID_TENANT: service%',
  'booking_atomic_insert rejects service_id from different clinic'
);

-- ----------------------------------------------------------------------------
-- Test 3: Cross-Tenant Patient Rejection
-- Call booking_atomic_insert with patient_id from Clinic B and clinic_id for
-- Clinic A. The RPC must reject this with INVALID_TENANT error.
-- ----------------------------------------------------------------------------
SELECT throws_like(
  $$ SELECT public.booking_atomic_insert(
       'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,    -- clinic_id: Clinic A
       'b0000002-0000-0000-0000-000000000002'::uuid,    -- patient_id: Patient B (CROSS-TENANT)
       'a0000001-0000-0000-0000-000000000001'::uuid,    -- doctor_id: Doctor A (valid)
       'a0000003-0000-0000-0000-000000000003'::uuid,    -- service_id: Service A (valid)
       '2099-06-01'::date,
       '10:00', '10:30',
       '2099-06-01T10:00:00Z', '2099-06-01T10:30:00Z',
       'pending', false, false, 'online', NULL, false, 1
     ) $$,
  '%INVALID_TENANT: patient%',
  'booking_atomic_insert rejects patient_id from different clinic'
);

SELECT * FROM finish();

ROLLBACK;
