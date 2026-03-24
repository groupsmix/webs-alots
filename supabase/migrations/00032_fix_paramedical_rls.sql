-- ============================================================
-- Migration 00032: Fix Para-Medical Tables RLS
--
-- SECURITY FIX: Remove dangerously permissive USING (true)
-- WITH CHECK (true) policies on 13 para-medical tables.
--
-- These "allow_all_*" policies were created in 00013 and grant
-- ANY authenticated user full CRUD access to ALL clinics' data.
-- Proper clinic-scoped staff, super-admin, and patient policies
-- were already added in migration 00019, so removing the
-- allow_all_* policies is sufficient to enforce tenant isolation.
--
-- Affected tables (all have clinic_id NOT NULL):
--   exercise_programs, physio_sessions, progress_photos,
--   meal_plans, body_measurements,
--   therapy_session_notes, therapy_plans,
--   speech_exercises, speech_sessions, speech_progress_reports,
--   lens_inventory, frame_catalog, optical_prescriptions
-- ============================================================

-- Drop the dangerously permissive policies from migration 00013.
-- After this, the only remaining policies on each table are the
-- properly scoped ones from 00019:
--   - sa_*_all         → super_admin full access
--   - staff_*          → clinic_id = get_user_clinic_id() AND is_clinic_staff()
--   - patient_*_read   → patient_id = get_my_user_id()

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'exercise_programs','physio_sessions','progress_photos',
    'meal_plans','body_measurements',
    'therapy_session_notes','therapy_plans',
    'speech_exercises','speech_sessions','speech_progress_reports',
    'lens_inventory','frame_catalog','optical_prescriptions'
  ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'allow_all_' || tbl, tbl);
  END LOOP;
END $$;
