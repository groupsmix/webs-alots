-- Fix Schema Gaps for AI Revenue Agent
-- Migration: 00071_fix_schema_gaps.sql
-- Description: Create missing tables and fix schema mismatches

-- ========================================
-- Price History Table
-- ========================================
CREATE TABLE IF NOT EXISTS price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  old_price INTEGER NOT NULL,
  new_price INTEGER NOT NULL,
  change_percent DECIMAL(5,2) NOT NULL,
  reason TEXT,
  changed_by TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT price_history_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
  CONSTRAINT price_history_service_id_fkey FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_price_history_clinic_id ON price_history(clinic_id);
CREATE INDEX IF NOT EXISTS idx_price_history_service_id ON price_history(service_id);
CREATE INDEX IF NOT EXISTS idx_price_history_changed_at ON price_history(changed_at DESC);

-- RLS Policies
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY price_history_tenant_isolation ON price_history
  FOR ALL
  USING (clinic_id = current_setting('request.jwt.claims', true)::json->>'clinic_id'::text::uuid);

-- ========================================
-- Update Promotions Table (if exists)
-- ========================================
DO $$ 
BEGIN
  -- Add missing columns to promotions table if they don't exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'promotions') THEN
    
    -- Add code column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promotions' AND column_name = 'code') THEN
      ALTER TABLE promotions ADD COLUMN code TEXT;
      CREATE UNIQUE INDEX idx_promotions_code ON promotions(clinic_id, code) WHERE is_active = true;
    END IF;
    
    -- Add discount_type column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promotions' AND column_name = 'discount_type') THEN
      ALTER TABLE promotions ADD COLUMN discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed'));
    END IF;
    
    -- Add discount_value column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promotions' AND column_name = 'discount_value') THEN
      ALTER TABLE promotions ADD COLUMN discount_value INTEGER NOT NULL DEFAULT 0;
    END IF;
    
    -- Add service_ids column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promotions' AND column_name = 'service_ids') THEN
      ALTER TABLE promotions ADD COLUMN service_ids UUID[];
    END IF;
    
    -- Add min_purchase column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promotions' AND column_name = 'min_purchase') THEN
      ALTER TABLE promotions ADD COLUMN min_purchase INTEGER;
    END IF;
    
    -- Add max_uses column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promotions' AND column_name = 'max_uses') THEN
      ALTER TABLE promotions ADD COLUMN max_uses INTEGER;
    END IF;
    
    -- Add current_uses column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promotions' AND column_name = 'current_uses') THEN
      ALTER TABLE promotions ADD COLUMN current_uses INTEGER DEFAULT 0;
    END IF;
    
    -- Add deactivated_at column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promotions' AND column_name = 'deactivated_at') THEN
      ALTER TABLE promotions ADD COLUMN deactivated_at TIMESTAMPTZ;
    END IF;
    
    -- Add deactivation_reason column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promotions' AND column_name = 'deactivation_reason') THEN
      ALTER TABLE promotions ADD COLUMN deactivation_reason TEXT;
    END IF;
    
  END IF;
END $$;

-- ========================================
-- Update Services Table
-- ========================================
DO $$ 
BEGIN
  -- Add price_updated_at column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'price_updated_at') THEN
    ALTER TABLE services ADD COLUMN price_updated_at TIMESTAMPTZ;
  END IF;
  
  -- Add price_update_reason column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'price_update_reason') THEN
    ALTER TABLE services ADD COLUMN price_update_reason TEXT;
  END IF;
END $$;

-- ========================================
-- Update Appointments Table
-- ========================================
DO $$ 
BEGIN
  -- Add reschedule_reason column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'reschedule_reason') THEN
    ALTER TABLE appointments ADD COLUMN reschedule_reason TEXT;
  END IF;
END $$;

-- ========================================
-- Time Slots Table (if doesn't exist)
-- ========================================
CREATE TABLE IF NOT EXISTS time_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot_start TIMESTAMPTZ NOT NULL,
  slot_end TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT time_slots_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
  CONSTRAINT time_slots_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT time_slots_valid_time CHECK (slot_end > slot_start)
);

CREATE INDEX IF NOT EXISTS idx_time_slots_clinic_id ON time_slots(clinic_id);
CREATE INDEX IF NOT EXISTS idx_time_slots_doctor_id ON time_slots(doctor_id);
CREATE INDEX IF NOT EXISTS idx_time_slots_start ON time_slots(slot_start);
CREATE INDEX IF NOT EXISTS idx_time_slots_active ON time_slots(clinic_id, is_active) WHERE is_active = true;

-- RLS Policies
ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY time_slots_tenant_isolation ON time_slots
  FOR ALL
  USING (clinic_id = current_setting('request.jwt.claims', true)::json->>'clinic_id'::text::uuid);

-- ========================================
-- Update AI Message Log
-- ========================================
DO $$ 
BEGIN
  -- Add error_message column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_message_log' AND column_name = 'error_message') THEN
    ALTER TABLE ai_message_log ADD COLUMN error_message TEXT;
  END IF;
  
  -- Add delivered_at column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_message_log' AND column_name = 'delivered_at') THEN
    ALTER TABLE ai_message_log ADD COLUMN delivered_at TIMESTAMPTZ;
  END IF;
  
  -- Add read_at column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_message_log' AND column_name = 'read_at') THEN
    ALTER TABLE ai_message_log ADD COLUMN read_at TIMESTAMPTZ;
  END IF;
END $$;

-- ========================================
-- Business ID Aliases (for compatibility)
-- ========================================
-- Create views to handle clinic_id/business_id naming differences
-- This allows code to use business_id while database uses clinic_id

-- Note: Most tables already use clinic_id, which is correct
-- The AI code uses business_id as a parameter but queries with clinic_id
-- No changes needed here, just documenting the pattern

-- ========================================
-- Indexes for Performance
-- ========================================

-- AI Actions - add missing indexes
CREATE INDEX IF NOT EXISTS idx_ai_actions_business_status ON ai_actions(business_id, status) WHERE status IN ('pending', 'approved');
CREATE INDEX IF NOT EXISTS idx_ai_actions_executed_at ON ai_actions(executed_at) WHERE executed_at IS NOT NULL;

-- AI Insights - add missing indexes
CREATE INDEX IF NOT EXISTS idx_ai_insights_business_acted ON ai_insights(business_id, acted_upon, created_at DESC) WHERE NOT acted_upon;

-- Appointments - add missing indexes for AI queries
CREATE INDEX IF NOT EXISTS idx_appointments_patient_status ON appointments(patient_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date ON appointments(doctor_id, slot_start);

-- Services - add missing indexes
CREATE INDEX IF NOT EXISTS idx_services_clinic_active ON services(clinic_id) WHERE is_active = true;

-- ========================================
-- Comments for Documentation
-- ========================================
COMMENT ON TABLE price_history IS 'Tracks all price changes for services';
COMMENT ON TABLE time_slots IS 'Available time slots for doctor appointments';
COMMENT ON COLUMN services.price_updated_at IS 'When the price was last updated';
COMMENT ON COLUMN services.price_update_reason IS 'Reason for price update (e.g., AI adjustment)';
COMMENT ON COLUMN appointments.reschedule_reason IS 'Reason for rescheduling (e.g., AI optimization)';
