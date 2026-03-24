-- ============================================================
-- Migration 00033: Fix Phase-6 (Hospital/Center) Tables RLS
--
-- SECURITY FIX: Replace dangerously permissive FOR SELECT
-- USING (true) policies on 18 hospital/center tables from
-- migration 00015.
--
-- These policies allow ANY authenticated user to read ALL
-- clinics' data (admissions, IVF cycles, dialysis sessions,
-- consultation photos, etc.). Migration 00019 added proper
-- staff WRITE and patient READ policies alongside them, but
-- never dropped the permissive SELECT policies.
--
-- This migration drops those policies and replaces them with
-- clinic-scoped SELECT policies using get_user_clinic_id().
--
-- Affected tables (all have clinic_id NOT NULL):
--   departments, doctor_departments, rooms, beds, admissions,
--   photo_consent_forms, treatment_packages, patient_packages,
--   consultation_photos, ivf_cycles, ivf_protocols,
--   ivf_timeline_events, dialysis_machines, dialysis_sessions,
--   prosthetic_orders, lab_materials, lab_deliveries, lab_invoices
-- ============================================================

-- -------------------------------------------------------
-- 1. DROP the permissive SELECT policies from 00015
-- -------------------------------------------------------

DROP POLICY IF EXISTS "departments_select" ON departments;
DROP POLICY IF EXISTS "doctor_departments_select" ON doctor_departments;
DROP POLICY IF EXISTS "rooms_select" ON rooms;
DROP POLICY IF EXISTS "beds_select" ON beds;
DROP POLICY IF EXISTS "admissions_select" ON admissions;
DROP POLICY IF EXISTS "photo_consent_forms_select" ON photo_consent_forms;
DROP POLICY IF EXISTS "treatment_packages_select" ON treatment_packages;
DROP POLICY IF EXISTS "patient_packages_select" ON patient_packages;
DROP POLICY IF EXISTS "consultation_photos_select" ON consultation_photos;
DROP POLICY IF EXISTS "ivf_cycles_select" ON ivf_cycles;
DROP POLICY IF EXISTS "ivf_protocols_select" ON ivf_protocols;
DROP POLICY IF EXISTS "ivf_timeline_events_select" ON ivf_timeline_events;
DROP POLICY IF EXISTS "dialysis_machines_select" ON dialysis_machines;
DROP POLICY IF EXISTS "dialysis_sessions_select" ON dialysis_sessions;
DROP POLICY IF EXISTS "prosthetic_orders_select" ON prosthetic_orders;
DROP POLICY IF EXISTS "lab_materials_select" ON lab_materials;
DROP POLICY IF EXISTS "lab_deliveries_select" ON lab_deliveries;
DROP POLICY IF EXISTS "lab_invoices_select" ON lab_invoices;

-- -------------------------------------------------------
-- 2. CREATE clinic-scoped SELECT policies
--
-- These allow any authenticated user at the same clinic to
-- read operational data (departments, rooms, beds, etc.).
-- Patient-specific read policies (ivf_cycles, dialysis_sessions,
-- consent_forms, patient_packages, consultation_photos) were
-- already added in migration 00019.
-- -------------------------------------------------------

CREATE POLICY "departments_select_clinic" ON departments
  FOR SELECT USING (clinic_id = get_user_clinic_id());

CREATE POLICY "doctor_departments_select_clinic" ON doctor_departments
  FOR SELECT USING (clinic_id = get_user_clinic_id());

CREATE POLICY "rooms_select_clinic" ON rooms
  FOR SELECT USING (clinic_id = get_user_clinic_id());

CREATE POLICY "beds_select_clinic" ON beds
  FOR SELECT USING (clinic_id = get_user_clinic_id());

CREATE POLICY "admissions_select_clinic" ON admissions
  FOR SELECT USING (clinic_id = get_user_clinic_id());

CREATE POLICY "photo_consent_forms_select_clinic" ON photo_consent_forms
  FOR SELECT USING (clinic_id = get_user_clinic_id());

CREATE POLICY "treatment_packages_select_clinic" ON treatment_packages
  FOR SELECT USING (clinic_id = get_user_clinic_id());

CREATE POLICY "patient_packages_select_clinic" ON patient_packages
  FOR SELECT USING (clinic_id = get_user_clinic_id());

CREATE POLICY "consultation_photos_select_clinic" ON consultation_photos
  FOR SELECT USING (clinic_id = get_user_clinic_id());

CREATE POLICY "ivf_cycles_select_clinic" ON ivf_cycles
  FOR SELECT USING (clinic_id = get_user_clinic_id());

CREATE POLICY "ivf_protocols_select_clinic" ON ivf_protocols
  FOR SELECT USING (clinic_id = get_user_clinic_id());

CREATE POLICY "ivf_timeline_events_select_clinic" ON ivf_timeline_events
  FOR SELECT USING (clinic_id = get_user_clinic_id());

CREATE POLICY "dialysis_machines_select_clinic" ON dialysis_machines
  FOR SELECT USING (clinic_id = get_user_clinic_id());

CREATE POLICY "dialysis_sessions_select_clinic" ON dialysis_sessions
  FOR SELECT USING (clinic_id = get_user_clinic_id());

CREATE POLICY "prosthetic_orders_select_clinic" ON prosthetic_orders
  FOR SELECT USING (clinic_id = get_user_clinic_id());

CREATE POLICY "lab_materials_select_clinic" ON lab_materials
  FOR SELECT USING (clinic_id = get_user_clinic_id());

CREATE POLICY "lab_deliveries_select_clinic" ON lab_deliveries
  FOR SELECT USING (clinic_id = get_user_clinic_id());

CREATE POLICY "lab_invoices_select_clinic" ON lab_invoices
  FOR SELECT USING (clinic_id = get_user_clinic_id());
