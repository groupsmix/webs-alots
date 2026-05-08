-- =============================================================================
-- Migration 00070: Extend public_clinic_directory view with `tier`
--
-- Middleware (`src/middleware.ts`) resolves a tenant from the request
-- subdomain using an anonymous Supabase client. Migration 00068 (S-07)
-- dropped the broad `clinics_select_active_public` RLS policy and replaced
-- it with the narrower `public_clinic_directory` view, but the view did
-- not include the `tier` column that the middleware needs to populate
-- the `x-clinic-tier` tenant header.
--
-- Without `tier` in the view, anon subdomain resolution effectively
-- required the middleware to keep reading the `clinics` table directly
-- (which now returns 0 rows for anon callers). This breaks tenant
-- resolution for every unauthenticated request — including the Playwright
-- E2E suite, which hits `http://demo.localhost:3000` and gets redirected
-- to `http://localhost/` because no clinic is resolved.
--
-- `tier` is not sensitive (it's a tenant-visible plan identifier: `free`,
-- `pro`, `premium`, etc.) and already exposed via the tenant header on
-- every rendered page, so adding it to the anon-readable directory view
-- does not leak new information.
-- =============================================================================

BEGIN;

-- Postgres `CREATE OR REPLACE VIEW` only lets us append columns to the end
-- of the existing column list — it rejects any reorder or rename. Drop and
-- recreate so we can express the final column list in a readable order.
DROP VIEW IF EXISTS public_clinic_directory;

CREATE VIEW public_clinic_directory AS
SELECT id, name, subdomain, type, tier, status
FROM clinics
WHERE status = 'active';

-- Re-grant anon read after the drop. Grants do not survive a DROP VIEW, so
-- this must be re-asserted explicitly (the original grant from 00068 is
-- gone after the drop above).
GRANT SELECT ON public_clinic_directory TO anon;

COMMIT;
