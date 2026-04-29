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

-- Recreate the view with `tier` included. CREATE OR REPLACE VIEW preserves
-- existing grants, so the earlier `GRANT SELECT ... TO anon` from 00068
-- continues to apply.
CREATE OR REPLACE VIEW public_clinic_directory AS
SELECT id, name, subdomain, type, tier, status
FROM clinics
WHERE status = 'active';

-- Re-assert the anon grant defensively in case the view was created in a
-- schema migration path that skipped the original grant.
GRANT SELECT ON public_clinic_directory TO anon;

COMMIT;
