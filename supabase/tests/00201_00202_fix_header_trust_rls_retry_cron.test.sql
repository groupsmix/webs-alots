-- ============================================================================
-- 00201 / 00202: Pin the PR #1219 security fixes + bugfix migrations.
-- ============================================================================
--
-- PR #1219 (commit 2d84d2ad) delivered two migrations:
--
--   00201 — Rebind PHI/business RLS from attacker-controllable
--           get_request_clinic_id() to JWT-derived get_user_clinic_id().
--           Also: lock ai_traces INSERT to service_role; fix admin predicates
--           that compared users.id = auth.uid() (always false) -> users.auth_id.
--
--   00202 — Add the missing pg_cron worker retry_pending_document_extractions
--           and its schedule, so 'pending' extraction rows are re-processed.
--
-- This test pins the structural invariants the fix established. A regression
-- that drops the new policies, re-exposes ai_traces INSERT, reverts to
-- get_request_clinic_id(), damages the admin predicate fix, or drops the cron
-- function/schedule will fail loudly.
--
-- Run locally with pgTAP (https://pgtap.org/) installed:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/00201_00202_fix_header_trust_rls_retry_cron.test.sql
--
-- Wrapped in a transaction that rolls back; safe to run repeatedly.

\set ON_ERROR_STOP on

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

-- ── Plan ─────────────────────────────────────────────────────────────────────
--   1-14:  Each rebound table has a policy referencing get_user_clinic_id()
--   15:    no rebound table still references get_request_clinic_id()
--   16-17: ai_traces INSERT locked to service_role (+ no anon/auth INSERT policy)
--   18:    clinic_ai_briefings super_admin uses is_super_admin() (not users.id)
--   19-21: upload_policies admin policies use users.auth_id = auth.uid()
--   22:    retry_pending_document_extractions(integer) exists
--   23:    retry_pending_document_extractions is SECURITY DEFINER
--   24-26: retry_pending_document_extractions: anon/auth denied, service_role ok
--   27:    retry-document-extractions pg_cron schedule exists
SELECT plan(27);

-- ── Helpers ──────────────────────────────────────────────────────────────────

-- Returns the policy definition body for a given table and policy name.
-- pg_policies.qual is the USING expression; pg_policies.with_check is the
-- WITH CHECK expression. We concat both and test string containment, which is
-- the most robust approach across Postgres versions.
CREATE FUNCTION pg_temp.policy_def(tbl regclass, pol text)
  RETURNS text
  LANGUAGE sql STABLE
AS $f$
  SELECT coalesce(qual, '') || ' ' || coalesce(with_check, '')
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = (SELECT c.relname FROM pg_class c WHERE c.oid = tbl)
    AND policyname = pol
$f$;

-- Shortcut: assert a policy on table 't' named 'p' contains string 's'.
CREATE FUNCTION pg_temp.policy_contains(tbl regclass, pol text, needle text)
  RETURNS text
  LANGUAGE sql STABLE
AS $f$
  SELECT CASE
    WHEN pg_temp.policy_def(tbl, pol) LIKE '%' || needle || '%'
    THEN 'ok'
    ELSE 'not ok'
  END
$f$;

-- Shortcut: assert a policy on table 't' named 'p' does NOT contain string 's'.
CREATE FUNCTION pg_temp.policy_not_contains(tbl regclass, pol text, needle text)
  RETURNS text
  LANGUAGE sql STABLE
AS $f$
  SELECT CASE
    WHEN pg_temp.policy_def(tbl, pol) NOT LIKE '%' || needle || '%'
    THEN 'ok'
    ELSE 'not ok'
  END
$f$;

-- ── Rebound PHI/business tables use get_user_clinic_id() ────────────────────
-- Each was previously gated on get_request_clinic_id(). The fix rebinds to
-- get_user_clinic_id() (JWT-derived, non-spoofable).  Tables listed in order
-- they appear in migration 00201.

SELECT ok(
  pg_temp.policy_contains('patient_files', 'patient_files_clinic_access',
                          'get_user_clinic_id'),
  'patient_files READ policy uses get_user_clinic_id() (not header)'
);

SELECT ok(
  pg_temp.policy_contains('medical_alerts', 'medical_alerts_clinic_access',
                          'get_user_clinic_id'),
  'medical_alerts READ policy uses get_user_clinic_id() (not header)'
);

SELECT ok(
  pg_temp.policy_contains('clinic_ai_briefings',
                          'clinic_ai_briefings_clinic_admin_select',
                          'get_user_clinic_id'),
  'clinic_ai_briefings clinic_admin SELECT uses get_user_clinic_id()'
);

SELECT ok(
  pg_temp.policy_contains('clinic_ai_briefings',
                          'clinic_ai_briefings_super_admin_select',
                          'is_super_admin'),
  'clinic_ai_briefings super_admin SELECT uses is_super_admin() (no clinic binding)'
);

SELECT ok(
  pg_temp.policy_contains('subscription_history', 'sub_history_clinic_access',
                          'get_user_clinic_id'),
  'subscription_history SELECT uses get_user_clinic_id()'
);

SELECT ok(
  pg_temp.policy_contains('usage_snapshots', 'usage_snapshots_clinic_select',
                          'get_user_clinic_id'),
  'usage_snapshots SELECT uses get_user_clinic_id()'
);

SELECT ok(
  pg_temp.policy_contains('referral_codes', 'referral_codes_clinic_select',
                          'get_user_clinic_id'),
  'referral_codes SELECT uses get_user_clinic_id()'
);

SELECT ok(
  pg_temp.policy_contains('referral_events', 'referral_events_clinic_select',
                          'get_user_clinic_id'),
  'referral_events SELECT uses get_user_clinic_id()'
);

SELECT ok(
  pg_temp.policy_contains('referral_credits', 'referral_credits_clinic_select',
                          'get_user_clinic_id'),
  'referral_credits SELECT uses get_user_clinic_id()'
);

SELECT ok(
  pg_temp.policy_contains('ai_traces', 'ai_traces_clinic_read',
                          'get_user_clinic_id'),
  'ai_traces READ policy uses get_user_clinic_id()'
);

SELECT ok(
  pg_temp.policy_contains('upload_policies', 'upload_policies_select_own_clinic',
                          'get_user_clinic_id'),
  'upload_policies SELECT uses get_user_clinic_id()'
);

SELECT ok(
  pg_temp.policy_contains('upload_policies', 'upload_policies_insert_clinic_admin',
                          'get_user_clinic_id'),
  'upload_policies INSERT uses get_user_clinic_id()'
);

SELECT ok(
  pg_temp.policy_contains('upload_policies', 'upload_policies_update_clinic_admin',
                          'get_user_clinic_id'),
  'upload_policies UPDATE uses get_user_clinic_id()'
);

SELECT ok(
  pg_temp.policy_contains('upload_policies', 'upload_policies_delete_clinic_admin',
                          'get_user_clinic_id'),
  'upload_policies DELETE uses get_user_clinic_id()'
);

-- ── Negative: no REBOUND table still references get_request_clinic_id() ─────
-- The `users` table and the 00041 public-directory tables (appointments, reviews,
-- products, ...) legitimately combine get_request_clinic_id() with a JWT binding
-- or gate it behind auth.uid() IS NULL for anonymous fallback. The true invariant
-- is narrower: the tables 00201 rebounded must no longer reference the header
-- function AT ALL, because for them it was the sole (spoofable) tenant signal.
SELECT is(
  (SELECT count(*)::int
     FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'patient_files', 'medical_alerts', 'clinic_ai_briefings',
        'subscription_history', 'usage_snapshots', 'referral_codes',
        'referral_events', 'referral_credits', 'ai_traces', 'upload_policies'
      )
      AND (qual || ' ' || coalesce(with_check, ''))
          LIKE '%get_request_clinic_id%'),
  0,
  'no rebound table still references get_request_clinic_id() (header-trust regression)'
);

-- ── ai_traces INSERT locked to service_role ─────────────────────────────────
-- Previously: WITH CHECK (true) — any authenticated user could insert.
-- Fixed:     FOR INSERT TO service_role WITH CHECK (true).
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_traces'
      AND policyname = 'ai_traces_insert_service'
      AND cmd = 'INSERT'
      AND roles = '{service_role}'
  ),
  'ai_traces INSERT policy scoped to service_role only'
);

-- Negative: no other ai_traces INSERT policy exists for anon/authenticated.
SELECT is(
  (SELECT count(*)::int
     FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_traces'
      AND cmd = 'INSERT'
      AND roles && ARRAY['anon', 'authenticated']),
  0,
  'no anon/authenticated INSERT policy exists on ai_traces'
);

-- ── Admin predicate fix: is_super_admin() / users.auth_id = auth.uid() ───────
-- The clinic_ai_briefings super_admin policy was comparing users.id = auth.uid()
-- which never matched (users.id is a serial PK, auth.uid() is a UUID from auth.users).
-- Fixed to is_super_admin() (00002), which resolves via users.auth_id internally.
-- upload_policies admin predicates use the users.auth_id = auth.uid() subquery.

SELECT ok(
  pg_temp.policy_not_contains('clinic_ai_briefings',
                              'clinic_ai_briefings_super_admin_select',
                              'users.id = auth.uid()'),
  'clinic_ai_briefings super_admin policy does not use the broken users.id = auth.uid() predicate'
);

-- upload_policies INSERT/UPDATE/DELETE all use a subquery: users.auth_id = auth.uid()
SELECT ok(
  pg_temp.policy_contains('upload_policies', 'upload_policies_insert_clinic_admin',
                          'users.auth_id'),
  'upload_policies INSERT admin subquery uses users.auth_id'
);

SELECT ok(
  pg_temp.policy_contains('upload_policies', 'upload_policies_update_clinic_admin',
                          'users.auth_id'),
  'upload_policies UPDATE admin subquery uses users.auth_id'
);

SELECT ok(
  pg_temp.policy_contains('upload_policies', 'upload_policies_delete_clinic_admin',
                          'users.auth_id'),
  'upload_policies DELETE admin subquery uses users.auth_id'
);

-- ── Migration 00202: retry_pending_document_extractions function ────────────

SELECT has_function(
  'public', 'retry_pending_document_extractions',
  ARRAY['integer'],
  'retry_pending_document_extractions(integer) exists'
);

SELECT is(
  (SELECT prosecdef FROM pg_proc
     WHERE proname = 'retry_pending_document_extractions'
       AND pronamespace = 'public'::regnamespace),
  true,
  'retry_pending_document_extractions is SECURITY DEFINER'
);

-- Locked to service_role (revoked from anon, authenticated, public).
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'retry_pending_document_extractions'
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  ),
  'retry_pending_document_extractions: anon cannot EXECUTE'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'retry_pending_document_extractions'
      AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ),
  'retry_pending_document_extractions: authenticated cannot EXECUTE'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'retry_pending_document_extractions'
      AND has_function_privilege('service_role', p.oid, 'EXECUTE')
  ),
  'retry_pending_document_extractions: service_role retains EXECUTE'
);

-- ── Cron schedule exists ────────────────────────────────────────────────────
-- pg_cron stores schedules in cron.job; check by job name.
SELECT ok(
  EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'retry-document-extractions'
  ),
  'retry-document-extractions pg_cron schedule exists'
);

SELECT * FROM finish();

-- ── Hard gate ───────────────────────────────────────────────────────────────
-- pgTAP `not ok` does not fail `psql -f`; re-assert critical invariants as
-- RAISEs so a regression kills the build.
DO $$
DECLARE
  v_rebound_tables text[];
  v_request_refs   text;
  v_bad_insert     text;
  v_bad_auth_id    text;
  v_missing_cron   text;
BEGIN
  -- Every rebound table must have at least one policy on get_user_clinic_id().
  v_rebound_tables := ARRAY[
    'patient_files', 'medical_alerts', 'clinic_ai_briefings',
    'subscription_history', 'usage_snapshots', 'referral_codes',
    'referral_events', 'referral_credits', 'ai_traces', 'upload_policies'
  ];
  FOR i IN 1 .. array_length(v_rebound_tables, 1) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = v_rebound_tables[i]
        AND (qual || ' ' || coalesce(with_check, ''))
            LIKE '%get_user_clinic_id%'
    ) THEN
      RAISE EXCEPTION
        'Table % has no policy referencing get_user_clinic_id() — RLS rebinding may have regressed.',
        v_rebound_tables[i];
    END IF;
  END LOOP;

  -- No REBOUND table still uses get_request_clinic_id(). (The public-directory
  -- tables and combined-binding tables legitimately retain it; only the tables
  -- 00201 rebounded must be free of it.)
  SELECT string_agg(DISTINCT tablename, ', ') INTO v_request_refs
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN (
       'patient_files', 'medical_alerts', 'clinic_ai_briefings',
       'subscription_history', 'usage_snapshots', 'referral_codes',
       'referral_events', 'referral_credits', 'ai_traces', 'upload_policies'
     )
     AND (qual || ' ' || coalesce(with_check, ''))
         LIKE '%get_request_clinic_id%';
  IF v_request_refs IS NOT NULL THEN
    RAISE EXCEPTION
      'Rebound table(s) % still reference get_request_clinic_id() — cross-tenant RLS regression.',
      v_request_refs;
  END IF;

  -- ai_traces INSERT must be service_role-only.
  SELECT string_agg(roles::text, ', ') INTO v_bad_insert
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename = 'ai_traces'
     AND cmd = 'INSERT'
     AND roles && ARRAY['anon', 'authenticated'];
  IF v_bad_insert IS NOT NULL THEN
    RAISE EXCEPTION
      'ai_traces INSERT policy exists for role(s): % — should be service_role only.',
      v_bad_insert;
  END IF;

  -- upload_policies admin policies must use users.auth_id, not users.id.
  SELECT string_agg(policyname, ', ') INTO v_bad_auth_id
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename = 'upload_policies'
     AND policyname LIKE 'upload_policies_%'
     AND (qual || ' ' || coalesce(with_check, ''))
         LIKE '%users.id = auth.uid()%';
  IF v_bad_auth_id IS NOT NULL THEN
    RAISE EXCEPTION
      'upload_policies policy(ies) % still compare users.id = auth.uid() — should use users.auth_id.',
      v_bad_auth_id;
  END IF;

  -- retry-document-extractions cron job must exist.
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'retry-document-extractions') THEN
    RAISE EXCEPTION
      'retry-document-extractions pg_cron schedule is missing (migration 00202).';
  END IF;
END $$;

ROLLBACK;
