-- F-15: Add SET search_path = public, pg_temp to all SECURITY DEFINER functions.
-- This prevents search_path manipulation attacks where a malicious schema
-- could shadow public functions.

-- set_tenant_context (from 00030)
ALTER FUNCTION public.set_tenant_context(uuid) SET search_path = public, pg_temp;

-- get_tenant_context (from 00030)
ALTER FUNCTION public.get_tenant_context() SET search_path = public, pg_temp;

-- get_request_clinic_id (from 00042)
ALTER FUNCTION public.get_request_clinic_id() SET search_path = public, pg_temp;

-- rate_limit_increment (from 00038)
ALTER FUNCTION public.rate_limit_increment(text, integer, integer) SET search_path = public, pg_temp;

-- booking_find_or_create_patient (from 00043)
ALTER FUNCTION public.booking_find_or_create_patient(text, text, uuid) SET search_path = public, pg_temp;

-- register_new_clinic (from 00065)
ALTER FUNCTION public.register_new_clinic(text, text, text, text, text) SET search_path = public, pg_temp;

-- get_user_role (from 00002)
ALTER FUNCTION public.get_user_role() SET search_path = public, pg_temp;

-- get_user_clinic_id (from 00002)
ALTER FUNCTION public.get_user_clinic_id() SET search_path = public, pg_temp;

-- is_admin (from 00002)
ALTER FUNCTION public.is_admin() SET search_path = public, pg_temp;

-- is_admin_or_receptionist (from 00002)
ALTER FUNCTION public.is_admin_or_receptionist() SET search_path = public, pg_temp;

-- is_doctor (from 00002)
ALTER FUNCTION public.is_doctor() SET search_path = public, pg_temp;

-- is_patient (from 00002)
ALTER FUNCTION public.is_patient() SET search_path = public, pg_temp;

-- handle_new_user (from 00002)
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;

-- is_super_admin (from 00034)
ALTER FUNCTION public.is_super_admin() SET search_path = public, pg_temp;

-- check_seed_user_login (from 00059)
ALTER FUNCTION public.check_seed_user_login() SET search_path = public, pg_temp;

-- log_clinic_mutation (from 00058)
ALTER FUNCTION public.log_clinic_mutation() SET search_path = public, pg_temp;

-- handle_new_clinic_admin (from 00045)
ALTER FUNCTION public.handle_new_clinic_admin() SET search_path = public, pg_temp;

-- ensure_clinic_id_immutable (from 00035)
ALTER FUNCTION public.ensure_clinic_id_immutable() SET search_path = public, pg_temp;

-- verify_clinic_id_header (from 00057)
ALTER FUNCTION public.verify_clinic_id_header() SET search_path = public, pg_temp;
