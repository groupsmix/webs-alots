-- Seed data is now in migrations/00003_seed_data.sql
-- This file is kept for compatibility with `supabase db reset`
-- which automatically runs seed.sql after all migrations.
--
-- Since seed data is already applied via migration 00003,
-- this file intentionally left minimal.


-- ============================================================
-- TASK 3: CREATE AUTH.USERS ENTRIES FOR SEED USERS
-- Phone OTP login requires matching auth.users rows.
-- The handle_new_auth_user trigger (00002) handles future signups,
-- but seed users in public.users have no auth.users counterpart.
--
-- !! WARNING — DEV / SEED DATA ONLY !!
-- The password below ('seed-password-change-me') is a well-known
-- default visible in version control. These accounts MUST be
-- deleted or have their passwords changed before any production
-- deployment. See the "Production Security Checklist" section
-- in README.md for details.
-- ============================================================

-- Temporarily disable the trigger so inserting into auth.users
-- does not create duplicate public.users rows.
--
-- Some environments (e.g. the supabase CLI local stack) run seed.sql
-- as a role that does not own auth.users, so DISABLE TRIGGER would
-- fail with SQLSTATE 42501 (insufficient_privilege / "must be owner
-- of table users"). Wrap the ownership-required DDL in a DO block
-- that swallows that specific error. The duplicate public.users rows
-- are still avoided because the INSERT below uses ON CONFLICT DO NOTHING
-- and the seed users in public.users were already created via migration
-- 00003.
DO $$
BEGIN
  EXECUTE 'ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping DISABLE TRIGGER on auth.users (insufficient privilege)';
END
$$;

-- Use SEED_USER_PASSWORD env var if set, otherwise fall back to
-- the well-known default (acceptable for local dev only).
DO $$ BEGIN
  IF current_setting('app.seed_user_password', true) IS NULL THEN
    PERFORM set_config('app.seed_user_password', 'seed-password-change-me', true);
  END IF;
END $$;

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password,
  email_confirmed_at, phone, phone_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  aud, role, created_at, updated_at,
  confirmation_token, recovery_token
)
VALUES
  -- Super Admin
  ('a0000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000',
   'admin@health-saas.ma',
   crypt(current_setting('app.seed_user_password', true), gen_salt('bf')),
   now(), '+212600000001', now(),
   '{"provider":"phone","providers":["phone"]}'::jsonb,
   '{"role":"super_admin","name":"Admin Platform"}'::jsonb,
   'authenticated', 'authenticated', now(), now(), '', ''),
  -- Clinic Admin
  ('a0000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000000',
   'nadia@dr-benali.ma',
   crypt(current_setting('app.seed_user_password', true), gen_salt('bf')),
   now(), '+212611000001', now(),
   '{"provider":"phone","providers":["phone"]}'::jsonb,
   '{"role":"clinic_admin","name":"Nadia Benali"}'::jsonb,
   'authenticated', 'authenticated', now(), now(), '', ''),
  -- Doctor
  ('a0000000-0000-0000-0000-000000000003',
   '00000000-0000-0000-0000-000000000000',
   'ahmed@dr-benali.ma',
   crypt(current_setting('app.seed_user_password', true), gen_salt('bf')),
   now(), '+212611000002', now(),
   '{"provider":"phone","providers":["phone"]}'::jsonb,
   '{"role":"doctor","name":"Dr. Ahmed Benali"}'::jsonb,
   'authenticated', 'authenticated', now(), now(), '', ''),
  -- Receptionist
  ('a0000000-0000-0000-0000-000000000004',
   '00000000-0000-0000-0000-000000000000',
   'amina@dr-benali.ma',
   crypt(current_setting('app.seed_user_password', true), gen_salt('bf')),
   now(), '+212611000003', now(),
   '{"provider":"phone","providers":["phone"]}'::jsonb,
   '{"role":"receptionist","name":"Amina Tazi"}'::jsonb,
   'authenticated', 'authenticated', now(), now(), '', ''),
  -- Patient 1
  ('a0000000-0000-0000-0000-000000000010',
   '00000000-0000-0000-0000-000000000000',
   'fatima.m@gmail.com',
   crypt(current_setting('app.seed_user_password', true), gen_salt('bf')),
   now(), '+212622113344', now(),
   '{"provider":"phone","providers":["phone"]}'::jsonb,
   '{"role":"patient","name":"Fatima Zahra Mansouri"}'::jsonb,
   'authenticated', 'authenticated', now(), now(), '', ''),
  -- Patient 2
  ('a0000000-0000-0000-0000-000000000011',
   '00000000-0000-0000-0000-000000000000',
   'hassan.b@gmail.com',
   crypt(current_setting('app.seed_user_password', true), gen_salt('bf')),
   now(), '+212633224455', now(),
   '{"provider":"phone","providers":["phone"]}'::jsonb,
   '{"role":"patient","name":"Hassan Bourkia"}'::jsonb,
   'authenticated', 'authenticated', now(), now(), '', ''),
  -- Patient 3
  ('a0000000-0000-0000-0000-000000000012',
   '00000000-0000-0000-0000-000000000000',
   'khadija.a@gmail.com',
   crypt(current_setting('app.seed_user_password', true), gen_salt('bf')),
   now(), '+212644335566', now(),
   '{"provider":"phone","providers":["phone"]}'::jsonb,
   '{"role":"patient","name":"Khadija Alaoui"}'::jsonb,
   'authenticated', 'authenticated', now(), now(), '', ''),
  -- Patient 4
  ('a0000000-0000-0000-0000-000000000013',
   '00000000-0000-0000-0000-000000000000',
   'omar.f@gmail.com',
   crypt(current_setting('app.seed_user_password', true), gen_salt('bf')),
   now(), '+212655446677', now(),
   '{"provider":"phone","providers":["phone"]}'::jsonb,
   '{"role":"patient","name":"Omar El Fassi"}'::jsonb,
   'authenticated', 'authenticated', now(), now(), '', ''),
  -- Patient 5
  ('a0000000-0000-0000-0000-000000000014',
   '00000000-0000-0000-0000-000000000000',
   'youssef.t@gmail.com',
   crypt(current_setting('app.seed_user_password', true), gen_salt('bf')),
   now(), '+212666557788', now(),
   '{"provider":"phone","providers":["phone"]}'::jsonb,
   '{"role":"patient","name":"Youssef Tazi"}'::jsonb,
   'authenticated', 'authenticated', now(), now(), '', '')
ON CONFLICT (id) DO NOTHING;

-- Create matching auth.identities rows (required by Supabase Auth)
INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
)
SELECT
  au.id,
  au.id,
  jsonb_build_object(
    'sub', au.id::text,
    'phone', au.phone,
    'email', au.email,
    'phone_verified', true,
    'email_verified', true
  ),
  'phone',
  au.phone,
  now(),
  now(),
  now()
FROM auth.users au
WHERE au.id IN (
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000004',
  'a0000000-0000-0000-0000-000000000010',
  'a0000000-0000-0000-0000-000000000011',
  'a0000000-0000-0000-0000-000000000012',
  'a0000000-0000-0000-0000-000000000013',
  'a0000000-0000-0000-0000-000000000014'
)
AND NOT EXISTS (
  SELECT 1 FROM auth.identities ai
  WHERE ai.user_id = au.id AND ai.provider = 'phone'
);

-- Re-enable the trigger (mirror the DO block guard above)
DO $$
BEGIN
  EXECUTE 'ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping ENABLE TRIGGER on auth.users (insufficient privilege)';
END
$$;


