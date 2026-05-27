-- =============================================================================
-- Migration 00084: Add patient_message_locale to public_clinic_directory view
--
-- AUDIT FINDING #2 (P0 Critical): The middleware needs to propagate the
-- clinic's configured locale via the x-tenant-locale header so that
-- layout.tsx, manifest.ts, and not-found.tsx render the correct language
-- and text direction (LTR/RTL).
--
-- The public_clinic_directory view (created in 00068, updated in 00070)
-- is the only table/view accessible to anon callers during subdomain
-- resolution. This migration adds `patient_message_locale` so the
-- middleware can read the clinic's locale without an authenticated query.
--
-- patient_message_locale is not sensitive — it's a language preference
-- ('fr', 'ar', 'darija') already visible in the public-facing UI via
-- the locale switcher and page language/direction attributes.
-- =============================================================================

BEGIN;

DROP VIEW IF EXISTS public_clinic_directory;

CREATE VIEW public_clinic_directory AS
SELECT id, name, subdomain, type, tier, status, patient_message_locale
FROM clinics
WHERE status = 'active';

GRANT SELECT ON public_clinic_directory TO anon;

COMMIT;
