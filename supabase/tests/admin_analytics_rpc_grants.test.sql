-- ============================================================================
-- 00200: Pin the security posture of the parameterized admin analytics RPCs
--        that replaced the raw-SQL execute_admin_query(text) primitive.
-- ============================================================================
--
-- The five functions below are SECURITY DEFINER (they intentionally bypass RLS
-- to compute platform-wide aggregates), gated internally by is_super_admin(),
-- and must be:
--   * SECURITY DEFINER,
--   * search_path-pinned (defense against search_path shadowing),
--   * executable by `authenticated` (the Super-Admin route uses a user-scoped
--     client; the is_super_admin() check is the authorization boundary),
--   * NOT executable by `anon`.
--
-- A regression that drops the super-admin gate, widens the grant to anon, or
-- removes the pinned search_path should fail loudly here.
--
-- Run locally with pgTAP (https://pgtap.org/) installed:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/admin_analytics_rpc_grants.test.sql
--
-- Wrapped in a transaction that rolls back; safe to run repeatedly against any
-- database where migration 00200 has been applied.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

-- 5 functions x 4 assertions = 20.
SELECT plan(20);

-- 1-5. Each RPC exists and is SECURITY DEFINER.
SELECT ok(
  p.prosecdef,
  format('%s is SECURITY DEFINER', p.proname)
)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = ANY (ARRAY[
    'admin_top_at_risk_clinics',
    'admin_best_performing_clinics',
    'admin_stalled_onboardings',
    'admin_critical_platform_alerts',
    'admin_support_backlog'
  ])
ORDER BY p.proname;

-- 6-10. Each RPC has a pinned search_path.
SELECT ok(
  EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%'),
  format('%s has a pinned search_path', p.proname)
)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = ANY (ARRAY[
    'admin_top_at_risk_clinics',
    'admin_best_performing_clinics',
    'admin_stalled_onboardings',
    'admin_critical_platform_alerts',
    'admin_support_backlog'
  ])
ORDER BY p.proname;

-- 11-15. anon must NOT be able to EXECUTE any RPC.
SELECT ok(
  NOT has_function_privilege('anon', p.oid, 'EXECUTE'),
  format('anon cannot EXECUTE %s', p.proname)
)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = ANY (ARRAY[
    'admin_top_at_risk_clinics',
    'admin_best_performing_clinics',
    'admin_stalled_onboardings',
    'admin_critical_platform_alerts',
    'admin_support_backlog'
  ])
ORDER BY p.proname;

-- 16-20. authenticated must be able to EXECUTE each RPC.
SELECT ok(
  has_function_privilege('authenticated', p.oid, 'EXECUTE'),
  format('authenticated can EXECUTE %s', p.proname)
)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = ANY (ARRAY[
    'admin_top_at_risk_clinics',
    'admin_best_performing_clinics',
    'admin_stalled_onboardings',
    'admin_critical_platform_alerts',
    'admin_support_backlog'
  ])
ORDER BY p.proname;

SELECT * FROM finish();
ROLLBACK;
