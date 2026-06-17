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

-- AUDIT-12: Hard-block seed execution against production or staging databases.
-- The SEED-01 trigger (migration 00059) is defence-in-depth at the row level;
-- this block is a fail-fast at the script level so no seed statements execute
-- at all when run against a non-local Supabase project.
DO $$
BEGIN
  -- If someone explicitly sets app.environment to production/staging,
  -- refuse to proceed. Supabase local dev should either leave this unset
  -- (in which case the later `SET app.environment = 'local'` applies) or
  -- explicitly set it to 'local' / 'development' / 'test'.
  IF current_setting('app.environment', true) IN ('production', 'staging') THEN
    RAISE EXCEPTION 'SEED ABORT: Refusing to run seed data in % environment', current_setting('app.environment', true);
  END IF;
END
$$;

-- Mark this session as a local-dev seed run so the SEED-01 guard
-- (migration 00059, trg_block_seed_user_insert) does not block
-- INSERT of seed users into auth.users. The trigger fail-closes
-- when app.environment is unset / 'production' / 'staging';
-- a session-local SET only affects this seeding session and
-- never leaks to runtime.
SET app.environment = 'local';

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
   'super@oltigo.test',
   crypt(current_setting('app.seed_user_password', true), gen_salt('bf')),
   now(), '+212600000001', now(),
   '{"provider":"phone","providers":["phone"]}'::jsonb,
   '{"role":"super_admin","name":"Admin Platform"}'::jsonb,
   'authenticated', 'authenticated', now(), now(), '', ''),
  -- Clinic Admin
  ('a0000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000000',
   'admin@demo-clinic.com',
   crypt(current_setting('app.seed_user_password', true), gen_salt('bf')),
   now(), '+212611000001', now(),
   '{"provider":"phone","providers":["phone"]}'::jsonb,
   '{"role":"clinic_admin","name":"Nadia Benali"}'::jsonb,
   'authenticated', 'authenticated', now(), now(), '', ''),
  -- Doctor
  ('a0000000-0000-0000-0000-000000000003',
   '00000000-0000-0000-0000-000000000000',
   'doctor@demo-clinic.com',
   crypt(current_setting('app.seed_user_password', true), gen_salt('bf')),
   now(), '+212611000002', now(),
   '{"provider":"phone","providers":["phone"]}'::jsonb,
   '{"role":"doctor","name":"Dr. Ahmed Benali"}'::jsonb,
   'authenticated', 'authenticated', now(), now(), '', ''),
  -- Receptionist
  ('a0000000-0000-0000-0000-000000000004',
   '00000000-0000-0000-0000-000000000000',
   'reception@demo-clinic.com',
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



-- ============================================================
-- DEMO TENANT (moved here from migrations 00046 + 00053).
--
-- Seeded for LOCAL + CI only. seed.sql runs on `supabase db reset` /
-- `supabase start`, but NOT in production (`supabase db push` skips it),
-- so the demo tenant never lands in the production database. The blocking
-- E2E suite targets http://demo.localhost and relies on this demo clinic
-- (subdomain = 'demo') existing for tenant resolution.
--
-- All inserts use ON CONFLICT DO NOTHING and are safe to re-run.
-- ============================================================

-- ============================================================
-- Demo Tenant: demo.oltigo.com
--
-- A read-only showcase clinic for prospects to explore the
-- platform without signing up. Pre-loaded with sample doctors,
-- services, time slots, and appointments.
--
-- NOTE: This is seeded for LOCAL + CI only (see the section header above);
-- it is NOT applied to production. The is_demo flag still marks the tenant.
-- ============================================================

-- ============================================================
-- DEMO CLINIC
-- ============================================================

INSERT INTO clinics (id, name, type, config, tier, status) VALUES
  ('c0000000-de00-0000-0000-000000000001',
   'Cabinet Demo Oltigo',
   'doctor',
   '{
     "locale": "fr",
     "currency": "MAD",
     "city": "Casablanca",
     "phone": "+212 5 00 00 00 00",
     "specialty": "General Medicine",
     "subdomain": "demo",
     "is_demo": true
   }'::jsonb,
   'premium',
   'active')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DEMO USERS
-- ============================================================

-- Demo clinic admin
INSERT INTO users (id, role, name, phone, email, clinic_id) VALUES
  ('b0000000-de00-0000-0000-000000000001',
   'clinic_admin',
   'Admin Demo',
   '+212600000000',
   'admin@demo.oltigo.com',
   'c0000000-de00-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Demo doctor 1
INSERT INTO users (id, role, name, phone, email, clinic_id) VALUES
  ('b0000000-de00-0000-0000-000000000002',
   'doctor',
   'Dr. Karim Idrissi',
   '+212611000010',
   'karim@demo.oltigo.com',
   'c0000000-de00-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Demo doctor 2
INSERT INTO users (id, role, name, phone, email, clinic_id) VALUES
  ('b0000000-de00-0000-0000-000000000003',
   'doctor',
   'Dr. Salma Berrada',
   '+212611000011',
   'salma@demo.oltigo.com',
   'c0000000-de00-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Demo receptionist
INSERT INTO users (id, role, name, phone, email, clinic_id) VALUES
  ('b0000000-de00-0000-0000-000000000004',
   'receptionist',
   'Imane Fassi',
   '+212611000012',
   'imane@demo.oltigo.com',
   'c0000000-de00-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Demo patients
INSERT INTO users (id, role, name, phone, email, clinic_id) VALUES
  ('b0000000-de00-0000-0000-000000000010',
   'patient', 'Rachid Bennani', '+212622000001', 'rachid@example.com',
   'c0000000-de00-0000-0000-000000000001'),
  ('b0000000-de00-0000-0000-000000000011',
   'patient', 'Leila Cherkaoui', '+212622000002', 'leila@example.com',
   'c0000000-de00-0000-0000-000000000001'),
  ('b0000000-de00-0000-0000-000000000012',
   'patient', 'Mehdi Alami', '+212622000003', 'mehdi@example.com',
   'c0000000-de00-0000-0000-000000000001'),
  ('b0000000-de00-0000-0000-000000000013',
   'patient', 'Nora Touzani', '+212622000004', 'nora@example.com',
   'c0000000-de00-0000-0000-000000000001'),
  ('b0000000-de00-0000-0000-000000000014',
   'patient', 'Amine Kettani', '+212622000005', 'amine@example.com',
   'c0000000-de00-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DEMO SERVICES
-- ============================================================

INSERT INTO services (id, clinic_id, name, price, duration_minutes, category) VALUES
  ('50000000-de00-0000-0000-000000000001',
   'c0000000-de00-0000-0000-000000000001',
   'Consultation Générale', 300.00, 30, 'consultation'),
  ('50000000-de00-0000-0000-000000000002',
   'c0000000-de00-0000-0000-000000000001',
   'Visite de Suivi', 200.00, 20, 'follow-up'),
  ('50000000-de00-0000-0000-000000000003',
   'c0000000-de00-0000-0000-000000000001',
   'Bilan Sanguin', 450.00, 15, 'diagnostic'),
  ('50000000-de00-0000-0000-000000000004',
   'c0000000-de00-0000-0000-000000000001',
   'ECG', 500.00, 45, 'diagnostic'),
  ('50000000-de00-0000-0000-000000000005',
   'c0000000-de00-0000-0000-000000000001',
   'Vaccination', 200.00, 15, 'vaccination')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DEMO TIME SLOTS (Dr. Karim — Mon-Fri 09-12 & 14-17)
-- ============================================================

INSERT INTO time_slots (doctor_id, clinic_id, day_of_week, start_time, end_time, is_available, max_capacity, buffer_minutes) VALUES
  ('b0000000-de00-0000-0000-000000000002', 'c0000000-de00-0000-0000-000000000001', 1, '09:00', '12:00', TRUE, 1, 10),
  ('b0000000-de00-0000-0000-000000000002', 'c0000000-de00-0000-0000-000000000001', 1, '14:00', '17:00', TRUE, 1, 10),
  ('b0000000-de00-0000-0000-000000000002', 'c0000000-de00-0000-0000-000000000001', 2, '09:00', '12:00', TRUE, 1, 10),
  ('b0000000-de00-0000-0000-000000000002', 'c0000000-de00-0000-0000-000000000001', 2, '14:00', '17:00', TRUE, 1, 10),
  ('b0000000-de00-0000-0000-000000000002', 'c0000000-de00-0000-0000-000000000001', 3, '09:00', '12:00', TRUE, 1, 10),
  ('b0000000-de00-0000-0000-000000000002', 'c0000000-de00-0000-0000-000000000001', 3, '14:00', '17:00', TRUE, 1, 10),
  ('b0000000-de00-0000-0000-000000000002', 'c0000000-de00-0000-0000-000000000001', 4, '09:00', '12:00', TRUE, 1, 10),
  ('b0000000-de00-0000-0000-000000000002', 'c0000000-de00-0000-0000-000000000001', 4, '14:00', '17:00', TRUE, 1, 10),
  ('b0000000-de00-0000-0000-000000000002', 'c0000000-de00-0000-0000-000000000001', 5, '09:00', '12:00', TRUE, 1, 10),
  ('b0000000-de00-0000-0000-000000000002', 'c0000000-de00-0000-0000-000000000001', 5, '14:00', '17:00', TRUE, 1, 10);

-- Dr. Salma — Mon, Wed, Fri mornings only
INSERT INTO time_slots (doctor_id, clinic_id, day_of_week, start_time, end_time, is_available, max_capacity, buffer_minutes) VALUES
  ('b0000000-de00-0000-0000-000000000003', 'c0000000-de00-0000-0000-000000000001', 1, '09:00', '13:00', TRUE, 1, 15),
  ('b0000000-de00-0000-0000-000000000003', 'c0000000-de00-0000-0000-000000000001', 3, '09:00', '13:00', TRUE, 1, 15),
  ('b0000000-de00-0000-0000-000000000003', 'c0000000-de00-0000-0000-000000000001', 5, '09:00', '13:00', TRUE, 1, 15);

-- ============================================================
-- DEMO APPOINTMENTS (variety of statuses)
-- ============================================================

INSERT INTO appointments (id, patient_id, doctor_id, clinic_id, service_id, slot_start, slot_end, status, is_first_visit, insurance_flag, source, notes) VALUES
  ('a0000000-de00-0000-0000-000000000001',
   'b0000000-de00-0000-0000-000000000010',
   'b0000000-de00-0000-0000-000000000002',
   'c0000000-de00-0000-0000-000000000001',
   '50000000-de00-0000-0000-000000000001',
   '2026-03-20 09:00:00+00', '2026-03-20 09:30:00+00',
   'completed', TRUE, TRUE, 'online',
   'Consultation initiale — tension normale, bilan sanguin demandé')
ON CONFLICT (id) DO NOTHING;

INSERT INTO appointments (id, patient_id, doctor_id, clinic_id, service_id, slot_start, slot_end, status, is_first_visit, insurance_flag, source) VALUES
  ('a0000000-de00-0000-0000-000000000002',
   'b0000000-de00-0000-0000-000000000011',
   'b0000000-de00-0000-0000-000000000002',
   'c0000000-de00-0000-0000-000000000001',
   '50000000-de00-0000-0000-000000000002',
   '2026-03-25 10:00:00+00', '2026-03-25 10:20:00+00',
   'confirmed', FALSE, TRUE, 'phone')
ON CONFLICT (id) DO NOTHING;

INSERT INTO appointments (id, patient_id, doctor_id, clinic_id, service_id, slot_start, slot_end, status, is_first_visit, insurance_flag, source) VALUES
  ('a0000000-de00-0000-0000-000000000003',
   'b0000000-de00-0000-0000-000000000012',
   'b0000000-de00-0000-0000-000000000003',
   'c0000000-de00-0000-0000-000000000001',
   '50000000-de00-0000-0000-000000000004',
   '2026-03-28 09:00:00+00', '2026-03-28 09:45:00+00',
   'pending', TRUE, FALSE, 'whatsapp')
ON CONFLICT (id) DO NOTHING;

INSERT INTO appointments (id, patient_id, doctor_id, clinic_id, service_id, slot_start, slot_end, status, is_first_visit, insurance_flag, source) VALUES
  ('a0000000-de00-0000-0000-000000000004',
   'b0000000-de00-0000-0000-000000000013',
   'b0000000-de00-0000-0000-000000000002',
   'c0000000-de00-0000-0000-000000000001',
   '50000000-de00-0000-0000-000000000005',
   '2026-04-01 15:00:00+00', '2026-04-01 15:15:00+00',
   'confirmed', FALSE, TRUE, 'online')
ON CONFLICT (id) DO NOTHING;

INSERT INTO appointments (id, patient_id, doctor_id, clinic_id, service_id, slot_start, slot_end, status, is_first_visit, insurance_flag, source, notes) VALUES
  ('a0000000-de00-0000-0000-000000000005',
   'b0000000-de00-0000-0000-000000000014',
   'b0000000-de00-0000-0000-000000000003',
   'c0000000-de00-0000-0000-000000000001',
   '50000000-de00-0000-0000-000000000001',
   '2026-03-19 11:00:00+00', '2026-03-19 11:30:00+00',
   'completed', TRUE, FALSE, 'walk_in',
   'Visite de routine — tout est normal')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DEMO REVIEWS
-- ============================================================

INSERT INTO reviews (id, patient_id, clinic_id, stars, comment, response) VALUES
  ('70000000-de00-0000-0000-000000000001',
   'b0000000-de00-0000-0000-000000000010',
   'c0000000-de00-0000-0000-000000000001',
   5, 'Excellent cabinet, très bien organisé. Je recommande !',
   'Merci beaucoup pour votre confiance.'),
  ('70000000-de00-0000-0000-000000000002',
   'b0000000-de00-0000-0000-000000000011',
   'c0000000-de00-0000-0000-000000000001',
   4, 'Bon médecin, ponctuel et à l''écoute.',
   NULL),
  ('70000000-de00-0000-0000-000000000003',
   'b0000000-de00-0000-0000-000000000014',
   'c0000000-de00-0000-0000-000000000001',
   5, 'Service impeccable, cabinet moderne et propre.',
   'Merci, nous faisons de notre mieux !')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DEMO PAYMENTS
-- ============================================================

INSERT INTO payments (id, clinic_id, patient_id, appointment_id, amount, method, status, ref) VALUES
  ('90000000-de00-0000-0000-000000000001',
   'c0000000-de00-0000-0000-000000000001',
   'b0000000-de00-0000-0000-000000000010',
   'a0000000-de00-0000-0000-000000000001',
   300.00, 'cash', 'completed', 'DEMO-PAY-001'),
  ('90000000-de00-0000-0000-000000000002',
   'c0000000-de00-0000-0000-000000000001',
   'b0000000-de00-0000-0000-000000000014',
   'a0000000-de00-0000-0000-000000000005',
   300.00, 'card', 'completed', 'DEMO-PAY-002')
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- Migration 00053: Enhance Demo Tenant
--
-- Adds prescriptions and invoices to the demo clinic so the
-- demo experience is richer and showcases more platform features.
-- Also sets the subdomain column for demo routing.
-- ============================================================

-- Ensure the demo clinic has the subdomain column set
UPDATE clinics
  SET subdomain = 'demo'
  WHERE id = 'c0000000-de00-0000-0000-000000000001'
    AND (subdomain IS NULL OR subdomain != 'demo');

-- ============================================================
-- DEMO PRESCRIPTIONS
-- ============================================================

INSERT INTO prescriptions (id, patient_id, doctor_id, appointment_id, content, created_at) VALUES
  ('dd000000-de00-0000-0000-000000000001',
   'b0000000-de00-0000-0000-000000000010',
   'b0000000-de00-0000-0000-000000000002',
   'a0000000-de00-0000-0000-000000000001',
   '[
     {"medication": "Amoxicilline 500mg", "dosage": "1 comprimé 3x/jour", "duration": "7 jours"},
     {"medication": "Paracétamol 1g", "dosage": "1 comprimé si douleur, max 3/jour", "duration": "5 jours"}
   ]'::jsonb,
   '2026-03-20 10:00:00+00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO prescriptions (id, patient_id, doctor_id, appointment_id, content, created_at) VALUES
  ('dd000000-de00-0000-0000-000000000002',
   'b0000000-de00-0000-0000-000000000014',
   'b0000000-de00-0000-0000-000000000003',
   'a0000000-de00-0000-0000-000000000005',
   '[
     {"medication": "Oméprazole 20mg", "dosage": "1 gélule le matin à jeun", "duration": "14 jours"},
     {"medication": "Dompéridone 10mg", "dosage": "1 comprimé avant chaque repas", "duration": "10 jours"}
   ]'::jsonb,
   '2026-03-19 12:00:00+00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO prescriptions (id, patient_id, doctor_id, content, created_at) VALUES
  ('dd000000-de00-0000-0000-000000000003',
   'b0000000-de00-0000-0000-000000000011',
   'b0000000-de00-0000-0000-000000000002',
   '[
     {"medication": "Vitamine D3 100 000 UI", "dosage": "1 ampoule par mois", "duration": "3 mois"},
     {"medication": "Fer Fumarate 200mg", "dosage": "1 comprimé/jour au déjeuner", "duration": "2 mois"}
   ]'::jsonb,
   '2026-03-22 14:00:00+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DEMO CONSULTATION NOTES
-- ============================================================

INSERT INTO consultation_notes (id, patient_id, doctor_id, appointment_id, notes, private, created_at) VALUES
  ('cc000000-de00-0000-0000-000000000001',
   'b0000000-de00-0000-0000-000000000010',
   'b0000000-de00-0000-0000-000000000002',
   'a0000000-de00-0000-0000-000000000001',
   'Patient se plaint de maux de tête fréquents depuis 2 semaines. Tension artérielle : 12/8. Examen clinique normal. Bilan sanguin prescrit pour vérifier NFS et glycémie.',
   TRUE,
   '2026-03-20 09:30:00+00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO consultation_notes (id, patient_id, doctor_id, appointment_id, notes, private, created_at) VALUES
  ('cc000000-de00-0000-0000-000000000002',
   'b0000000-de00-0000-0000-000000000014',
   'b0000000-de00-0000-0000-000000000003',
   'a0000000-de00-0000-0000-000000000005',
   'Douleurs épigastriques depuis 1 mois. Pas de signes d''alarme. Traitement anti-acide prescrit. Contrôle dans 2 semaines si pas d''amélioration.',
   TRUE,
   '2026-03-19 11:30:00+00')
ON CONFLICT (id) DO NOTHING;

