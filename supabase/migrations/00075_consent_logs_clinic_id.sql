-- ============================================================
-- Add clinic_id to consent_logs (F-02 follow-up from audit #485)
--
-- The consent_logs table records consent events for GDPR / Loi 09-08
-- compliance. It was missing a clinic_id column, so per-tenant purge
-- and RLS scoping had to rely on JOINing through users, which fails
-- for anonymous (pre-login) consent rows where user_id is NULL.
--
-- This migration adds an optional clinic_id column (nullable because
-- root-domain cookie consent can happen without tenant context) plus
-- an index for per-clinic queries. The INSERT RLS policies are not
-- modified — anonymous INSERTs (user_id NULL) remain allowed, and
-- authenticated INSERTs still require user_id match per 00057.
--
-- The FK uses ON DELETE SET NULL (not CASCADE) to preserve the GDPR /
-- Loi 09-08 audit trail when a clinic is deleted. This matches the
-- existing user_id FK on this table (00047_gdpr_compliance.sql:15)
-- and the GDPR purge cron (src/app/api/cron/gdpr-purge/route.ts),
-- which anonymizes consent rows rather than deleting them. Cascading
-- deletes from clinics would silently destroy compliance records that
-- the rest of the codebase is designed to retain.
-- ============================================================

ALTER TABLE consent_logs
  ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES clinics(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_consent_logs_clinic_id
  ON consent_logs(clinic_id)
  WHERE clinic_id IS NOT NULL;

COMMENT ON COLUMN consent_logs.clinic_id IS
  'Tenant scope for the consent event. NULL for pre-login root-domain cookie consent. Populated when consent is recorded under a tenant subdomain.';
