-- Migration: Telemedicine sessions, staff invitations, insurance claims,
-- and ADT enhancements — adapted from MedCore/MediFlow/Health-Pay patterns.
--
-- NOTE: The `admissions` table already exists (migration 00015). This migration
-- adds new tables only and enhances RLS policies.

-- ── Telemedicine Sessions ───────────────────────────────────────────────
-- Adapted from MedCore's telemedicine module for video consultations.

CREATE TABLE IF NOT EXISTS telemedicine_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id uuid NOT NULL REFERENCES users(id),
  appointment_id uuid,
  scheduled_at timestamptz NOT NULL,
  started_at timestamptz,
  ended_at timestamptz,
  duration_minutes integer,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show')),
  room_url text,
  recording_url text,
  consultation_notes text,
  prescription_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telemedicine_clinic_id ON telemedicine_sessions(clinic_id);
CREATE INDEX IF NOT EXISTS idx_telemedicine_doctor_id ON telemedicine_sessions(clinic_id, doctor_id);
CREATE INDEX IF NOT EXISTS idx_telemedicine_patient_id ON telemedicine_sessions(clinic_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_telemedicine_status ON telemedicine_sessions(clinic_id, status);

ALTER TABLE telemedicine_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'telemedicine_sessions' AND policyname = 'telemedicine_sessions_clinic_isolation'
  ) THEN
    CREATE POLICY telemedicine_sessions_clinic_isolation ON telemedicine_sessions FOR ALL
      USING (clinic_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'clinic_id')::uuid)
      WITH CHECK (clinic_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'clinic_id')::uuid);
  END IF;
END $$;

-- ── Staff Invitations ───────────────────────────────────────────────────
-- Adapted from MediFlow's staff onboarding with email invitation flow.

CREATE TABLE IF NOT EXISTS staff_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('clinic_admin', 'receptionist', 'doctor')),
  invited_by uuid NOT NULL REFERENCES users(id),
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_invitations_clinic_id ON staff_invitations(clinic_id);
CREATE INDEX IF NOT EXISTS idx_staff_invitations_token ON staff_invitations(token);
CREATE INDEX IF NOT EXISTS idx_staff_invitations_email ON staff_invitations(clinic_id, email);

ALTER TABLE staff_invitations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'staff_invitations' AND policyname = 'staff_invitations_clinic_isolation'
  ) THEN
    CREATE POLICY staff_invitations_clinic_isolation ON staff_invitations FOR ALL
      USING (clinic_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'clinic_id')::uuid)
      WITH CHECK (clinic_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'clinic_id')::uuid);
  END IF;
END $$;

-- ── Insurance Claims (enhance existing table) ──────────────────────────
-- Table already created in 00110. Add columns needed by Health-Pay patterns.

ALTER TABLE insurance_claims ADD COLUMN IF NOT EXISTS reviewer_notes text;
ALTER TABLE insurance_claims ADD COLUMN IF NOT EXISTS line_items jsonb DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_insurance_claims_patient_id ON insurance_claims(clinic_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_status ON insurance_claims(clinic_id, status);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_type ON insurance_claims(clinic_id, insurance_type);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'insurance_claims' AND policyname = 'insurance_claims_clinic_isolation'
  ) THEN
    CREATE POLICY insurance_claims_clinic_isolation ON insurance_claims FOR ALL
      USING (clinic_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'clinic_id')::uuid)
      WITH CHECK (clinic_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'clinic_id')::uuid);
  END IF;
END $$;

-- ── Enhance existing admissions RLS ─────────────────────────────────────
-- Ensure admissions table has proper clinic isolation (defense-in-depth).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'admissions' AND policyname = 'admissions_clinic_isolation'
  ) THEN
    CREATE POLICY admissions_clinic_isolation ON admissions FOR ALL
      USING (clinic_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'clinic_id')::uuid)
      WITH CHECK (clinic_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'clinic_id')::uuid);
  END IF;
END $$;
