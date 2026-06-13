-- 00165: Medical document extraction for AI parsing feature
--
-- Adds extraction lifecycle columns to patient_files and creates the
-- medical_alerts table for critical AI-detected findings.
-- All operations are idempotent (IF NOT EXISTS / IF EXISTS guards).

-- ── Ensure patient_files base table exists ─────────────────────────────────
-- The patient_files table is the system of record for PHI uploads to R2.
-- It was historically created out-of-band on staging/production; this guard
-- ensures fresh environments (CI, local supabase) provision the schema
-- before we extend it below.
CREATE TABLE IF NOT EXISTS patient_files (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID        NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  file_name       TEXT        NOT NULL,
  file_type       TEXT        NOT NULL,
  file_size       BIGINT      NOT NULL,
  r2_key          TEXT        NOT NULL,
  encryption_iv   TEXT,
  uploaded_by     UUID        REFERENCES users(id) ON DELETE SET NULL,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_files_clinic_patient
  ON patient_files(clinic_id, patient_id);

-- ── Extraction columns on patient_files ────────────────────────────────────

ALTER TABLE patient_files
  ADD COLUMN IF NOT EXISTS extracted_data JSONB,
  ADD COLUMN IF NOT EXISTS extraction_status TEXT
    CHECK (extraction_status IN ('pending', 'processing', 'completed', 'failed'))
    DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS extracted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS extraction_error TEXT,
  ADD COLUMN IF NOT EXISTS extraction_retry_count INTEGER DEFAULT 0;

-- Partial index: efficient polling for the background worker
CREATE INDEX IF NOT EXISTS idx_patient_files_extraction_status
  ON patient_files(clinic_id, extraction_status)
  WHERE extraction_status IN ('pending', 'failed');

-- ── Medical alerts table ────────────────────────────────────────────────────
-- Stores critical findings surfaced by the AI parsing edge function so that
-- clinic staff can acknowledge them in the dashboard.

CREATE TABLE IF NOT EXISTS medical_alerts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id         UUID        NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id        UUID        REFERENCES users(id)         ON DELETE SET NULL,
  alert_type        TEXT        NOT NULL
    CHECK (alert_type IN ('critical_value', 'drug_interaction', 'abnormal_result')),
  message           TEXT        NOT NULL,
  source_file_id    UUID        REFERENCES patient_files(id) ON DELETE SET NULL,
  severity          TEXT        NOT NULL
    CHECK (severity IN ('critical', 'high', 'medium', 'low'))
    DEFAULT 'medium',
  acknowledged      BOOLEAN     NOT NULL DEFAULT FALSE,
  acknowledged_by   UUID        REFERENCES users(id)         ON DELETE SET NULL,
  acknowledged_at   TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Efficient lookup of unacknowledged alerts per clinic (dashboard polling)
CREATE INDEX IF NOT EXISTS idx_medical_alerts_clinic_unacked
  ON medical_alerts(clinic_id, created_at DESC)
  WHERE acknowledged = FALSE;

-- ── Row-Level Security ──────────────────────────────────────────────────────

ALTER TABLE medical_alerts ENABLE ROW LEVEL SECURITY;

-- Authenticated clinic staff may access alerts for their own clinic only.
-- The get_request_clinic_id() function is set by the middleware (see
-- 00041_fix_rls_use_request_headers.sql) and prevents cross-tenant leakage.
DO $$ BEGIN
  CREATE POLICY "medical_alerts_clinic_access"
    ON medical_alerts FOR ALL
    USING (
      clinic_id = get_request_clinic_id()
      AND auth.role() = 'authenticated'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
