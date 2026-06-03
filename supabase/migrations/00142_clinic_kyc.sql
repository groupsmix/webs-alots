-- KYC / Business Verification Tracking
-- Allows self-service clinics to submit their documentation for review.

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
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      JOIN user_roles ON user_roles.user_id = auth.users.id
      WHERE auth.users.id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

-- Clinic admins can read their own KYC
CREATE POLICY admin_read_own_kyc ON clinic_kyc
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      JOIN user_roles ON user_roles.user_id = auth.users.id
      WHERE auth.users.id = auth.uid()
      AND user_roles.role = 'clinic_admin'
      AND user_roles.clinic_id = clinic_kyc.clinic_id
    )
  );

-- Service role can do anything
CREATE POLICY service_role_all_kyc ON clinic_kyc
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Trigger for updated_at
CREATE TRIGGER clinic_kyc_updated_at
  BEFORE UPDATE ON clinic_kyc
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();
