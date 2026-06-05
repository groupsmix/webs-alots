-- ============================================================
-- Migration 00152: Add custom domain columns to clinics
--
-- The super-admin custom-domain page and verification API
-- (src/app/(super-admin)/super-admin/clinics/[id]/domain/page.tsx,
--  src/app/api/super-admin/clinics/[id]/domain/route.ts)
-- read and write `custom_domain` and `domain_status` directly on
-- the clinics row. Previously this data lived on the `branding`
-- table, but the super-admin flow needs to operate on clinics
-- without joining branding.
--
-- domain_status lifecycle:
--   NULL       — no custom domain configured
--   pending    — CNAME submitted, not yet verified
--   verified   — CNAME resolved to clinics.oltigo.com
--   failed     — CNAME verification failed (transient)
--
-- The UNIQUE constraint prevents the same domain being claimed by
-- two clinics simultaneously.
-- ============================================================

ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS custom_domain TEXT,
  ADD COLUMN IF NOT EXISTS domain_status TEXT
    CHECK (domain_status IS NULL OR domain_status IN ('pending', 'verified', 'failed'));

-- Enforce one domain per clinic across the entire system. Using a
-- partial unique index so NULL values are allowed for clinics
-- without a custom domain configured.
CREATE UNIQUE INDEX IF NOT EXISTS idx_clinics_custom_domain_unique
  ON clinics (custom_domain)
  WHERE custom_domain IS NOT NULL;

COMMENT ON COLUMN clinics.custom_domain IS
  'Optional custom domain (e.g. my-clinic.com) routing to this clinic. '
  'Must have a CNAME pointing to clinics.oltigo.com. NULL means use the '
  'default subdomain at <subdomain>.oltigo.com.';

COMMENT ON COLUMN clinics.domain_status IS
  'Verification state for custom_domain: pending → verified → failed. '
  'NULL when no custom domain is configured.';
