-- KYC / Business Verification Tracking
-- Allows self-service clinics to submit their documentation for review.
--
-- NOTE on policy helpers: this app stores roles directly on the `users` table
-- (see 00001_initial_schema.sql). The schema has NO `user_roles` table — that
-- pattern is from a different app and would fail with
-- "relation user_roles does not exist". All RLS policies on this database use
-- the helper functions defined in 00002_auth_rls_roles.sql:
--   is_super_admin()         — true when the caller is role='super_admin'
--   is_clinic_admin(uuid)    — true when caller is clinic_admin for that clinic
--   get_user_clinic_id()     — returns the caller's clinic for header/JWT auth

CREATE TABLE IF NOT EXISTS clinic_kyc (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  ice_number TEXT,
  rc_number TEXT,
  business_docs_url TEXT[], -- Array of Cloudflare R2 object keys
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One KYC record per clinic
CREATE UNIQUE INDEX IF NOT EXISTS idx_clinic_kyc_clinic_id ON clinic_kyc(clinic_id);

ALTER TABLE clinic_kyc ENABLE ROW LEVEL SECURITY;

-- Super admins can do anything
CREATE POLICY superadmin_all_kyc ON clinic_kyc
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Clinic admins can read their own clinic's KYC
CREATE POLICY admin_read_own_kyc ON clinic_kyc
  FOR SELECT
  USING (is_clinic_admin(clinic_kyc.clinic_id));

-- Clinic admins can insert/update their own clinic's KYC (submission flow)
CREATE POLICY admin_write_own_kyc ON clinic_kyc
  FOR INSERT
  WITH CHECK (is_clinic_admin(clinic_kyc.clinic_id));

CREATE POLICY admin_update_own_kyc ON clinic_kyc
  FOR UPDATE
  USING (is_clinic_admin(clinic_kyc.clinic_id))
  WITH CHECK (is_clinic_admin(clinic_kyc.clinic_id));

-- Service role bypass (background workers, webhook handlers)
CREATE POLICY service_role_all_kyc ON clinic_kyc
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Trigger for updated_at — uses the canonical update_updated_at_column()
-- helper defined in 00109_batch4a_doctor_ai.sql (which runs before this).
DROP TRIGGER IF EXISTS clinic_kyc_updated_at ON clinic_kyc;
CREATE TRIGGER clinic_kyc_updated_at
  BEFORE UPDATE ON clinic_kyc
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
