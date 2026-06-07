-- 00163: Allow authenticated users to insert their own consent_records rows.
--
-- Background
-- ----------
-- Migration 00160 introduced public.consent_records with RLS and only the
-- following INSERT policy:
--
--   CREATE POLICY service_role_insert_consent_records
--     ON public.consent_records FOR INSERT TO service_role WITH CHECK (true);
--
-- This forced /api/consent to acquire a service-role client to write the
-- structured consent ledger, even though the writer is always the
-- authenticated end user recording their own consent decision.
-- corridor-security flagged that pattern on PR #980: using a service-role
-- client (which bypasses RLS) together with a request-influenced
-- `user_id` is a consent-forgery risk if the userId derivation ever
-- regresses.
--
-- This migration restores defense in depth by letting the user's own
-- authenticated session write the row, with RLS enforcing that the row's
-- user_id resolves to the authenticated user's profile AND the row's
-- clinic_id matches that profile's clinic. The application code switches
-- to the tenant-scoped client; the service-role policy stays in place
-- for server-internal flows (cron, super-admin tools).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'consent_records'
      AND policyname = 'user_inserts_own_consent_records'
  ) THEN
    CREATE POLICY user_inserts_own_consent_records
      ON public.consent_records
      FOR INSERT
      TO authenticated
      WITH CHECK (
        user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
        AND clinic_id = (SELECT clinic_id FROM public.users WHERE auth_id = auth.uid())
      );
  END IF;
END $$;

COMMENT ON POLICY user_inserts_own_consent_records ON public.consent_records IS
  'PR #980 follow-up. Allows authenticated users to record their own
   consent decisions without a service-role client. RLS enforces that the
   inserted user_id and clinic_id match the caller''s profile, preventing
   consent forgery for arbitrary users.';
