-- ============================================================
-- Migration 00010: Medical Features (Phase 2)
-- Adds medical_certificates table, extends consultation_notes,
-- extends sterilization_log, updates odontogram constraints,
-- and adds certificates feature flag.
-- ============================================================

-- ============================================================
-- 1. MEDICAL CERTIFICATES (General Doctor - new feature)
-- ============================================================

CREATE TABLE medical_certificates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  appointment_id  UUID REFERENCES appointments(id),
  type            TEXT NOT NULL CHECK (type IN (
    'sick_leave', 'fitness', 'medical_report', 'disability', 'custom'
  )),
  content         JSONB NOT NULL DEFAULT '{}',
  pdf_url         TEXT,
  issued_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_medical_certificates_clinic ON medical_certificates(clinic_id);
CREATE INDEX idx_medical_certificates_patient ON medical_certificates(patient_id);
CREATE INDEX idx_medical_certificates_doctor ON medical_certificates(doctor_id);

-- ============================================================
-- 2. EXTEND CONSULTATION NOTES
-- Add structured content JSONB column for rich note data
-- ============================================================

ALTER TABLE consultation_notes
  ADD COLUMN IF NOT EXISTS content JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ============================================================
-- 3. EXTEND STERILIZATION LOG
-- Add batch_number and cycle_number for compliance tracking
-- ============================================================

ALTER TABLE sterilization_log
  ADD COLUMN IF NOT EXISTS batch_number TEXT,
  ADD COLUMN IF NOT EXISTS cycle_number INT;

-- ============================================================
-- 4. EXTEND ODONTOGRAM
-- Update tooth_number constraint to support child (deciduous)
-- teeth using FDI notation (range 11-85)
-- ============================================================

-- Drop existing constraint and add broader one for FDI notation
ALTER TABLE odontogram
  DROP CONSTRAINT IF EXISTS odontogram_tooth_number_check;

ALTER TABLE odontogram
  ADD CONSTRAINT odontogram_tooth_number_fdi_check
    CHECK (tooth_number BETWEEN 11 AND 85);

-- Add dentition type column
ALTER TABLE odontogram
  ADD COLUMN IF NOT EXISTS dentition TEXT DEFAULT 'adult'
    CHECK (dentition IN ('adult', 'child'));

-- ============================================================
-- 5. UPDATE FEATURES CONFIG for certificates
-- Add "certificates" feature to general_medicine clinic type
-- ============================================================

UPDATE clinic_types
SET features_config = features_config || '{"certificates": true}'::jsonb
WHERE type_key = 'general_medicine';

-- Also add sterilization_log feature key for dental types
UPDATE clinic_types
SET features_config = features_config || '{"sterilization_log": true}'::jsonb
WHERE type_key = 'dental';
