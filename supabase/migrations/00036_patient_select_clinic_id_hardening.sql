-- ============================================================
-- Migration 00036: Patient SELECT Policy Clinic-ID Hardening
--
-- Defense-in-depth improvement: adds AND clinic_id = get_user_clinic_id()
-- to all patient SELECT policies that currently only check
-- patient_id = get_my_user_id().
--
-- WHY: While patient_id alone is globally unique (UUID) and the
-- auth_id UNIQUE constraint on the users table prevents a patient
-- from existing in multiple clinics, adding the clinic_id check
-- provides an extra safety net against hypothetical future bugs
-- that might allow cross-clinic patient_id references.
--
-- RISK: None — this is strictly additive. A patient can only
-- belong to one clinic, so the additional clause never filters
-- out legitimate rows.
--
-- Addresses: Security Audit Finding A (defense-in-depth)
-- ============================================================

-- ============================================================
-- 1. SPECIALTY MODULES (from 00018 / 00011)
-- ============================================================

-- growth_measurements
DROP POLICY IF EXISTS "patient_growth_measurements_read" ON growth_measurements;
CREATE POLICY "patient_growth_measurements_read" ON growth_measurements
  FOR SELECT USING (
    patient_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- vaccinations
DROP POLICY IF EXISTS "patient_vaccinations_read" ON vaccinations;
CREATE POLICY "patient_vaccinations_read" ON vaccinations
  FOR SELECT USING (
    patient_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- developmental_milestones
DROP POLICY IF EXISTS "patient_developmental_milestones_read" ON developmental_milestones;
CREATE POLICY "patient_developmental_milestones_read" ON developmental_milestones
  FOR SELECT USING (
    patient_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- pregnancies
DROP POLICY IF EXISTS "patient_pregnancies_read" ON pregnancies;
CREATE POLICY "patient_pregnancies_read" ON pregnancies
  FOR SELECT USING (
    patient_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- ultrasound_records
DROP POLICY IF EXISTS "patient_ultrasound_records_read" ON ultrasound_records;
CREATE POLICY "patient_ultrasound_records_read" ON ultrasound_records
  FOR SELECT USING (
    patient_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- vision_tests
DROP POLICY IF EXISTS "patient_vision_tests_read" ON vision_tests;
CREATE POLICY "patient_vision_tests_read" ON vision_tests
  FOR SELECT USING (
    patient_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- iop_measurements
DROP POLICY IF EXISTS "patient_iop_measurements_read" ON iop_measurements;
CREATE POLICY "patient_iop_measurements_read" ON iop_measurements
  FOR SELECT USING (
    patient_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- ============================================================
-- 2. SPECIALIST FEATURES (from 00018 / 00012)
-- ============================================================

-- skin_photos
DROP POLICY IF EXISTS "patient_skin_photos_read" ON skin_photos;
CREATE POLICY "patient_skin_photos_read" ON skin_photos
  FOR SELECT USING (
    patient_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- skin_conditions
DROP POLICY IF EXISTS "patient_skin_conditions_read" ON skin_conditions;
CREATE POLICY "patient_skin_conditions_read" ON skin_conditions
  FOR SELECT USING (
    patient_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- ecg_records
DROP POLICY IF EXISTS "patient_ecg_records_read" ON ecg_records;
CREATE POLICY "patient_ecg_records_read" ON ecg_records
  FOR SELECT USING (
    patient_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- blood_pressure_readings
DROP POLICY IF EXISTS "patient_bp_readings_read" ON blood_pressure_readings;
CREATE POLICY "patient_bp_readings_read" ON blood_pressure_readings
  FOR SELECT USING (
    patient_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- heart_monitoring_notes
DROP POLICY IF EXISTS "patient_heart_notes_read" ON heart_monitoring_notes;
CREATE POLICY "patient_heart_notes_read" ON heart_monitoring_notes
  FOR SELECT USING (
    patient_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- hearing_tests
DROP POLICY IF EXISTS "patient_hearing_tests_read" ON hearing_tests;
CREATE POLICY "patient_hearing_tests_read" ON hearing_tests
  FOR SELECT USING (
    patient_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- ent_exam_records
DROP POLICY IF EXISTS "patient_ent_exams_read" ON ent_exam_records;
CREATE POLICY "patient_ent_exams_read" ON ent_exam_records
  FOR SELECT USING (
    patient_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- xray_records
DROP POLICY IF EXISTS "patient_xray_records_read" ON xray_records;
CREATE POLICY "patient_xray_records_read" ON xray_records
  FOR SELECT USING (
    patient_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- fracture_records
DROP POLICY IF EXISTS "patient_fracture_records_read" ON fracture_records;
CREATE POLICY "patient_fracture_records_read" ON fracture_records
  FOR SELECT USING (
    patient_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- rehab_plans
DROP POLICY IF EXISTS "patient_rehab_plans_read" ON rehab_plans;
CREATE POLICY "patient_rehab_plans_read" ON rehab_plans
  FOR SELECT USING (
    patient_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- psych_medications
DROP POLICY IF EXISTS "patient_psych_meds_read" ON psych_medications;
CREATE POLICY "patient_psych_meds_read" ON psych_medications
  FOR SELECT USING (
    patient_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- eeg_records
DROP POLICY IF EXISTS "patient_eeg_records_read" ON eeg_records;
CREATE POLICY "patient_eeg_records_read" ON eeg_records
  FOR SELECT USING (
    patient_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- neuro_exam_records
DROP POLICY IF EXISTS "patient_neuro_exams_read" ON neuro_exam_records;
CREATE POLICY "patient_neuro_exams_read" ON neuro_exam_records
  FOR SELECT USING (
    patient_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- urology_exams
DROP POLICY IF EXISTS "patient_urology_exams_read" ON urology_exams;
CREATE POLICY "patient_urology_exams_read" ON urology_exams
  FOR SELECT USING (
    patient_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- spirometry_records
DROP POLICY IF EXISTS "patient_spirometry_read" ON spirometry_records;
CREATE POLICY "patient_spirometry_read" ON spirometry_records
  FOR SELECT USING (
    patient_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- respiratory_tests
DROP POLICY IF EXISTS "patient_respiratory_tests_read" ON respiratory_tests;
CREATE POLICY "patient_respiratory_tests_read" ON respiratory_tests
  FOR SELECT USING (
    patient_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- blood_sugar_readings
DROP POLICY IF EXISTS "patient_blood_sugar_read" ON blood_sugar_readings;
CREATE POLICY "patient_blood_sugar_read" ON blood_sugar_readings
  FOR SELECT USING (
    patient_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- hormone_levels
DROP POLICY IF EXISTS "patient_hormone_levels_read" ON hormone_levels;
CREATE POLICY "patient_hormone_levels_read" ON hormone_levels
  FOR SELECT USING (
    patient_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- diabetes_management
DROP POLICY IF EXISTS "patient_diabetes_mgmt_read" ON diabetes_management;
CREATE POLICY "patient_diabetes_mgmt_read" ON diabetes_management
  FOR SELECT USING (
    patient_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- joint_assessments
DROP POLICY IF EXISTS "patient_joint_assessments_read" ON joint_assessments;
CREATE POLICY "patient_joint_assessments_read" ON joint_assessments
  FOR SELECT USING (
    patient_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- mobility_tests
DROP POLICY IF EXISTS "patient_mobility_tests_read" ON mobility_tests;
CREATE POLICY "patient_mobility_tests_read" ON mobility_tests
  FOR SELECT USING (
    patient_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- ============================================================
-- 3. DIAGNOSTIC (from 00018 / 00014)
-- ============================================================

-- radiology_orders
DROP POLICY IF EXISTS "patient_radiology_orders_read" ON radiology_orders;
CREATE POLICY "patient_radiology_orders_read" ON radiology_orders
  FOR SELECT USING (
    patient_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- ============================================================
-- 4. INVOICES & MEDICAL RECORDS (from 00023)
-- ============================================================

-- invoices
DROP POLICY IF EXISTS "patient_invoices_read" ON invoices;
CREATE POLICY "patient_invoices_read" ON invoices
  FOR SELECT USING (
    patient_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- medical_records
DROP POLICY IF EXISTS "patient_medical_records_read" ON medical_records;
CREATE POLICY "patient_medical_records_read" ON medical_records
  FOR SELECT USING (
    patient_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );
