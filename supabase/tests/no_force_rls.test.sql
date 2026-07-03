-- ============================================================================
-- ADR-0011: FORCE ROW LEVEL SECURITY must never be enabled on public tables.
-- ============================================================================
--
-- Tenant isolation in this database is built on SECURITY DEFINER functions that
-- read ACROSS the RLS boundary using the table owner's RLS bypass:
--
--   * get_user_clinic_id() / get_user_role() / is_clinic_staff() — the helpers
--     that the `users` policies (admin_users_all, doctor_users_select, …)
--     themselves call. They are SECURITY DEFINER precisely so their read of
--     `users` does NOT re-trigger `users`' own policies.
--   * booking_atomic_insert() — SECURITY DEFINER, granted to `anon`; validates
--     doctor/service/patient ↔ clinic by reading users/services directly.
--
-- `ALTER TABLE … FORCE ROW LEVEL SECURITY` removes exactly that owner bypass.
-- With FORCE on:
--   * booking_atomic_insert's validation reads return 0 rows for an anon caller
--     → INVALID_TENANT → every public booking fails. (Minimal repro: an
--     identical SECURITY DEFINER probe returns 1 without FORCE and 0 with it.)
--   * the RLS helpers' read of `users` becomes subject to `users`' policies,
--     which call the helpers again → infinite recursion / empty → staff and
--     admins are locked out of their own rows.
-- FORCE closes nothing: anon/authenticated are already fully subject to RLS
-- without it, and service_role bypasses via the BYPASSRLS role attribute, which
-- FORCE does not touch. Full rationale: docs/adr/0011-no-force-rls.md.
--
-- This test pins the *structural* invariant rather than toggling FORCE live:
-- the breakage only reproduces where the table owner (postgres) is not a
-- superuser (Supabase cloud). On the local `supabase start` stack postgres is a
-- superuser and bypasses RLS even under FORCE, so a live toggle would not
-- reproduce it. The grep guard in .github/workflows/ci.yml is the always-on
-- companion to this test.
--
-- The `rls` CI job runs this with `psql -f` (not pg_prove), where a pgTAP
-- `not ok` does NOT set a non-zero exit code. The load-bearing assertions are
-- therefore ALSO re-stated as hard RAISEs under ON_ERROR_STOP so a regression
-- fails the build, not just the TAP log.
--
-- Run locally:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/no_force_rls.test.sql
-- ============================================================================

\set ON_ERROR_STOP on

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(3);

-- 1. No public BASE table may have FORCE ROW LEVEL SECURITY enabled.
SELECT is(
  (SELECT count(*)::int
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relforcerowsecurity),
  0,
  'no public table has FORCE ROW LEVEL SECURITY enabled (ADR-0011)'
);

-- 2. RLS stays ENABLED on the core PHI / tenant tables — guards the opposite
--    regression (someone "fixing" the advisor flag by disabling RLS entirely).
SELECT is(
  (SELECT count(*)::int
     FROM (VALUES ('users'),('clinics'),('appointments'),('payments'),
                  ('medical_records'),('prescriptions'),('consultation_notes'),
                  ('clinic_whatsapp_credentials')
          ) AS t(rel)
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = t.rel AND c.relrowsecurity
    )),
  0,
  'RLS is enabled on every core PHI/tenant table'
);

-- 3. The tenant-critical helpers + booking RPC remain SECURITY DEFINER. If a
--    future change makes them SECURITY INVOKER, the FORCE analysis above no
--    longer holds and ADR-0011 must be revisited.
SELECT is(
  (SELECT count(*)::int
     FROM (VALUES ('get_user_clinic_id'),('get_user_role'),
                  ('is_clinic_staff'),('booking_atomic_insert')
          ) AS t(fn)
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = t.fn AND p.prosecdef
    )),
  0,
  'tenant helpers and booking_atomic_insert are SECURITY DEFINER'
);

SELECT * FROM finish();

-- ── Hard gate ───────────────────────────────────────────────────────────────
-- pgTAP `not ok` does not fail `psql -f`; re-assert the invariants as RAISEs.
DO $$
DECLARE
  v_forced  text;
  v_rls_off text;
  v_invoker text;
BEGIN
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO v_forced
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relforcerowsecurity;
  IF v_forced IS NOT NULL THEN
    RAISE EXCEPTION
      'FORCE ROW LEVEL SECURITY is enabled on public table(s): %. This breaks the SECURITY DEFINER tenant layer (public booking + RLS helpers) and closes neither the anon nor the service_role path. See docs/adr/0011-no-force-rls.md.',
      v_forced;
  END IF;

  SELECT string_agg(t.rel, ', ') INTO v_rls_off
    FROM (VALUES ('users'),('clinics'),('appointments'),('payments'),
                 ('medical_records'),('prescriptions'),('consultation_notes'),
                 ('clinic_whatsapp_credentials')) AS t(rel)
   WHERE NOT EXISTS (
     SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t.rel AND c.relrowsecurity);
  IF v_rls_off IS NOT NULL THEN
    RAISE EXCEPTION
      'RLS is DISABLED on core tenant table(s): %. RLS must stay enabled (ADR-0011).',
      v_rls_off;
  END IF;

  SELECT string_agg(t.fn, ', ') INTO v_invoker
    FROM (VALUES ('get_user_clinic_id'),('get_user_role'),
                 ('is_clinic_staff'),('booking_atomic_insert')) AS t(fn)
   WHERE NOT EXISTS (
     SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = t.fn AND p.prosecdef);
  IF v_invoker IS NOT NULL THEN
    RAISE EXCEPTION
      'Tenant function(s) no longer SECURITY DEFINER: %. Revisit ADR-0011 before changing this.',
      v_invoker;
  END IF;
END $$;

ROLLBACK;
