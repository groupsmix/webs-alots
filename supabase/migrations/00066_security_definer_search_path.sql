-- F-15: Add SET search_path = public, pg_temp to all SECURITY DEFINER functions.
-- This prevents search_path manipulation attacks where a malicious schema
-- could shadow public functions.
--
-- Each ALTER is wrapped in a DO block so the migration is idempotent and
-- tolerates environments where a given function was never created (CI
-- sandbox DBs, partial restores, etc.).

DO $$
DECLARE
  fn text;
  signatures text[] := ARRAY[
    'public.set_tenant_context(uuid)',
    'public.get_tenant_context()',
    'public.get_request_clinic_id()',
    'public.rate_limit_increment(text, bigint, bigint, timestamptz)',
    'public.booking_find_or_create_patient(uuid, text, text, text)',
    'public.register_new_clinic(text, text, text, text, text, text, text, uuid)',
    'public.get_user_role()',
    'public.get_user_clinic_id()',
    'public.is_admin()',
    'public.is_admin_or_receptionist()',
    'public.is_doctor()',
    'public.is_patient()',
    'public.handle_new_user()',
    'public.is_super_admin()',
    'public.check_seed_user_login()',
    'public.log_clinic_mutation()',
    'public.handle_new_clinic_admin()',
    'public.ensure_clinic_id_immutable()',
    'public.verify_clinic_id_header()'
  ];
BEGIN
  FOREACH fn IN ARRAY signatures LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', fn);
    EXCEPTION
      WHEN undefined_function THEN
        RAISE NOTICE 'F-15 skip: % does not exist', fn;
    END;
  END LOOP;
END $$;
