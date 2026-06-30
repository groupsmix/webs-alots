-- ============================================================================
-- 00185: Pin the drop of debug_request_headers and the anon-grant
--        reconciliation on admin-only SECURITY DEFINER RPCs.
-- ============================================================================
--
-- Migration 00185 removes an undocumented prod-only function
-- (debug_request_headers) and revokes the stray `anon` EXECUTE grant from four
-- admin RPCs, while preserving each function's intended caller:
--   - execute_admin_query(text)            -> DROPPED in 00200 (replaced by the
--                                             typed admin_* analytics RPCs)
--   - approve_refund(uuid, uuid)           -> authenticated
--   - get_super_admin_dashboard_stats()    -> authenticated
--   - get_all_clinic_signals()             -> service_role ONLY (00169)
--
-- This test pins the resulting privilege state so a regression (re-granting
-- anon, or accidentally stripping a legitimate caller) fails loudly. It also
-- pins a no-regression invariant: the public booking RPC stays anon-callable.
--
-- Run locally with pgTAP (https://pgtap.org/) installed:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/admin_rpc_grants_hardening.test.sql
--
-- Wrapped in a transaction that rolls back; safe to run repeatedly against any
-- database where migration 00185 has been applied.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(11);

-- 1. The undocumented debug function is gone (all overloads).
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'debug_request_headers'
  ),
  'debug_request_headers is fully removed from the public schema'
);

-- 2-5. anon cannot EXECUTE any of the four admin RPCs (any overload).
-- execute_admin_query was DROPPED in 00200, so the strongest invariant is that
-- it no longer exists at all (and therefore is callable by nobody).
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'execute_admin_query'
  ),
  'execute_admin_query has been dropped (superseded by the parameterized admin_* RPCs in 00200)'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'approve_refund'
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  ),
  'anon cannot EXECUTE approve_refund'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_super_admin_dashboard_stats'
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  ),
  'anon cannot EXECUTE get_super_admin_dashboard_stats'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_all_clinic_signals'
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  ),
  'anon cannot EXECUTE get_all_clinic_signals'
);

-- 6-8. The intended authenticated callers retain EXECUTE.
-- (execute_admin_query is gone; its replacement admin_top_at_risk_clinics must
--  be authenticated-callable instead.)
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'admin_top_at_risk_clinics'
      AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ),
  'authenticated retains EXECUTE on admin_top_at_risk_clinics (replaces execute_admin_query)'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'approve_refund'
      AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ),
  'authenticated retains EXECUTE on approve_refund'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_super_admin_dashboard_stats'
      AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ),
  'authenticated retains EXECUTE on get_super_admin_dashboard_stats'
);

-- 9. service_role retains EXECUTE on get_all_clinic_signals.
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_all_clinic_signals'
      AND has_function_privilege('service_role', p.oid, 'EXECUTE')
  ),
  'service_role retains EXECUTE on get_all_clinic_signals'
);

-- 10. authenticated must NOT regain EXECUTE on get_all_clinic_signals (00169).
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_all_clinic_signals'
      AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ),
  'authenticated does NOT have EXECUTE on get_all_clinic_signals (00169 intent preserved)'
);

-- 11. No-regression: the public booking RPC stays anon-callable.
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'booking_atomic_insert'
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  ),
  'no-regression: anon can still EXECUTE booking_atomic_insert'
);

SELECT * FROM finish();
ROLLBACK;
