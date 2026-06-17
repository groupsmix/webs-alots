-- ============================================================================
-- 00186: Pin the service_role-only lockdown of maintenance / cron
--        SECURITY DEFINER functions.
-- ============================================================================
--
-- Migration 00186 revokes the implicit PUBLIC/anon/authenticated EXECUTE grant
-- from five SECURITY DEFINER maintenance functions and grants EXECUTE to
-- service_role only:
--   - claim_notification_batch(integer)       (PHI/DoS: SETOF notification_queue)
--   - try_cron_advisory_lock(text)
--   - cleanup_expired_rate_limit_entries()
--   - expire_stale_refund_requests()
--   - refresh_ai_usage_monthly()
--
-- These run exclusively as pg_cron / service-role jobs and must never be
-- reachable from a browser session. This test pins the privilege state so a
-- regression (Postgres' default PUBLIC grant re-exposing them, or an explicit
-- re-grant) fails loudly. It also pins a no-regression invariant: the public
-- booking RPC stays anon-callable.
--
-- Run locally with pgTAP (https://pgtap.org/) installed:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/cron_fns_service_role_lockdown.test.sql
--
-- Wrapped in a transaction that rolls back; safe to run repeatedly against any
-- database where migration 00186 has been applied.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(16);

-- 1-5. anon cannot EXECUTE any overload of the five cron functions.
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'claim_notification_batch'
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  ),
  'anon cannot EXECUTE claim_notification_batch'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'try_cron_advisory_lock'
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  ),
  'anon cannot EXECUTE try_cron_advisory_lock'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'cleanup_expired_rate_limit_entries'
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  ),
  'anon cannot EXECUTE cleanup_expired_rate_limit_entries'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'expire_stale_refund_requests'
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  ),
  'anon cannot EXECUTE expire_stale_refund_requests'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'refresh_ai_usage_monthly'
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  ),
  'anon cannot EXECUTE refresh_ai_usage_monthly'
);

-- 6-10. authenticated cannot EXECUTE any overload either (service_role only).
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'claim_notification_batch'
      AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ),
  'authenticated cannot EXECUTE claim_notification_batch (PHI leak path closed)'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'try_cron_advisory_lock'
      AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ),
  'authenticated cannot EXECUTE try_cron_advisory_lock'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'cleanup_expired_rate_limit_entries'
      AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ),
  'authenticated cannot EXECUTE cleanup_expired_rate_limit_entries'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'expire_stale_refund_requests'
      AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ),
  'authenticated cannot EXECUTE expire_stale_refund_requests'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'refresh_ai_usage_monthly'
      AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ),
  'authenticated cannot EXECUTE refresh_ai_usage_monthly'
);

-- 11-15. service_role retains EXECUTE on every cron function (cron path intact).
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'claim_notification_batch'
      AND has_function_privilege('service_role', p.oid, 'EXECUTE')
  ),
  'service_role retains EXECUTE on claim_notification_batch'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'try_cron_advisory_lock'
      AND has_function_privilege('service_role', p.oid, 'EXECUTE')
  ),
  'service_role retains EXECUTE on try_cron_advisory_lock'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'cleanup_expired_rate_limit_entries'
      AND has_function_privilege('service_role', p.oid, 'EXECUTE')
  ),
  'service_role retains EXECUTE on cleanup_expired_rate_limit_entries'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'expire_stale_refund_requests'
      AND has_function_privilege('service_role', p.oid, 'EXECUTE')
  ),
  'service_role retains EXECUTE on expire_stale_refund_requests'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'refresh_ai_usage_monthly'
      AND has_function_privilege('service_role', p.oid, 'EXECUTE')
  ),
  'service_role retains EXECUTE on refresh_ai_usage_monthly'
);

-- 16. No-regression: the public booking RPC stays anon-callable.
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
