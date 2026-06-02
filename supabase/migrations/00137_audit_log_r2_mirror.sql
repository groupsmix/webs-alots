-- Migration: R2 Mirror Tracking for Audit Logs
-- Description: Tracks the status of nightly R2 exports of audit logs for WORM compliance.

CREATE TABLE IF NOT EXISTS audit_log_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  export_date DATE NOT NULL,
  r2_object_key TEXT NOT NULL,
  record_count INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(clinic_id, export_date)
);

-- RLS Policies
ALTER TABLE audit_log_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view all exports" 
  ON audit_log_exports FOR SELECT 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Service role has full access to exports" 
  ON audit_log_exports FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_exports_clinic_date ON audit_log_exports(clinic_id, export_date);

-- Comment to document R2 configuration
COMMENT ON TABLE audit_log_exports IS 'Tracks daily audit log exports to Cloudflare R2. R2 bucket must be configured with Object Lock in compliance mode for 7 years to meet Moroccan Law 09-08 requirements.';
