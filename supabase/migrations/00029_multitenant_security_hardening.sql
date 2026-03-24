-- ============================================================
-- Migration 00029: Multi-Tenant Security Hardening
--
-- Fixes all remaining critical multi-tenant security issues:
--
-- 1. FIX BROKEN RLS POLICIES
--    - odontogram: WITH CHECK missing clinic_id
--    - installments: WITH CHECK missing clinic_id
--    - notifications: INSERT missing clinic_id scoping
--    - chatbot_config: SELECT leaks all configs cross-tenant
--    - chatbot_faqs: SELECT leaks active FAQs cross-tenant
--    - patient appointments: SELECT/INSERT missing clinic_id
--    - appointment_doctors: staff WITH CHECK missing clinic_id
--    - collection_points: public SELECT leaks cross-tenant
--    - lab_tests: public SELECT leaks cross-tenant
--    - blog_posts: public SELECT leaks cross-tenant
--
-- 2. ADD MISSING CLINIC_ID COLUMNS + RLS HARDENING
--    - prescriptions: add clinic_id, backfill, add RLS
--    - consultation_notes: add clinic_id, backfill, add RLS
--    - family_members: add clinic_id, backfill, add RLS
--    - odontogram: add clinic_id, backfill
--
-- 3. ADD INDEXES for tenant isolation performance
--
-- 4. HARDEN rate_limit_entries RLS (service-role only)
-- ============================================================

-- ============================================================
-- 1. FIX BROKEN RLS POLICIES
-- ============================================================

-- -------------------------------------------------------
-- 1a. ODONTOGRAM: WITH CHECK missing clinic_id check
-- The old policy allowed a doctor/admin to INSERT odontogram
-- records for patients in ANY clinic.
-- -------------------------------------------------------

-- First add clinic_id column to odontogram (currently missing)
ALTER TABLE odontogram
  ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE;

-- Backfill clinic_id from the patient's clinic
UPDATE odontogram o
SET clinic_id = u.clinic_id
FROM users u
WHERE o.patient_id = u.id
  AND o.clinic_id IS NULL;

-- Create index for tenant queries
CREATE INDEX IF NOT EXISTS idx_odontogram_clinic ON odontogram(clinic_id);

DROP POLICY IF EXISTS "odontogram_manage_doctor" ON odontogram;
CREATE POLICY "odontogram_manage_doctor" ON odontogram
  FOR ALL USING (
    get_user_role() IN ('doctor', 'clinic_admin')
    AND clinic_id = get_user_clinic_id()
  ) WITH CHECK (
    get_user_role() IN ('doctor', 'clinic_admin')
    AND clinic_id = get_user_clinic_id()
  );

-- -------------------------------------------------------
-- 1b. INSTALLMENTS: WITH CHECK missing clinic_id check
-- The old policy allowed staff to INSERT installments for
-- treatment plans belonging to ANY clinic.
-- -------------------------------------------------------

DROP POLICY IF EXISTS "installments_manage_staff" ON installments;
CREATE POLICY "installments_manage_staff" ON installments
  FOR ALL USING (
    get_user_role() IN ('clinic_admin', 'receptionist')
    AND EXISTS (
      SELECT 1 FROM treatment_plans tp
      JOIN users u ON u.id = tp.doctor_id
      WHERE tp.id = installments.treatment_plan_id
        AND u.clinic_id = get_user_clinic_id()
    )
  ) WITH CHECK (
    get_user_role() IN ('clinic_admin', 'receptionist')
    AND clinic_id = get_user_clinic_id()
  );

-- -------------------------------------------------------
-- 1c. NOTIFICATIONS: INSERT missing clinic_id scoping
-- The old policy allowed any staff member to insert
-- notifications without clinic_id validation, enabling
-- cross-tenant notification injection.
-- -------------------------------------------------------

DROP POLICY IF EXISTS "notifications_insert_staff" ON notifications;
CREATE POLICY "notifications_insert_staff" ON notifications
  FOR INSERT WITH CHECK (
    get_user_role() IN ('clinic_admin', 'receptionist', 'doctor')
    AND clinic_id = get_user_clinic_id()
  );

-- -------------------------------------------------------
-- 1d. CHATBOT_CONFIG: SELECT USING (TRUE) leaks all configs
-- Any authenticated user could read chatbot configs for ALL
-- clinics. Restrict to own clinic + unauthenticated access
-- (public chatbot widget needs it for the current clinic).
-- -------------------------------------------------------

DROP POLICY IF EXISTS "chatbot_config_select_public" ON chatbot_config;
CREATE POLICY "chatbot_config_select_clinic" ON chatbot_config
  FOR SELECT USING (
    clinic_id = get_user_clinic_id()
    OR auth.uid() IS NULL  -- Unauthenticated (public chatbot widget)
  );

-- -------------------------------------------------------
-- 1e. CHATBOT_FAQS: SELECT leaks active FAQs cross-tenant
-- Same issue as chatbot_config — restrict to own clinic.
-- -------------------------------------------------------

DROP POLICY IF EXISTS "chatbot_faqs_select_public" ON chatbot_faqs;
CREATE POLICY "chatbot_faqs_select_clinic" ON chatbot_faqs
  FOR SELECT USING (
    is_active = TRUE
    AND (
      clinic_id = get_user_clinic_id()
      OR auth.uid() IS NULL  -- Unauthenticated (public chatbot widget)
    )
  );

-- -------------------------------------------------------
-- 1f. PATIENT APPOINTMENTS: SELECT/INSERT missing clinic_id
-- A patient could see/create appointments across clinics
-- since the policy only checked patient_id, not clinic_id.
-- -------------------------------------------------------

DROP POLICY IF EXISTS "patient_appointments_select" ON appointments;
CREATE POLICY "patient_appointments_select" ON appointments
  FOR SELECT USING (
    patient_id = get_my_user_id()
    AND get_user_role() = 'patient'
    AND clinic_id = get_user_clinic_id()
  );

DROP POLICY IF EXISTS "patient_appointments_insert" ON appointments;
CREATE POLICY "patient_appointments_insert" ON appointments
  FOR INSERT WITH CHECK (
    patient_id = get_my_user_id()
    AND get_user_role() = 'patient'
    AND clinic_id = get_user_clinic_id()
  );

DROP POLICY IF EXISTS "patient_appointments_update" ON appointments;
CREATE POLICY "patient_appointments_update" ON appointments
  FOR UPDATE USING (
    patient_id = get_my_user_id()
    AND get_user_role() = 'patient'
    AND clinic_id = get_user_clinic_id()
    AND status IN ('pending', 'confirmed')
  ) WITH CHECK (
    patient_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
    AND status IN ('pending', 'confirmed', 'cancelled', 'rescheduled')
  );

-- -------------------------------------------------------
-- 1g. APPOINTMENT_DOCTORS: staff WITH CHECK missing clinic_id
-- Staff could associate doctors with appointments in other
-- clinics since WITH CHECK didn't verify clinic_id.
-- -------------------------------------------------------

DROP POLICY IF EXISTS "staff_appointment_doctors" ON appointment_doctors;
CREATE POLICY "staff_appointment_doctors" ON appointment_doctors
  FOR ALL USING (
    is_clinic_staff()
    AND EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.id = appointment_doctors.appointment_id
        AND a.clinic_id = get_user_clinic_id()
    )
  ) WITH CHECK (
    is_clinic_staff()
    AND EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.id = appointment_doctors.appointment_id
        AND a.clinic_id = get_user_clinic_id()
    )
  );

-- -------------------------------------------------------
-- 1h. COLLECTION_POINTS: public SELECT USING (TRUE) leaks
-- all collection points across tenants. Restrict to own
-- clinic + unauthenticated (public website needs it).
-- -------------------------------------------------------

DROP POLICY IF EXISTS "public_collection_points_read" ON collection_points;
CREATE POLICY "public_collection_points_read" ON collection_points
  FOR SELECT USING (
    clinic_id = get_user_clinic_id()
    OR auth.uid() IS NULL  -- Unauthenticated (public website)
  );

-- -------------------------------------------------------
-- 1i. LAB_TESTS: public SELECT leaks cross-tenant
-- Same issue — restrict to own clinic + unauthenticated.
-- -------------------------------------------------------

DROP POLICY IF EXISTS "public_lab_tests_read" ON lab_tests;
CREATE POLICY "public_lab_tests_read" ON lab_tests
  FOR SELECT USING (
    is_active = TRUE
    AND (
      clinic_id = get_user_clinic_id()
      OR auth.uid() IS NULL  -- Unauthenticated (public website)
    )
  );

-- -------------------------------------------------------
-- 1j. BLOG_POSTS: public SELECT leaks cross-tenant
-- Published blog posts from ALL clinics are visible to any
-- authenticated user. Restrict to own clinic + unauthenticated.
-- -------------------------------------------------------

DROP POLICY IF EXISTS "blog_posts_select_published" ON blog_posts;
CREATE POLICY "blog_posts_select_published" ON blog_posts
  FOR SELECT USING (
    is_published = TRUE
    AND (
      clinic_id = get_user_clinic_id()
      OR auth.uid() IS NULL  -- Unauthenticated (public website)
    )
  );

-- -------------------------------------------------------
-- 1k. PAYMENTS: patient SELECT missing clinic_id
-- A patient could see their payment records across clinics.
-- -------------------------------------------------------

DROP POLICY IF EXISTS "payments_select_patient" ON payments;
CREATE POLICY "payments_select_patient" ON payments
  FOR SELECT USING (
    patient_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- -------------------------------------------------------
-- 1l. REVIEWS: patient INSERT/UPDATE missing clinic_id
-- A patient could create/update reviews for any clinic.
-- -------------------------------------------------------

DROP POLICY IF EXISTS "reviews_insert_patient" ON reviews;
CREATE POLICY "reviews_insert_patient" ON reviews
  FOR INSERT WITH CHECK (
    patient_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

DROP POLICY IF EXISTS "reviews_update_patient" ON reviews;
CREATE POLICY "reviews_update_patient" ON reviews
  FOR UPDATE USING (
    patient_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  ) WITH CHECK (
    patient_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- -------------------------------------------------------
-- 1m. DOCUMENTS: own-user SELECT/INSERT missing clinic_id
-- A patient could read/upload documents across clinics.
-- -------------------------------------------------------

DROP POLICY IF EXISTS "documents_select_own" ON documents;
CREATE POLICY "documents_select_own" ON documents
  FOR SELECT USING (
    user_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

DROP POLICY IF EXISTS "documents_insert_own" ON documents;
CREATE POLICY "documents_insert_own" ON documents
  FOR INSERT WITH CHECK (
    user_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- -------------------------------------------------------
-- 1n. PRESCRIPTIONS: patient SELECT / doctor manage
-- missing clinic_id. Add clinic_id column and fix policies.
-- -------------------------------------------------------

ALTER TABLE prescriptions
  ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE;

-- Backfill from doctor's clinic
UPDATE prescriptions p
SET clinic_id = u.clinic_id
FROM users u
WHERE p.doctor_id = u.id
  AND p.clinic_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_prescriptions_clinic ON prescriptions(clinic_id);

DROP POLICY IF EXISTS "prescriptions_select_patient" ON prescriptions;
CREATE POLICY "prescriptions_select_patient" ON prescriptions
  FOR SELECT USING (
    patient_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

DROP POLICY IF EXISTS "prescriptions_manage_doctor" ON prescriptions;
CREATE POLICY "prescriptions_manage_doctor" ON prescriptions
  FOR ALL USING (
    doctor_id = get_my_user_id()
    AND get_user_role() = 'doctor'
    AND clinic_id = get_user_clinic_id()
  ) WITH CHECK (
    doctor_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

DROP POLICY IF EXISTS "prescriptions_select_admin" ON prescriptions;
CREATE POLICY "prescriptions_select_admin" ON prescriptions
  FOR SELECT USING (
    get_user_role() = 'clinic_admin'
    AND clinic_id = get_user_clinic_id()
  );

-- -------------------------------------------------------
-- 1o. CONSULTATION_NOTES: missing clinic_id column.
-- Add clinic_id, backfill, and fix policies.
-- -------------------------------------------------------

ALTER TABLE consultation_notes
  ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE;

UPDATE consultation_notes cn
SET clinic_id = u.clinic_id
FROM users u
WHERE cn.doctor_id = u.id
  AND cn.clinic_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_consultation_notes_clinic ON consultation_notes(clinic_id);

DROP POLICY IF EXISTS "consultation_notes_manage_doctor" ON consultation_notes;
CREATE POLICY "consultation_notes_manage_doctor" ON consultation_notes
  FOR ALL USING (
    doctor_id = get_my_user_id()
    AND get_user_role() = 'doctor'
    AND clinic_id = get_user_clinic_id()
  ) WITH CHECK (
    doctor_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

DROP POLICY IF EXISTS "consultation_notes_select_admin" ON consultation_notes;
CREATE POLICY "consultation_notes_select_admin" ON consultation_notes
  FOR SELECT USING (
    get_user_role() = 'clinic_admin'
    AND clinic_id = get_user_clinic_id()
  );

DROP POLICY IF EXISTS "consultation_notes_select_patient" ON consultation_notes;
CREATE POLICY "consultation_notes_select_patient" ON consultation_notes
  FOR SELECT USING (
    patient_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
    AND private = FALSE
  );

-- -------------------------------------------------------
-- 1p. FAMILY_MEMBERS: missing clinic_id column.
-- A user could see family members of patients in other
-- clinics via the staff policy (only checks primary_user_id
-- join, but doesn't enforce on WITH CHECK).
-- -------------------------------------------------------

ALTER TABLE family_members
  ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE;

UPDATE family_members fm
SET clinic_id = u.clinic_id
FROM users u
WHERE fm.primary_user_id = u.id
  AND fm.clinic_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_family_members_clinic ON family_members(clinic_id);

DROP POLICY IF EXISTS "family_members_manage_own" ON family_members;
CREATE POLICY "family_members_manage_own" ON family_members
  FOR ALL USING (
    primary_user_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  ) WITH CHECK (
    primary_user_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

DROP POLICY IF EXISTS "family_members_select_staff" ON family_members;
CREATE POLICY "family_members_select_staff" ON family_members
  FOR SELECT USING (
    is_clinic_staff()
    AND clinic_id = get_user_clinic_id()
  );

-- -------------------------------------------------------
-- 1q. TREATMENT_PLANS: patient SELECT / doctor manage
-- missing clinic_id enforcement. clinic_id was added in
-- 00005 but policies never used it.
-- -------------------------------------------------------

DROP POLICY IF EXISTS "treatment_plans_select_patient" ON treatment_plans;
CREATE POLICY "treatment_plans_select_patient" ON treatment_plans
  FOR SELECT USING (
    patient_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

DROP POLICY IF EXISTS "treatment_plans_manage_doctor" ON treatment_plans;
CREATE POLICY "treatment_plans_manage_doctor" ON treatment_plans
  FOR ALL USING (
    doctor_id = get_my_user_id()
    AND get_user_role() = 'doctor'
    AND clinic_id = get_user_clinic_id()
  ) WITH CHECK (
    doctor_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

DROP POLICY IF EXISTS "treatment_plans_select_admin" ON treatment_plans;
CREATE POLICY "treatment_plans_select_admin" ON treatment_plans
  FOR SELECT USING (
    get_user_role() = 'clinic_admin'
    AND clinic_id = get_user_clinic_id()
  );

-- -------------------------------------------------------
-- 1r. WAITING_LIST: patient policies missing clinic_id
-- -------------------------------------------------------

DROP POLICY IF EXISTS "patient_waiting_list_select" ON waiting_list;
CREATE POLICY "patient_waiting_list_select" ON waiting_list
  FOR SELECT USING (
    patient_id = get_my_user_id()
    AND get_user_role() = 'patient'
    AND clinic_id = get_user_clinic_id()
  );

DROP POLICY IF EXISTS "patient_waiting_list_insert" ON waiting_list;
CREATE POLICY "patient_waiting_list_insert" ON waiting_list
  FOR INSERT WITH CHECK (
    patient_id = get_my_user_id()
    AND get_user_role() = 'patient'
    AND clinic_id = get_user_clinic_id()
  );

DROP POLICY IF EXISTS "patient_waiting_list_delete" ON waiting_list;
CREATE POLICY "patient_waiting_list_delete" ON waiting_list
  FOR DELETE USING (
    patient_id = get_my_user_id()
    AND get_user_role() = 'patient'
    AND clinic_id = get_user_clinic_id()
  );

-- -------------------------------------------------------
-- 1s. INSTALLMENTS: patient SELECT missing clinic_id
-- -------------------------------------------------------

DROP POLICY IF EXISTS "installments_select_patient" ON installments;
CREATE POLICY "installments_select_patient" ON installments
  FOR SELECT USING (
    patient_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- -------------------------------------------------------
-- 1t. NOTIFICATIONS: own-user SELECT missing clinic_id
-- -------------------------------------------------------

DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT USING (
    user_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (
    user_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  ) WITH CHECK (
    user_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- -------------------------------------------------------
-- 1u. LOYALTY_POINTS: patient SELECT missing clinic_id
-- -------------------------------------------------------

DROP POLICY IF EXISTS "loyalty_points_select_patient" ON loyalty_points;
CREATE POLICY "loyalty_points_select_patient" ON loyalty_points
  FOR SELECT USING (
    patient_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- -------------------------------------------------------
-- 1v. PRESCRIPTION_REQUESTS: patient manage missing clinic_id
-- -------------------------------------------------------

DROP POLICY IF EXISTS "prescription_requests_manage_patient" ON prescription_requests;
CREATE POLICY "prescription_requests_manage_patient" ON prescription_requests
  FOR ALL USING (
    patient_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  ) WITH CHECK (
    patient_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- -------------------------------------------------------
-- 1w. ODONTOGRAM: patient SELECT missing clinic_id
-- -------------------------------------------------------

DROP POLICY IF EXISTS "odontogram_select_patient" ON odontogram;
CREATE POLICY "odontogram_select_patient" ON odontogram
  FOR SELECT USING (
    patient_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- ============================================================
-- 2. ENABLE RLS ON rate_limit_entries (if exists)
-- This table is accessed by the service role only but should
-- still have RLS enabled as defense-in-depth.
-- ============================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rate_limit_entries' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE rate_limit_entries ENABLE ROW LEVEL SECURITY';
    -- No user-facing policies needed — service role bypasses RLS.
    -- This ensures anon/authenticated users cannot access rate limit data.
  END IF;
END $$;

-- ============================================================
-- 3. ADD MISSING INDEXES FOR TENANT ISOLATION PERFORMANCE
-- ============================================================

-- Notifications: index on clinic_id (column added in 00019)
CREATE INDEX IF NOT EXISTS idx_notifications_clinic ON notifications(clinic_id);

-- Installments: index on clinic_id (column added in 00005)
CREATE INDEX IF NOT EXISTS idx_installments_clinic ON installments(clinic_id);

-- Treatment plans: index on clinic_id (column added in 00005)
CREATE INDEX IF NOT EXISTS idx_treatment_plans_clinic ON treatment_plans(clinic_id);

-- Notification log: compound index for cron job queries
CREATE INDEX IF NOT EXISTS idx_notification_log_appt_trigger
  ON notification_log(appointment_id, trigger);

-- Appointments: compound index for cron reminder lookups
CREATE INDEX IF NOT EXISTS idx_appointments_date_status
  ON appointments(appointment_date, status)
  WHERE status IN ('confirmed', 'pending');

-- Users: compound index for clinic + role lookups
CREATE INDEX IF NOT EXISTS idx_users_clinic_role ON users(clinic_id, role);

-- Payments: compound index for clinic + status
CREATE INDEX IF NOT EXISTS idx_payments_clinic_status ON payments(clinic_id, status);

-- Clinic subscriptions: index for billing cron
CREATE INDEX IF NOT EXISTS idx_clinic_subscriptions_period_end
  ON clinic_subscriptions(current_period_end)
  WHERE status IN ('active', 'past_due');
