-- 00117: CDSS Audit & PHI Compliance Tables
-- Adapted from ECC healthcare-phi-compliance and healthcare-cdss-patterns.
-- Audit trail for drug interaction overrides and CDSS alerts.

-- ── CDSS Override Log (tamper-proof) ──

CREATE TABLE IF NOT EXISTS cdss_override_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       uuid NOT NULL,
  doctor_id       uuid NOT NULL,
  patient_id      uuid,
  encounter_id    uuid REFERENCES clinical_encounters(id),
  alert_severity  text NOT NULL CHECK (alert_severity IN ('critical', 'major', 'minor')),
  drug_pair       text[] NOT NULL,
  override_reason text NOT NULL,
  alert_details   jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE cdss_override_log IS 'ECC-CDSS: Tamper-proof log of clinician overrides on drug interaction alerts';
COMMENT ON COLUMN cdss_override_log.override_reason IS 'Clinician must document reason for overriding critical/major alerts';

-- ── NEWS2 Score History ──

CREATE TABLE IF NOT EXISTS news2_scores (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       uuid NOT NULL,
  patient_id      uuid NOT NULL,
  encounter_id    uuid REFERENCES clinical_encounters(id),
  recorded_by     uuid NOT NULL,
  total_score     integer NOT NULL CHECK (total_score >= 0 AND total_score <= 20),
  risk_level      text NOT NULL CHECK (risk_level IN ('low', 'low-medium', 'medium', 'high')),
  components      jsonb NOT NULL DEFAULT '{}',
  escalation      text NOT NULL,
  vitals_snapshot jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE news2_scores IS 'ECC-CDSS: NEWS2 score history for patient safety trending';

-- ── Indexes ──

CREATE INDEX IF NOT EXISTS idx_cdss_override_clinic
  ON cdss_override_log (clinic_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cdss_override_patient
  ON cdss_override_log (clinic_id, patient_id);

CREATE INDEX IF NOT EXISTS idx_news2_clinic_patient
  ON news2_scores (clinic_id, patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_news2_risk
  ON news2_scores (clinic_id, risk_level);

-- ── RLS ──

ALTER TABLE cdss_override_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE news2_scores ENABLE ROW LEVEL SECURITY;

-- Override log: clinic-scoped, insert-only (tamper-proof)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'cdss_override_clinic_isolation'
  ) THEN
    CREATE POLICY cdss_override_clinic_isolation ON cdss_override_log
      FOR ALL TO authenticated
      USING (clinic_id IN (
        SELECT u.clinic_id FROM users u WHERE u.id = auth.uid()
      ))
      WITH CHECK (clinic_id IN (
        SELECT u.clinic_id FROM users u WHERE u.id = auth.uid()
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'cdss_override_no_update'
  ) THEN
    CREATE POLICY cdss_override_no_update ON cdss_override_log
      FOR UPDATE USING (false);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'cdss_override_no_delete'
  ) THEN
    CREATE POLICY cdss_override_no_delete ON cdss_override_log
      FOR DELETE USING (false);
  END IF;
END $$;

-- NEWS2 scores: clinic-scoped
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'news2_clinic_isolation'
  ) THEN
    CREATE POLICY news2_clinic_isolation ON news2_scores
      FOR ALL TO authenticated
      USING (clinic_id IN (
        SELECT u.clinic_id FROM users u WHERE u.id = auth.uid()
      ))
      WITH CHECK (clinic_id IN (
        SELECT u.clinic_id FROM users u WHERE u.id = auth.uid()
      ));
  END IF;
END $$;

-- ── PHI Column Tags ──

COMMENT ON COLUMN clinical_encounters.chief_complaint IS 'PHI: clinical_data';
COMMENT ON COLUMN clinical_encounters.examination IS 'PHI: clinical_data';
COMMENT ON COLUMN clinical_encounters.diagnosis IS 'PHI: diagnosis';
COMMENT ON COLUMN clinical_encounters.medications IS 'PHI: medications';
COMMENT ON COLUMN news2_scores.vitals_snapshot IS 'PHI: patient_vitals';
