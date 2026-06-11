-- 00180: Enable Row-Level Security on patient_files (audit 2026-06-09, Task 1 / P0)
--
-- patient_files is the system of record for PHI uploads (R2 object keys,
-- encryption IVs, patient/clinic linkage). It was the only one of the
-- 261 tables without ENABLE ROW LEVEL SECURITY: 00165 created it (as a
-- guard for environments where it was historically provisioned
-- out-of-band) and gave its sibling medical_alerts a clinic-scoped
-- policy in the same file, but never enabled RLS on patient_files itself.
--
-- This migration applies the exact defense-in-depth pattern used for
-- medical_alerts in 00165:
--   * RLS enabled on the table
--   * one clinic-scoped policy keyed on get_request_clinic_id()
--     (see 00041_fix_rls_use_request_headers.sql) for authenticated users
--
-- Impact on existing code paths (verified at time of writing):
--   * supabase/functions/parse-medical-document uses the service-role key
--     and bypasses RLS — unaffected.
--   * api/files/download and api/files/extraction-status run with an
--     authenticated session client plus tenant context set by with-auth,
--     so same-clinic access continues to work; cross-clinic access is now
--     also blocked at the database layer, not just in route code.
--
-- All operations are idempotent (safe to re-run; safe on environments
-- where the table predates the migration chain).

ALTER TABLE patient_files ENABLE ROW LEVEL SECURITY;

-- Authenticated users may access file records for their own clinic only.
-- For a FOR ALL policy the USING clause also serves as the WITH CHECK
-- clause, so cross-clinic INSERT/UPDATE/DELETE is denied as well.
DO $$ BEGIN
  CREATE POLICY "patient_files_clinic_access"
    ON patient_files FOR ALL
    USING (
      clinic_id = get_request_clinic_id()
      AND auth.role() = 'authenticated'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
