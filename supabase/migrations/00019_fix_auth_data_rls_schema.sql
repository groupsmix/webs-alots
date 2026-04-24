-- ============================================================
-- Migration 00019: Fix Auth, Data, RLS & Schema Issues
--
-- Task 3: Create auth.users entries for seed users
-- Task 4: Populate appointment_date/start_time/end_time from slot_start/slot_end
-- Task 5: Enable RLS + add policies for tables missing them
-- Task 6: Add missing columns to align code types with DB schema
-- ============================================================

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
ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;

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

-- Re-enable the trigger
ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;


-- ============================================================
-- TASK 4: POPULATE appointment_date / start_time / end_time
-- FROM slot_start / slot_end (which seed data uses)
-- ============================================================

UPDATE appointments
SET
  appointment_date = (slot_start AT TIME ZONE 'UTC')::date,
  start_time       = (slot_start AT TIME ZONE 'UTC')::time,
  end_time         = (slot_end   AT TIME ZONE 'UTC')::time
WHERE appointment_date IS NULL
  AND slot_start IS NOT NULL;

-- Backfill booking_source from source where booking_source is still default
UPDATE appointments
SET booking_source = source
WHERE source IS NOT NULL
  AND (booking_source IS NULL OR booking_source = 'online');


-- ============================================================
-- TASK 4b: BACKFILL duration_min FROM duration_minutes (services)
-- AND buffer_min FROM buffer_minutes (time_slots)
-- ============================================================

UPDATE services
SET duration_min = duration_minutes
WHERE duration_min IS NULL AND duration_minutes IS NOT NULL;

UPDATE time_slots
SET buffer_min = buffer_minutes
WHERE buffer_min IS NULL AND buffer_minutes IS NOT NULL;


-- ============================================================
-- TASK 6: ADD MISSING COLUMNS TO ALIGN CODE TYPES WITH DB
-- ============================================================

-- 6a. clinics: code expects is_active
ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- 6b. waiting_list: code expects preferred_time
ALTER TABLE waiting_list
  ADD COLUMN IF NOT EXISTS preferred_time TIME;

-- 6c. waiting_list: code expects notified_at
ALTER TABLE waiting_list
  ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;

-- 6d. payments: code uses "reference", DB has "ref"
--     Add reference as a generated column mirroring ref
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS reference TEXT;

-- Backfill reference from ref for existing rows
UPDATE payments SET reference = ref WHERE reference IS NULL AND ref IS NOT NULL;

-- 6e. notifications: ensure clinic_id exists (some code paths need it)
-- Already added in 00005, but ensure it exists
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE;

-- 6f. reviews: ensure doctor_id exists
-- Already added in 00005, but ensure it exists
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS doctor_id UUID REFERENCES users(id);


-- ============================================================
-- TASK 5: ENABLE RLS AND ADD POLICIES FOR ALL TABLES MISSING THEM
-- ============================================================

-- -------------------------------------------------------
-- 5a. TABLES FROM 00005 (schema_gaps) — no RLS at all
-- -------------------------------------------------------

-- blog_posts
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sa_blog_posts_all" ON blog_posts FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_blog_posts" ON blog_posts FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "blog_posts_select_published" ON blog_posts FOR SELECT
  USING (is_published = TRUE);

-- announcements
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sa_announcements_all" ON announcements FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "announcements_select_active" ON announcements FOR SELECT
  USING (is_active = TRUE);

-- activity_logs
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sa_activity_logs_all" ON activity_logs FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "admin_activity_logs_read" ON activity_logs FOR SELECT
  USING (clinic_id = get_user_clinic_id() AND get_user_role() = 'clinic_admin');

-- platform_billing
ALTER TABLE platform_billing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sa_platform_billing_all" ON platform_billing FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "admin_platform_billing_read" ON platform_billing FOR SELECT
  USING (clinic_id = get_user_clinic_id() AND get_user_role() = 'clinic_admin');

-- feature_definitions
ALTER TABLE feature_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sa_feature_definitions_all" ON feature_definitions FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "feature_definitions_select" ON feature_definitions FOR SELECT USING (true);

-- clinic_feature_overrides
ALTER TABLE clinic_feature_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sa_clinic_feature_overrides_all" ON clinic_feature_overrides FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "admin_clinic_feature_overrides" ON clinic_feature_overrides FOR ALL
  USING (clinic_id = get_user_clinic_id() AND get_user_role() = 'clinic_admin')
  WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "clinic_feature_overrides_select" ON clinic_feature_overrides FOR SELECT
  USING (clinic_id = get_user_clinic_id());

-- pricing_tiers
ALTER TABLE pricing_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sa_pricing_tiers_all" ON pricing_tiers FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "pricing_tiers_select" ON pricing_tiers FOR SELECT USING (is_active = TRUE);

-- subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sa_subscriptions_all" ON subscriptions FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "admin_subscriptions_read" ON subscriptions FOR SELECT
  USING (clinic_id = get_user_clinic_id() AND get_user_role() = 'clinic_admin');

-- subscription_invoices
ALTER TABLE subscription_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sa_subscription_invoices_all" ON subscription_invoices FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "admin_subscription_invoices_read" ON subscription_invoices FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM subscriptions s
    WHERE s.id = subscription_invoices.subscription_id
      AND s.clinic_id = get_user_clinic_id()
      AND get_user_role() = 'clinic_admin'
  ));

-- feature_toggles
ALTER TABLE feature_toggles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sa_feature_toggles_all" ON feature_toggles FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "feature_toggles_select" ON feature_toggles FOR SELECT USING (true);

-- sales
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sa_sales_all" ON sales FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_sales" ON sales FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "patient_sales_read" ON sales FOR SELECT
  USING (patient_id = get_my_user_id());

-- on_duty_schedule
ALTER TABLE on_duty_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sa_on_duty_schedule_all" ON on_duty_schedule FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_on_duty_schedule" ON on_duty_schedule FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "on_duty_schedule_select" ON on_duty_schedule FOR SELECT
  USING (clinic_id = get_user_clinic_id());

-- before_after_photos
ALTER TABLE before_after_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sa_before_after_photos_all" ON before_after_photos FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_before_after_photos" ON before_after_photos FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "patient_before_after_photos_read" ON before_after_photos FOR SELECT
  USING (patient_id = get_my_user_id());

-- pain_questionnaires
ALTER TABLE pain_questionnaires ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sa_pain_questionnaires_all" ON pain_questionnaires FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_pain_questionnaires" ON pain_questionnaires FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "patient_pain_questionnaires" ON pain_questionnaires FOR ALL
  USING (patient_id = get_my_user_id())
  WITH CHECK (patient_id = get_my_user_id());

-- emergency_slots
ALTER TABLE emergency_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sa_emergency_slots_all" ON emergency_slots FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_emergency_slots" ON emergency_slots FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "emergency_slots_select" ON emergency_slots FOR SELECT
  USING (clinic_id = get_user_clinic_id());

-- appointment_doctors
ALTER TABLE appointment_doctors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sa_appointment_doctors_all" ON appointment_doctors FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_appointment_doctors" ON appointment_doctors FOR ALL
  USING (is_clinic_staff() AND EXISTS (
    SELECT 1 FROM appointments a WHERE a.id = appointment_doctors.appointment_id
      AND a.clinic_id = get_user_clinic_id()
  ))
  WITH CHECK (is_clinic_staff());
CREATE POLICY "appointment_doctors_select" ON appointment_doctors FOR SELECT
  USING (doctor_id = get_my_user_id() OR EXISTS (
    SELECT 1 FROM appointments a WHERE a.id = appointment_doctors.appointment_id
      AND a.patient_id = get_my_user_id()
  ));

-- clinic_holidays
ALTER TABLE clinic_holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sa_clinic_holidays_all" ON clinic_holidays FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "admin_clinic_holidays" ON clinic_holidays FOR ALL
  USING (clinic_id = get_user_clinic_id() AND get_user_role() = 'clinic_admin')
  WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "clinic_holidays_select" ON clinic_holidays FOR SELECT
  USING (clinic_id = get_user_clinic_id());

-- purchase_orders
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sa_purchase_orders_all" ON purchase_orders FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_purchase_orders" ON purchase_orders FOR ALL
  USING (clinic_id = get_user_clinic_id() AND get_user_role() IN ('clinic_admin', 'receptionist'))
  WITH CHECK (clinic_id = get_user_clinic_id());

-- purchase_order_items
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sa_purchase_order_items_all" ON purchase_order_items FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_purchase_order_items" ON purchase_order_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM purchase_orders po
    WHERE po.id = purchase_order_items.purchase_order_id
      AND po.clinic_id = get_user_clinic_id()
      AND get_user_role() IN ('clinic_admin', 'receptionist')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM purchase_orders po
    WHERE po.id = purchase_order_items.purchase_order_id
      AND po.clinic_id = get_user_clinic_id()
  ));

-- loyalty_transactions
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sa_loyalty_transactions_all" ON loyalty_transactions FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_loyalty_transactions" ON loyalty_transactions FOR ALL
  USING (clinic_id = get_user_clinic_id() AND get_user_role() IN ('clinic_admin', 'receptionist'))
  WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "patient_loyalty_transactions_read" ON loyalty_transactions FOR SELECT
  USING (patient_id = get_my_user_id());

-- -------------------------------------------------------
-- 5b. TABLE FROM 00010 — medical_certificates (no RLS)
-- -------------------------------------------------------

ALTER TABLE medical_certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sa_medical_certificates_all" ON medical_certificates FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_medical_certificates" ON medical_certificates FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "patient_medical_certificates_read" ON medical_certificates FOR SELECT
  USING (patient_id = get_my_user_id());

-- -------------------------------------------------------
-- 5c. TABLES FROM 00015 — have SELECT + SA policies
--     but missing staff write policies.
--     Add staff write policies for clinic-scoped access.
-- -------------------------------------------------------

CREATE POLICY "staff_departments_write" ON departments FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "staff_doctor_departments_write" ON doctor_departments FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "staff_rooms_write" ON rooms FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "staff_beds_write" ON beds FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "staff_admissions_write" ON admissions FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "staff_photo_consent_forms" ON photo_consent_forms FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "staff_treatment_packages" ON treatment_packages FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "staff_patient_packages" ON patient_packages FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "staff_consultation_photos" ON consultation_photos FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "staff_ivf_cycles" ON ivf_cycles FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "staff_ivf_protocols" ON ivf_protocols FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "staff_ivf_timeline_events" ON ivf_timeline_events FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "staff_dialysis_machines" ON dialysis_machines FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "staff_dialysis_sessions" ON dialysis_sessions FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "staff_prosthetic_orders" ON prosthetic_orders FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "staff_lab_materials" ON lab_materials FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "staff_lab_deliveries" ON lab_deliveries FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "staff_lab_invoices" ON lab_invoices FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id());

-- Patient read policies for relevant 00015 tables
CREATE POLICY "patient_ivf_cycles_read" ON ivf_cycles FOR SELECT
  USING (patient_id = get_my_user_id());

CREATE POLICY "patient_dialysis_sessions_read" ON dialysis_sessions FOR SELECT
  USING (patient_id = get_my_user_id());

CREATE POLICY "patient_photo_consent_forms_read" ON photo_consent_forms FOR SELECT
  USING (patient_id = get_my_user_id());

CREATE POLICY "patient_patient_packages_read" ON patient_packages FOR SELECT
  USING (patient_id = get_my_user_id());

CREATE POLICY "patient_consultation_photos_read" ON consultation_photos FOR SELECT
  USING (patient_id = get_my_user_id());

-- -------------------------------------------------------
-- 5d. TABLES FROM 00013 — have overly permissive
--     "allow_all_*" policies (USING true WITH CHECK true).
--     Replace with proper clinic-scoped policies.
-- -------------------------------------------------------

-- Drop the overly permissive policies first
DROP POLICY IF EXISTS "allow_all_exercise_programs" ON exercise_programs;
DROP POLICY IF EXISTS "allow_all_physio_sessions" ON physio_sessions;
DROP POLICY IF EXISTS "allow_all_progress_photos" ON progress_photos;
DROP POLICY IF EXISTS "allow_all_meal_plans" ON meal_plans;
DROP POLICY IF EXISTS "allow_all_body_measurements" ON body_measurements;
DROP POLICY IF EXISTS "allow_all_therapy_session_notes" ON therapy_session_notes;
DROP POLICY IF EXISTS "allow_all_therapy_plans" ON therapy_plans;
DROP POLICY IF EXISTS "allow_all_speech_exercises" ON speech_exercises;
DROP POLICY IF EXISTS "allow_all_speech_sessions" ON speech_sessions;
DROP POLICY IF EXISTS "allow_all_speech_progress_reports" ON speech_progress_reports;
DROP POLICY IF EXISTS "allow_all_lens_inventory" ON lens_inventory;
DROP POLICY IF EXISTS "allow_all_frame_catalog" ON frame_catalog;
DROP POLICY IF EXISTS "allow_all_optical_prescriptions" ON optical_prescriptions;

-- Add proper policies for each

-- exercise_programs
CREATE POLICY "sa_exercise_programs_all" ON exercise_programs FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_exercise_programs" ON exercise_programs FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "patient_exercise_programs_read" ON exercise_programs FOR SELECT
  USING (patient_id = get_my_user_id());

-- physio_sessions
CREATE POLICY "sa_physio_sessions_all" ON physio_sessions FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_physio_sessions" ON physio_sessions FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "patient_physio_sessions_read" ON physio_sessions FOR SELECT
  USING (patient_id = get_my_user_id());

-- progress_photos
CREATE POLICY "sa_progress_photos_all" ON progress_photos FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_progress_photos" ON progress_photos FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "patient_progress_photos_read" ON progress_photos FOR SELECT
  USING (patient_id = get_my_user_id());

-- meal_plans
CREATE POLICY "sa_meal_plans_all" ON meal_plans FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_meal_plans" ON meal_plans FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "patient_meal_plans_read" ON meal_plans FOR SELECT
  USING (patient_id = get_my_user_id());

-- body_measurements
CREATE POLICY "sa_body_measurements_all" ON body_measurements FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_body_measurements" ON body_measurements FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "patient_body_measurements_read" ON body_measurements FOR SELECT
  USING (patient_id = get_my_user_id());

-- therapy_session_notes
CREATE POLICY "sa_therapy_session_notes_all" ON therapy_session_notes FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_therapy_session_notes" ON therapy_session_notes FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id());
-- No patient read for therapy notes (confidential by default)

-- therapy_plans
CREATE POLICY "sa_therapy_plans_all" ON therapy_plans FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_therapy_plans" ON therapy_plans FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "patient_therapy_plans_read" ON therapy_plans FOR SELECT
  USING (patient_id = get_my_user_id());

-- speech_exercises (reference data, no patient_id)
CREATE POLICY "sa_speech_exercises_all" ON speech_exercises FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_speech_exercises" ON speech_exercises FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "speech_exercises_select" ON speech_exercises FOR SELECT
  USING (clinic_id = get_user_clinic_id());

-- speech_sessions
CREATE POLICY "sa_speech_sessions_all" ON speech_sessions FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_speech_sessions" ON speech_sessions FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "patient_speech_sessions_read" ON speech_sessions FOR SELECT
  USING (patient_id = get_my_user_id());

-- speech_progress_reports
CREATE POLICY "sa_speech_progress_reports_all" ON speech_progress_reports FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_speech_progress_reports" ON speech_progress_reports FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "patient_speech_progress_reports_read" ON speech_progress_reports FOR SELECT
  USING (patient_id = get_my_user_id());

-- lens_inventory (stock, no patient_id)
CREATE POLICY "sa_lens_inventory_all" ON lens_inventory FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_lens_inventory" ON lens_inventory FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "lens_inventory_select" ON lens_inventory FOR SELECT
  USING (clinic_id = get_user_clinic_id());

-- frame_catalog (stock, no patient_id)
CREATE POLICY "sa_frame_catalog_all" ON frame_catalog FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_frame_catalog" ON frame_catalog FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "frame_catalog_select" ON frame_catalog FOR SELECT
  USING (clinic_id = get_user_clinic_id());

-- optical_prescriptions
CREATE POLICY "sa_optical_prescriptions_all" ON optical_prescriptions FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_optical_prescriptions" ON optical_prescriptions FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "patient_optical_prescriptions_read" ON optical_prescriptions FOR SELECT
  USING (patient_id = get_my_user_id());
