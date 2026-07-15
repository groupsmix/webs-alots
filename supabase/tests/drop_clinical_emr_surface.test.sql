-- ============================================================================
-- 00187: Pin the removal of the clinical / EMR surface.
-- ============================================================================
--
-- Migration 00187_drop_clinical_emr_surface.sql permanently drops the 13
-- clinical / EMR tables that must not exist on an operations-only platform,
-- while preserving the operational schema (appointments, clinics, users,
-- billing) and the operational patient timeline view.
--
-- This test fails loudly if:
--   * any dropped clinical table is re-introduced, or
--   * an operational table (appointments / clinics / users) is
--     removed as collateral damage, or
--   * the clinical-encounter guard function survives, or
--   * the operational `patient_timeline_events` view is lost.
--
-- Run locally with pgTAP (https://pgtap.org/) installed:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/drop_clinical_emr_surface.test.sql
-- or via the Supabase CLI:
--   supabase test db
--
-- Wrapped in a transaction that rolls back; safe to run repeatedly against any
-- database where migration 00187 has been applied.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(17);

-- ── 1-12. Every dropped clinical / EMR table is gone ──────────────────────
SELECT hasnt_table('public', 'clinical_encounters', 'clinical_encounters dropped');
SELECT hasnt_table('public', 'encounter_addenda', 'encounter_addenda dropped');
SELECT hasnt_table('public', 'cdss_override_log', 'cdss_override_log dropped');
SELECT hasnt_table('public', 'drug_interactions', 'drug_interactions dropped');
SELECT hasnt_table('public', 'drug_interaction_alerts', 'drug_interaction_alerts dropped');
SELECT hasnt_table('public', 'lab_results', 'lab_results dropped');
SELECT hasnt_table('public', 'lab_test_orders', 'lab_test_orders dropped');
SELECT hasnt_table('public', 'lab_tests', 'lab_tests dropped');
SELECT hasnt_table('public', 'prescription_drafts', 'prescription_drafts dropped');
SELECT hasnt_table(
  'public', 'prescription_renewal_requests', 'prescription_renewal_requests dropped'
);
SELECT hasnt_table('public', 'prescription_renewals', 'prescription_renewals dropped');
SELECT hasnt_table('public', 'telemedicine_sessions', 'telemedicine_sessions dropped');

-- ── 13-15. Operational tables are untouched ───────────────────────────────
SELECT has_table('public', 'appointments', 'appointments retained');
SELECT has_table('public', 'clinics', 'clinics retained');
SELECT has_table('public', 'users', 'users retained');

-- ── 16. The clinical-encounter edit guard function is gone ────────────────
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'prevent_signed_encounter_edit'
  ),
  'prevent_signed_encounter_edit() removed'
);

-- ── 17. The operational patient timeline view survives the CASCADE ────────
SELECT has_view(
  'public', 'patient_timeline_events', 'operational patient_timeline_events view retained'
);

SELECT * FROM finish();
ROLLBACK;
