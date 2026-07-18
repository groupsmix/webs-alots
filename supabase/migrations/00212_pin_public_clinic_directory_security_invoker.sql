-- =============================================================================
-- Migration 00212: Pin public_clinic_directory to security_invoker = off
--
-- INCIDENT: All tenant subdomains returned a hard 404 in production because
-- `public_clinic_directory` had been switched to `security_invoker = on`
-- (most likely via Supabase's Security Advisor "fix" for SECURITY DEFINER
-- views). With security_invoker = on the view executes as the *querying*
-- role (anon) and therefore enforces the underlying `clinics` RLS, which has
-- no anonymous SELECT policy. Anon subdomain resolution in the middleware
-- (src/lib/middleware/subdomain-resolution.ts) then returned zero rows and
-- every clinic 404'd.
--
-- DESIGN INTENT (see migration 00068 S-07): this view is the ONLY clinics
-- surface exposed to anon callers and it deliberately relies on
-- `GRANT SELECT ... TO anon` INSTEAD of RLS. It must run with the view
-- owner's privileges (security_invoker = off) so it bypasses `clinics` RLS
-- and returns only the safe, non-PHI subset selected below.
--
-- This migration recreates the view with security_invoker explicitly OFF so
-- the setting is captured in source control and cannot silently drift again.
-- The column list and WHERE clause are unchanged from migration 00095/00096.
-- =============================================================================

BEGIN;

DROP VIEW IF EXISTS public_clinic_directory;

CREATE VIEW public_clinic_directory
WITH (security_invoker = off) AS
SELECT id, name, subdomain, type, tier, status, patient_message_locale
FROM clinics
WHERE status = 'active'
  AND deleted_at IS NULL;

GRANT SELECT ON public_clinic_directory TO anon;

COMMENT ON VIEW public_clinic_directory IS
  'SEC-10 / S-07: Restricted, non-PHI subset of clinics exposed to anonymous '
  'callers for subdomain resolution. Runs with security_invoker = off so it '
  'relies on GRANT SELECT TO anon instead of clinics RLS. Do NOT switch to '
  'security_invoker = on (see migration 00212) — it takes all tenant '
  'subdomains offline.';

COMMIT;
