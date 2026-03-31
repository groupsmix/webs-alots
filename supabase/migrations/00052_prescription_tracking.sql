-- ============================================================
-- Migration 00052: Prescription Tracking
-- Extends the prescriptions table with:
--   - Unique prescription number (RX-YYYY-XXXXXX)
--   - Status tracking (created → dispensed → cancelled/expired)
--   - QR code data storage
--   - Dispensing information
--   - Doctor INPE snapshot at time of prescription
-- ============================================================

-- Add new columns to the existing prescriptions table
ALTER TABLE prescriptions
  ADD COLUMN IF NOT EXISTS prescription_number TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'dispensed', 'cancelled', 'expired')),
  ADD COLUMN IF NOT EXISTS doctor_inpe TEXT,
  ADD COLUMN IF NOT EXISTS qr_data JSONB,
  ADD COLUMN IF NOT EXISTS dispensed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispensed_by TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Index for prescription number lookups (pharmacist scanning QR)
CREATE INDEX IF NOT EXISTS idx_prescriptions_number
  ON prescriptions (prescription_number)
  WHERE prescription_number IS NOT NULL;

-- Index for status-based queries
CREATE INDEX IF NOT EXISTS idx_prescriptions_status
  ON prescriptions (status);

-- Index for clinic + status queries (doctor dashboard)
CREATE INDEX IF NOT EXISTS idx_prescriptions_clinic_status
  ON prescriptions (clinic_id, status);

-- Sequence for generating prescription numbers per year
-- The application layer uses this to get the next number.
CREATE SEQUENCE IF NOT EXISTS prescription_number_seq
  START WITH 1
  INCREMENT BY 1
  NO MAXVALUE
  CACHE 1;
