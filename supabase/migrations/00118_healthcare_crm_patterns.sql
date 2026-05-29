-- Migration 00116: Healthcare CRM Patterns
--
-- Adapted from open-source healthcare CRM best practices:
--   1. patient_vitals table for SSE live streaming
--   2. immutable_audit_log with append-only triggers
--   3. prescription workflow status fields
--   4. FHIR integration log
--
-- All tables enforce clinic_id scoping with RLS policies.

-- ============================================================
-- 1. Patient Vitals Table (SSE Live Streaming)
-- ============================================================

CREATE TABLE IF NOT EXISTS patient_vitals (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id     UUID NOT NULL REFERENCES clinics(id),
  patient_id    UUID NOT NULL REFERENCES users(id),
  systolic      SMALLINT,
  diastolic     SMALLINT,
  heart_rate    SMALLINT,
  temperature   NUMERIC(4,1),
  weight        NUMERIC(5,1),
  oxygen_saturation SMALLINT,
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by   UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_vitals_clinic_patient
  ON patient_vitals (clinic_id, patient_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_patient_vitals_recorded_at
  ON patient_vitals (recorded_at DESC);

-- RLS for patient_vitals
ALTER TABLE patient_vitals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'patient_vitals' AND policyname = 'patient_vitals_clinic_isolation'
  ) THEN
    CREATE POLICY patient_vitals_clinic_isolation ON patient_vitals
      FOR ALL
      USING (clinic_id = (current_setting('app.clinic_id', true))::uuid)
      WITH CHECK (clinic_id = (current_setting('app.clinic_id', true))::uuid);
  END IF;
END$$;

-- Enable Realtime for patient_vitals (required for SSE streaming)
ALTER PUBLICATION supabase_realtime ADD TABLE patient_vitals;

-- ============================================================
-- 2. Immutable Audit Log (Append-Only with Hash Chain)
-- ============================================================

CREATE TABLE IF NOT EXISTS immutable_audit_log (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id     UUID NOT NULL REFERENCES clinics(id),
  action        TEXT NOT NULL,
  entity_type   TEXT NOT NULL,
  entity_id     TEXT NOT NULL,
  actor_id      UUID,
  payload       JSONB DEFAULT '{}'::jsonb,
  previous_hash TEXT,
  entry_hash    TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_immutable_audit_clinic_time
  ON immutable_audit_log (clinic_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_immutable_audit_entity
  ON immutable_audit_log (clinic_id, entity_type, entity_id);

-- RLS for immutable_audit_log
ALTER TABLE immutable_audit_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'immutable_audit_log' AND policyname = 'immutable_audit_clinic_isolation'
  ) THEN
    CREATE POLICY immutable_audit_clinic_isolation ON immutable_audit_log
      FOR ALL
      USING (clinic_id = (current_setting('app.clinic_id', true))::uuid)
      WITH CHECK (clinic_id = (current_setting('app.clinic_id', true))::uuid);
  END IF;
END$$;

-- Append-only trigger: prevent UPDATE on immutable_audit_log
CREATE OR REPLACE FUNCTION prevent_audit_log_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Le journal d''audit immuable ne peut pas être modifié (append-only)';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_audit_update ON immutable_audit_log;
CREATE TRIGGER trg_prevent_audit_update
  BEFORE UPDATE ON immutable_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_update();

-- Append-only trigger: prevent DELETE on immutable_audit_log
CREATE OR REPLACE FUNCTION prevent_audit_log_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Le journal d''audit immuable ne peut pas être supprimé (append-only)';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_audit_delete ON immutable_audit_log;
CREATE TRIGGER trg_prevent_audit_delete
  BEFORE DELETE ON immutable_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_delete();

-- ============================================================
-- 3. Prescription Workflow Enhancement
-- ============================================================

-- Add workflow columns to prescriptions table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prescriptions' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE prescriptions ADD COLUMN approved_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prescriptions' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE prescriptions ADD COLUMN approved_by UUID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prescriptions' AND column_name = 'dispensed_at'
  ) THEN
    ALTER TABLE prescriptions ADD COLUMN dispensed_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prescriptions' AND column_name = 'dispensed_by'
  ) THEN
    ALTER TABLE prescriptions ADD COLUMN dispensed_by UUID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prescriptions' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE prescriptions ADD COLUMN rejection_reason TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prescriptions' AND column_name = 'pharmacist_notes'
  ) THEN
    ALTER TABLE prescriptions ADD COLUMN pharmacist_notes TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prescriptions' AND column_name = 'status'
  ) THEN
    ALTER TABLE prescriptions ADD COLUMN status TEXT DEFAULT 'draft';
  END IF;
END$$;

-- Index for prescription status workflow queries
CREATE INDEX IF NOT EXISTS idx_prescriptions_clinic_status
  ON prescriptions (clinic_id, status);

-- ============================================================
-- 4. FHIR Integration Log
-- ============================================================

CREATE TABLE IF NOT EXISTS fhir_integration_log (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id       UUID NOT NULL REFERENCES clinics(id),
  direction       TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  resource_type   TEXT NOT NULL,
  resource_id     TEXT,
  ehr_endpoint    TEXT,
  status_code     SMALLINT,
  error_message   TEXT,
  request_payload JSONB,
  response_summary JSONB,
  actor_id        UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fhir_log_clinic_time
  ON fhir_integration_log (clinic_id, created_at DESC);

-- RLS for fhir_integration_log
ALTER TABLE fhir_integration_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'fhir_integration_log' AND policyname = 'fhir_log_clinic_isolation'
  ) THEN
    CREATE POLICY fhir_log_clinic_isolation ON fhir_integration_log
      FOR ALL
      USING (clinic_id = (current_setting('app.clinic_id', true))::uuid)
      WITH CHECK (clinic_id = (current_setting('app.clinic_id', true))::uuid);
  END IF;
END$$;

-- ============================================================
-- 5. Drug Interactions Reference Table
-- ============================================================

CREATE TABLE IF NOT EXISTS drug_interactions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id   UUID NOT NULL REFERENCES clinics(id),
  drug_a      TEXT NOT NULL,
  drug_b      TEXT NOT NULL,
  severity    TEXT NOT NULL CHECK (severity IN ('low', 'moderate', 'high', 'critical')),
  description TEXT NOT NULL,
  source      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drug_interactions_clinic
  ON drug_interactions (clinic_id);

CREATE INDEX IF NOT EXISTS idx_drug_interactions_drugs
  ON drug_interactions (clinic_id, lower(drug_a), lower(drug_b));

-- RLS for drug_interactions
ALTER TABLE drug_interactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'drug_interactions' AND policyname = 'drug_interactions_clinic_isolation'
  ) THEN
    CREATE POLICY drug_interactions_clinic_isolation ON drug_interactions
      FOR ALL
      USING (clinic_id = (current_setting('app.clinic_id', true))::uuid)
      WITH CHECK (clinic_id = (current_setting('app.clinic_id', true))::uuid);
  END IF;
END$$;
