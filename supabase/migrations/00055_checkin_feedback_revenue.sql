-- Migration: Self-Check-In Kiosk, Google Reviews Automation, Revenue Analytics
-- Features: 13, 14, 15

-- ── Feature 13: Kiosk mode toggle ──────────────────────────────────────
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS kiosk_mode_enabled boolean NOT NULL DEFAULT false;

-- ── Feature 14: Google Reviews Automation ──────────────────────────────
-- Google Place ID for review link generation
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS google_place_id text;

-- Patient feedback / ratings table
CREATE TABLE IF NOT EXISTS patient_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
  patient_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  source text NOT NULL DEFAULT 'whatsapp' CHECK (source IN ('whatsapp', 'web', 'kiosk', 'sms')),
  feedback_sent_at timestamptz,
  responded_at timestamptz,
  google_review_sent boolean NOT NULL DEFAULT false,
  whatsapp_message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for patient_feedback
CREATE INDEX IF NOT EXISTS idx_patient_feedback_clinic_id ON patient_feedback(clinic_id);
CREATE INDEX IF NOT EXISTS idx_patient_feedback_patient_id ON patient_feedback(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_feedback_appointment_id ON patient_feedback(appointment_id);
CREATE INDEX IF NOT EXISTS idx_patient_feedback_created_at ON patient_feedback(created_at);

-- RLS policies for patient_feedback
ALTER TABLE patient_feedback ENABLE ROW LEVEL SECURITY;

-- Clinic staff can view feedback for their clinic
CREATE POLICY patient_feedback_select_staff ON patient_feedback
  FOR SELECT
  USING (
    clinic_id IN (
      SELECT u.clinic_id FROM users u WHERE u.auth_id = auth.uid()
    )
    OR
    clinic_id::text = coalesce(
      current_setting('request.header.x-clinic-id', true),
      (current_setting('request.headers', true)::json->>'x-clinic-id')
    )
  );

-- Patients can view their own feedback
CREATE POLICY patient_feedback_select_patient ON patient_feedback
  FOR SELECT
  USING (
    patient_id IN (
      SELECT u.id FROM users u WHERE u.auth_id = auth.uid()
    )
  );

-- Insert policy: authenticated users or service role
CREATE POLICY patient_feedback_insert ON patient_feedback
  FOR INSERT
  WITH CHECK (
    clinic_id IN (
      SELECT u.clinic_id FROM users u WHERE u.auth_id = auth.uid()
    )
    OR auth.role() = 'service_role'
    OR clinic_id::text = coalesce(
      current_setting('request.header.x-clinic-id', true),
      (current_setting('request.headers', true)::json->>'x-clinic-id')
    )
  );

-- ── Feature 15: Revenue Analytics Enhancement ──────────────────────────
-- Add payment_method column to payments table if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE payments ADD COLUMN payment_method text DEFAULT 'cash';
  END IF;
END $$;

-- Add doctor_id to payments for revenue-by-doctor analytics
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'doctor_id'
  ) THEN
    ALTER TABLE payments ADD COLUMN doctor_id uuid REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add service_id to payments for revenue-by-service analytics
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'service_id'
  ) THEN
    ALTER TABLE payments ADD COLUMN service_id uuid REFERENCES services(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Indexes for revenue analytics queries
CREATE INDEX IF NOT EXISTS idx_payments_doctor_id ON payments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_payments_service_id ON payments(service_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_method ON payments(payment_method);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);
