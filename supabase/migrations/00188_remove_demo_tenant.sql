-- Migration 00188: Remove the seeded demo tenant from the database.
--
-- CONTEXT
--   Migrations 00046 + 00053 seeded a fake "Cabinet Demo Oltigo" tenant
--   (clinic c0000000-de00-0000-0000-000000000001) plus fake doctors,
--   patients, services, time slots, appointments, reviews, payments,
--   prescriptions and consultation notes directly into EVERY environment,
--   including production. Those two migrations are now no-op stubs and the
--   demo tenant is seeded from supabase/seed.sql instead, which runs only on
--   local/CI (`supabase db reset` / `supabase start`) and never in
--   production (production migrates via `supabase db push`, which does not
--   apply seed.sql).
--
--   This migration deletes the demo rows that 00046/00053 had already
--   written to the production database.
--
-- SAFETY / IDEMPOTENCY
--   Pre-launch: there is no real data, and every row removed here is scoped
--   to the well-known demo clinic (or to users that belong to it), so the
--   delete is safe and intentional. Re-running deletes nothing once clean.
--   Each statement is guarded with to_regclass so the migration also applies
--   cleanly if a table has since been dropped.
--
-- ORDERING ON FRESH DATABASES
--   On a fresh local/CI database this migration runs during the migration
--   phase, BEFORE seed.sql. With 00046/00053 stubbed, there is nothing to
--   delete here; seed.sql then (re)creates the demo tenant. In production
--   seed.sql is not applied, so the demo tenant is removed and stays removed.

BEGIN;

DO $$
DECLARE
  demo_clinic CONSTANT uuid := 'c0000000-de00-0000-0000-000000000001';
BEGIN
  -- Clinical demo content first. These rows are scoped by their demo owner
  -- (patient/doctor) rather than clinic_id, because the demo seed left
  -- clinic_id NULL on prescriptions / consultation_notes.
  IF to_regclass('public.consultation_notes') IS NOT NULL THEN
    DELETE FROM consultation_notes
    WHERE patient_id IN (SELECT id FROM users WHERE clinic_id = demo_clinic)
       OR doctor_id  IN (SELECT id FROM users WHERE clinic_id = demo_clinic);
  END IF;

  IF to_regclass('public.prescriptions') IS NOT NULL THEN
    DELETE FROM prescriptions
    WHERE patient_id IN (SELECT id FROM users WHERE clinic_id = demo_clinic)
       OR doctor_id  IN (SELECT id FROM users WHERE clinic_id = demo_clinic);
  END IF;

  -- Operational demo rows (all carry clinic_id = the demo clinic).
  IF to_regclass('public.payments') IS NOT NULL THEN
    DELETE FROM payments WHERE clinic_id = demo_clinic;
  END IF;

  IF to_regclass('public.reviews') IS NOT NULL THEN
    DELETE FROM reviews WHERE clinic_id = demo_clinic;
  END IF;

  IF to_regclass('public.appointments') IS NOT NULL THEN
    DELETE FROM appointments WHERE clinic_id = demo_clinic;
  END IF;

  IF to_regclass('public.time_slots') IS NOT NULL THEN
    DELETE FROM time_slots WHERE clinic_id = demo_clinic;
  END IF;

  IF to_regclass('public.services') IS NOT NULL THEN
    DELETE FROM services WHERE clinic_id = demo_clinic;
  END IF;

  IF to_regclass('public.users') IS NOT NULL THEN
    DELETE FROM users WHERE clinic_id = demo_clinic;
  END IF;

  IF to_regclass('public.clinics') IS NOT NULL THEN
    DELETE FROM clinics WHERE id = demo_clinic;
  END IF;
END $$;

COMMIT;
