-- Migration 00185: Drop undocumented prod-only debug function + reconcile
--                  anon EXECUTE on admin-only SECURITY DEFINER RPCs.
--
-- AI-SEC / RLS-bypass + least-privilege hardening.
--
-- PROBLEM
--   A live audit of the production database surfaced two pieces of schema
--   drift that do NOT exist in version control:
--
--   1. public.debug_request_headers() is live in production as a SECURITY
--      DEFINER function callable by `anon`, yet appears NOWHERE in this repo
--      (0 occurrences across *.sql and *.ts). It is leftover request-header
--      debugging from the 00041 / 00042 era. An undocumented, anon-callable,
--      definer-rights function on a PHI database is attack surface that can
--      never be code-reviewed because it is not in source control.
--
--   2. Four admin-only SECURITY DEFINER RPCs are granted EXECUTE to `anon`
--      in production, even though each one's DEFINING migration revoked
--      PUBLIC and granted only authenticated / service_role:
--        - execute_admin_query(text)          [00157: REVOKE PUBLIC, GRANT authenticated]
--        - approve_refund(uuid, uuid)         [00151: REVOKE PUBLIC, GRANT authenticated]
--        - get_super_admin_dashboard_stats()  [00155: REVOKE PUBLIC, GRANT authenticated]
--        - get_all_clinic_signals()           [00159 + 00169: GRANT service_role only]
--      Each is protected by an internal is_super_admin() / role guard, so the
--      stray anon grant is NOT independently exploitable today. But an
--      anon-callable admin RPC violates least-privilege and is precisely the
--      drift a pre-launch security review must close. None of the four has any
--      anon call site in src/ (verified by grep).
--
-- FIX
--   1. Drop every overload of debug_request_headers (signature-agnostic).
--   2. For each admin RPC, re-assert the intended end state DECLARATIVELY:
--      REVOKE EXECUTE FROM PUBLIC and FROM anon, then GRANT to the exact role
--      its defining migration intended. Declaring the end state (rather than
--      only revoking) is deterministic regardless of the drifted starting
--      grants and cannot strip a legitimate caller.
--
-- SCOPE
--   No table, no RLS policy, and no function BODY is modified. This is a drop
--   of an out-of-band function plus EXECUTE-grant reconciliation only. The
--   public booking / tenant-context surface (booking_atomic_insert,
--   booking_find_or_create_patient, set_tenant_context, get_request_clinic_id,
--   get_tenant_context, ...) is deliberately left untouched.
--
-- REVERSIBLE: re-GRANT EXECUTE ... TO anon to restore (not advised). The
--   dropped debug function has no source to restore and should remain gone.
-- IDEMPOTENT: every statement is guarded by to_regprocedure; safe to re-run.

-- ── 1. Drop the undocumented prod-only debug function (all overloads) ──
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT 'public.' || p.proname || '(' ||
           pg_get_function_identity_arguments(p.oid) || ')' AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'debug_request_headers'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig;
    RAISE NOTICE '00185: dropped %', r.sig;
  END LOOP;
END $$;

-- ── 2. Reconcile admin-RPC grants to intended least-privilege ──
-- execute_admin_query(text): authenticated only (internal is_super_admin guard).
DO $$
BEGIN
  IF to_regprocedure('public.execute_admin_query(text)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.execute_admin_query(text) FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.execute_admin_query(text) FROM anon;
    GRANT  EXECUTE ON FUNCTION public.execute_admin_query(text) TO authenticated;
    RAISE NOTICE '00185: reconciled execute_admin_query(text) -> authenticated';
  END IF;
END $$;

-- approve_refund(uuid, uuid): authenticated only (super-admin + dual control).
DO $$
BEGIN
  IF to_regprocedure('public.approve_refund(uuid, uuid)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.approve_refund(uuid, uuid) FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.approve_refund(uuid, uuid) FROM anon;
    GRANT  EXECUTE ON FUNCTION public.approve_refund(uuid, uuid) TO authenticated;
    RAISE NOTICE '00185: reconciled approve_refund(uuid,uuid) -> authenticated';
  END IF;
END $$;

-- get_super_admin_dashboard_stats(): authenticated only (super-admin guard).
DO $$
BEGIN
  IF to_regprocedure('public.get_super_admin_dashboard_stats()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.get_super_admin_dashboard_stats() FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.get_super_admin_dashboard_stats() FROM anon;
    GRANT  EXECUTE ON FUNCTION public.get_super_admin_dashboard_stats() TO authenticated;
    RAISE NOTICE '00185: reconciled get_super_admin_dashboard_stats() -> authenticated';
  END IF;
END $$;

-- get_all_clinic_signals(): service_role ONLY. 00169 deliberately revoked
-- authenticated; do NOT re-grant it here.
DO $$
BEGIN
  IF to_regprocedure('public.get_all_clinic_signals()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.get_all_clinic_signals() FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.get_all_clinic_signals() FROM anon;
    REVOKE EXECUTE ON FUNCTION public.get_all_clinic_signals() FROM authenticated;
    GRANT  EXECUTE ON FUNCTION public.get_all_clinic_signals() TO service_role;
    RAISE NOTICE '00185: reconciled get_all_clinic_signals() -> service_role';
  END IF;
END $$;
