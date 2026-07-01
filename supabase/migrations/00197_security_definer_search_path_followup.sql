-- Follow-up to 00066 (F-15): pin `search_path` on SECURITY DEFINER functions
-- that were created AFTER 00066 and therefore were never covered by its fixed
-- signature list. Without a pinned search_path a malicious schema on the
-- caller's search_path could shadow the unqualified objects these functions
-- reference, leading to privilege-escalation via the definer's rights.
--
-- Functions hardened here:
--   - public.refresh_ai_usage_monthly()   (00139)
--   - public.audit_trigger_function()      (00140)
--   - public.get_all_clinic_signals()      (00157, redefined 00159)
--
-- NOTE: public.execute_admin_query(text) (00157) is also missing search_path,
-- but it is fully redefined in 00198 (with `SET search_path` baked into the
-- definition), so it is intentionally not ALTERed here.
--
-- Each ALTER is guarded with to_regprocedure() so the migration is idempotent
-- and tolerant of environments where a given function was never created
-- (CI sandbox DBs, partial restores) — mirroring the 00066 pattern.

DO $$
BEGIN
  IF to_regprocedure('public.refresh_ai_usage_monthly()') IS NOT NULL THEN
    ALTER FUNCTION public.refresh_ai_usage_monthly() SET search_path = public, pg_temp;
    RAISE NOTICE '00197: pinned search_path on refresh_ai_usage_monthly()';
  END IF;

  IF to_regprocedure('public.audit_trigger_function()') IS NOT NULL THEN
    ALTER FUNCTION public.audit_trigger_function() SET search_path = public, pg_temp;
    RAISE NOTICE '00197: pinned search_path on audit_trigger_function()';
  END IF;

  IF to_regprocedure('public.get_all_clinic_signals()') IS NOT NULL THEN
    ALTER FUNCTION public.get_all_clinic_signals() SET search_path = public, pg_temp;
    RAISE NOTICE '00197: pinned search_path on get_all_clinic_signals()';
  END IF;
END
$$;
