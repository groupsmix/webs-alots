-- Migration: clinic_feature_overrides
-- Per-clinic feature toggle overrides for the super-admin dashboard.
-- Replaces previous feature_id-based schema with feature_key TEXT for flexibility.

DROP TABLE IF EXISTS clinic_feature_overrides;

CREATE TABLE IF NOT EXISTS clinic_feature_overrides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(clinic_id, feature_key)
);

-- RLS
ALTER TABLE clinic_feature_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins can manage feature overrides" ON clinic_feature_overrides
  FOR ALL USING (true);
