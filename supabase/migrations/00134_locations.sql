-- Phase 8: Multi-location management
-- Supports clinic chains with centralized administration

CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  phone TEXT,
  email TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  timezone TEXT DEFAULT 'Africa/Casablanca',
  working_hours JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: only users in the same clinic can see locations
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "locations_select_clinic"
  ON locations FOR SELECT
  USING (
    clinic_id IN (
      SELECT clinic_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "locations_manage_admin"
  ON locations FOR ALL
  USING (
    clinic_id IN (
      SELECT clinic_id FROM users WHERE id = auth.uid() AND role IN ('clinic_admin', 'super_admin')
    )
  );

CREATE INDEX IF NOT EXISTS idx_locations_clinic
  ON locations (clinic_id);

-- Phase 8: White-label branding
CREATE TABLE IF NOT EXISTS branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#2563eb',
  secondary_color TEXT DEFAULT '#1e40af',
  accent_color TEXT DEFAULT '#3b82f6',
  custom_domain TEXT,
  email_from_name TEXT,
  email_footer_text TEXT,
  favicon_url TEXT,
  custom_css TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT branding_one_per_clinic UNIQUE (clinic_id)
);

ALTER TABLE branding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "branding_select_clinic"
  ON branding FOR SELECT
  USING (
    clinic_id IN (
      SELECT clinic_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "branding_manage_admin"
  ON branding FOR ALL
  USING (
    clinic_id IN (
      SELECT clinic_id FROM users WHERE id = auth.uid() AND role IN ('clinic_admin', 'super_admin')
    )
  );

CREATE INDEX IF NOT EXISTS idx_branding_clinic
  ON branding (clinic_id);

CREATE INDEX IF NOT EXISTS idx_branding_custom_domain
  ON branding (custom_domain)
  WHERE custom_domain IS NOT NULL;
