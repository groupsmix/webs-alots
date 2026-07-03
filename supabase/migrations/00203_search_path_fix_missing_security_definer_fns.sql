-- 00203_search_path_fix_missing_security_definer_fns.sql
--
-- QUAL-4: Pin search_path on three SECURITY DEFINER functions from 00002 that
-- were missed by the 00066 and 00197 passes:
--   - public.get_my_user_id()
--   - public.is_clinic_staff()
--   - public.is_clinic_admin(uuid)
--
-- Without a pinned search_path, a caller can shadow unqualified identifiers
-- referenced by these functions via a malicious schema on their search_path,
-- potentially leading to privilege escalation via the definer's rights.
--
-- Each ALTER is guarded with to_regprocedure() for idempotency.

DO $$
BEGIN
  IF to_regprocedure('public.get_my_user_id()') IS NOT NULL THEN
    ALTER FUNCTION public.get_my_user_id() SET search_path = public, pg_temp;
    RAISE NOTICE '00203: pinned search_path on get_my_user_id()';
  END IF;

  IF to_regprocedure('public.is_clinic_staff()') IS NOT NULL THEN
    ALTER FUNCTION public.is_clinic_staff() SET search_path = public, pg_temp;
    RAISE NOTICE '00203: pinned search_path on is_clinic_staff()';
  END IF;

  IF to_regprocedure('public.is_clinic_admin(uuid)') IS NOT NULL THEN
    ALTER FUNCTION public.is_clinic_admin(uuid) SET search_path = public, pg_temp;
    RAISE NOTICE '00203: pinned search_path on is_clinic_admin(uuid)';
  END IF;
END
$$;
