-- Create Promotions Table
-- Migration: 00072_create_promotions_table.sql
-- Description: Create promotions table if it doesn't exist

-- ========================================
-- Promotions Table
-- ========================================
CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  code TEXT,
  discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value INTEGER NOT NULL DEFAULT 0,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  service_ids UUID[],
  min_purchase INTEGER,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deactivated_at TIMESTAMPTZ,
  deactivation_reason TEXT,
  
  CONSTRAINT promotions_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_promotions_clinic_id ON promotions(clinic_id);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(clinic_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_promotions_valid_dates ON promotions(valid_from, valid_until);
CREATE UNIQUE INDEX IF NOT EXISTS idx_promotions_code ON promotions(clinic_id, code) WHERE is_active = true;

-- RLS Policies
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY promotions_tenant_isolation ON promotions
  FOR ALL
  USING (clinic_id = current_setting('request.jwt.claims', true)::json->>'clinic_id'::text::uuid);

-- Comments
COMMENT ON TABLE promotions IS 'Promotional offers and discount codes';
COMMENT ON COLUMN promotions.code IS 'Unique promo code (e.g., SUMMER2024)';
COMMENT ON COLUMN promotions.discount_type IS 'Type of discount: percentage or fixed amount';
COMMENT ON COLUMN promotions.discount_value IS 'Discount value (percentage or MAD)';
COMMENT ON COLUMN promotions.service_ids IS 'Array of service IDs this promotion applies to (null = all services)';
COMMENT ON COLUMN promotions.min_purchase IS 'Minimum purchase amount required (MAD)';
COMMENT ON COLUMN promotions.max_uses IS 'Maximum number of times this promotion can be used (null = unlimited)';
COMMENT ON COLUMN promotions.current_uses IS 'Current number of times this promotion has been used';
