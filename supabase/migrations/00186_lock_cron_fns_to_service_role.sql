-- Migration 00186: Lock maintenance / cron SECURITY DEFINER functions to
--                  service_role only (revoke the implicit anon/authenticated
--                  EXECUTE grant).
--
-- AI-SEC / RLS-bypass + least-privilege hardening.
--
-- PROBLEM
--   Postgres grants EXECUTE on every new function to PUBLIC by default, and in
--   Supabase the `anon` and `authenticated` roles are members of PUBLIC. A
--   per-role `REVOKE ... FROM anon` therefore does NOTHING unless PUBLIC is
--   also revoked. A live audit confirmed this: a prod query filtered on
--   grantee IN ('anon','authenticated') reported these five maintenance
--   functions as anon/authenticated-callable, because their defining
--   migrations never revoked PUBLIC.
--
--   All five are SECURITY DEFINER (they run with owner rights and BYPASS RLS),
--   have NO internal authorization guard, and are invoked exclusively as
--   out-of-band pg_cron jobs / service-role workers (0 call sites in src/ as
--   `anon` or `authenticated`). They were never meant to be reachable from a
--   browser session:
--
--     - claim_notification_batch(integer)        [00135]  *** PHI / DoS ***
--     - try_cron_advisory_lock(text)             [00135]
--     - cleanup_expired_rate_limit_entries()     [00068]
--     - expire_stale_refund_requests()           [00125]
--     - refresh_ai_usage_monthly()               [00139]
--
--   The standout is claim_notification_batch: it RETURNS SETOF
--   notification_queue (recipient phone/email + message body + clinic_id) and,
--   being SECURITY DEFINER, bypasses RLS, so ANY authenticated user could call
--   it to read other clinics' patient contact details and appointment content
--   (PHI under HIPAA). As a side effect it also flips the claimed rows to
--   'processing', so a malicious or accidental call silently drops real
--   notification sends -- a cross-tenant integrity / DoS bug on top of the read
--   leak.
--
-- FIX
--   For every overload of each function, re-assert the intended end state
--   DECLARATIVELY: REVOKE EXECUTE FROM PUBLIC, anon, and authenticated, then
--   GRANT EXECUTE TO service_role. Declaring the end state (rather than only
--   revoking anon) is the whole point: PUBLIC is the actual source of the
--   grant, so revoking anon alone would leave the hole open. service_role and
--   the function owner (pg_cron context) retain access, so every legitimate
--   invocation path is preserved.
--
-- SCOPE
--   No table, no RLS policy, and no function BODY is modified. EXECUTE-grant
--   reconciliation only, on five named maintenance functions. The public
--   booking / tenant-context surface (booking_atomic_insert,
--   booking_find_or_create_patient, set_tenant_context, get_request_clinic_id,
--   ...) is deliberately left untouched and stays anon-callable.
--
--   NOTE (root cause, intentionally NOT changed here): the systemic fix would
--   be `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS
--   FROM PUBLIC`. That is deliberately omitted -- it is a broad change that
--   would also strip the legitimately anon-callable booking/tenant RPCs and
--   must be evaluated on its own. This migration closes the five proven holes.
--
-- REVERSIBLE: re-GRANT EXECUTE ... TO anon/authenticated to restore (not
--   advised).
-- IDEMPOTENT: signature-agnostic loop over live overloads; safe to re-run.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT 'public.' || p.proname || '(' ||
           pg_get_function_identity_arguments(p.oid) || ')' AS sig,
           p.proname AS name
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'claim_notification_batch',
        'try_cron_advisory_lock',
        'cleanup_expired_rate_limit_entries',
        'expire_stale_refund_requests',
        'refresh_ai_usage_monthly'
      ])
  LOOP
    EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || r.sig || ' FROM PUBLIC';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || r.sig || ' FROM anon';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || r.sig || ' FROM authenticated';
    EXECUTE 'GRANT  EXECUTE ON FUNCTION ' || r.sig || ' TO service_role';
    RAISE NOTICE '00186: locked % -> service_role only', r.sig;
  END LOOP;
END $$;
