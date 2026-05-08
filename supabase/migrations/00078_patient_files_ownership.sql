-- Migration 00078: Patient Files Ownership Tracking (A7-01)
--
-- Creates the patient_files table to track file ownership and enable
-- proper authorization checks for file downloads. This fixes the IDOR
-- vulnerability where patients could enumerate and download other
-- patients' files within the same clinic.
--
-- The table links R2 keys to patient IDs, allowing the download endpoint
-- to verify that a patient role user can only access their own files.
-- Staff roles (doctor, receptionist, clinic_admin) can access all files
-- within their clinic.

-- Create patient_files table
CREATE TABLE IF NOT EXISTS patient_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,
  content_type TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by UUID REFERENCES users(id),
  
  -- Ensure unique R2 keys per clinic (prevent duplicate tracking)
  CONSTRAINT patient_files_clinic_key UNIQUE (clinic_id, r2_key)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_patient_files_patient 
  ON patient_files(patient_id, clinic_id);

CREATE INDEX IF NOT EXISTS idx_patient_files_r2_key 
  ON patient_files(clinic_id, r2_key);

-- Enable Row Level Security
ALTER TABLE patient_files ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Patients can see their own files, staff can see all files in their clinic
CREATE POLICY patient_files_select_own
  ON patient_files FOR SELECT
  USING (
    -- Patient sees only their own files
    auth.uid() = patient_id
    OR
    -- Staff sees all files in their clinic
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.clinic_id = patient_files.clinic_id
        AND users.role IN ('doctor', 'clinic_admin', 'receptionist', 'super_admin')
    )
  );

-- RLS Policy: Only staff can insert file records
CREATE POLICY patient_files_insert_staff
  ON patient_files FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.clinic_id = patient_files.clinic_id
        AND users.role IN ('doctor', 'clinic_admin', 'receptionist', 'super_admin', 'patient')
    )
  );

-- Grant permissions
GRANT SELECT, INSERT ON patient_files TO authenticated;

-- Add comment
COMMENT ON TABLE patient_files IS 'A7-01: Tracks file ownership for authorization checks. Links R2 keys to patient IDs to prevent IDOR vulnerabilities in file downloads.';
