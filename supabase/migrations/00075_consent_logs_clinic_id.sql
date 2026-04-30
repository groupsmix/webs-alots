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
-- ============================================================

ALTER TABLE consent_logs
  ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES clinics(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_consent_logs_clinic_id
  ON consent_logs(clinic_id)
  WHERE clinic_id IS NOT NULL;

COMMENT ON COLUMN consent_logs.clinic_id IS
  'Tenant scope for the consent event. NULL for pre-login root-domain cookie consent. Populated when consent is recorded under a tenant subdomain.';
