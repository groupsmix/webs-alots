-- Prescription refill request workflow.
-- Patients request refills, doctors approve/deny.

CREATE TABLE IF NOT EXISTS refill_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES users(id),
  doctor_id UUID REFERENCES users(id),
  prescription_id UUID,
  drug_name TEXT NOT NULL,
  dose TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied', 'cancelled')),
  patient_notes TEXT,
  doctor_notes TEXT,
  decided_at TIMESTAMPTZ,
  decided_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refill_requests_clinic_status
  ON refill_requests (clinic_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_refill_requests_patient
  ON refill_requests (patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_refill_requests_doctor_pending
  ON refill_requests (doctor_id, status)
  WHERE status = 'pending';

-- RLS
ALTER TABLE refill_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY refill_requests_patient_select ON refill_requests
  FOR SELECT
  USING (patient_id = auth.uid());

CREATE POLICY refill_requests_patient_insert ON refill_requests
  FOR INSERT
  WITH CHECK (
    patient_id = auth.uid()
    AND clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY refill_requests_doctor_select ON refill_requests
  FOR SELECT
  USING (
    clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid())
    AND (SELECT role FROM users WHERE id = auth.uid()) IN ('doctor', 'clinic_admin')
  );

CREATE POLICY refill_requests_doctor_update ON refill_requests
  FOR UPDATE
  USING (
    clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid())
    AND (SELECT role FROM users WHERE id = auth.uid()) IN ('doctor', 'clinic_admin')
  );
