-- Migration: 00109_batch4a_doctor_ai.sql
-- Description: Doctor AI features — voice-to-notes (SOAP), smart prescription writer, drug interaction alerts
-- Batch: 4A

-- ── Voice Notes (SOAP dictation) ──

CREATE TABLE IF NOT EXISTS voice_notes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id     UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,

  -- Raw transcription from Web Speech API
  raw_transcript TEXT NOT NULL DEFAULT '',
  language       TEXT NOT NULL DEFAULT 'fr',

  -- AI-structured SOAP note
  soap_subjective  TEXT,
  soap_objective   TEXT,
  soap_assessment  TEXT,
  soap_plan        TEXT,

  -- Status tracking
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'structured', 'reviewed', 'finalized')),
  ai_model       TEXT,
  ai_structured_at TIMESTAMPTZ,
  reviewed_at    TIMESTAMPTZ,
  finalized_at   TIMESTAMPTZ,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for voice_notes
CREATE INDEX IF NOT EXISTS idx_voice_notes_clinic_id ON voice_notes(clinic_id);
CREATE INDEX IF NOT EXISTS idx_voice_notes_patient_id ON voice_notes(patient_id);
CREATE INDEX IF NOT EXISTS idx_voice_notes_doctor_id ON voice_notes(doctor_id);
CREATE INDEX IF NOT EXISTS idx_voice_notes_appointment_id ON voice_notes(appointment_id);

-- RLS for voice_notes
ALTER TABLE voice_notes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'voice_notes' AND policyname = 'voice_notes_clinic_isolation'
  ) THEN
    CREATE POLICY voice_notes_clinic_isolation ON voice_notes
      FOR ALL
      USING (clinic_id = get_user_clinic_id())
      WITH CHECK (clinic_id = get_user_clinic_id());
  END IF;
END $$;

-- ── Prescription Drafts (AI-generated ordonnances) ──

CREATE TABLE IF NOT EXISTS prescription_drafts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id      UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,

  -- Prescription content
  diagnosis      TEXT NOT NULL DEFAULT '',
  medications    JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes          TEXT,
  warnings       JSONB DEFAULT '[]'::jsonb,

  -- AI metadata
  ai_generated   BOOLEAN NOT NULL DEFAULT false,
  ai_model       TEXT,
  ai_generated_at TIMESTAMPTZ,

  -- Status
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'signed', 'printed', 'dispensed')),
  signed_at      TIMESTAMPTZ,
  printed_at     TIMESTAMPTZ,

  -- Ordonnance number for Moroccan format
  ordonnance_number TEXT,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for prescription_drafts
CREATE INDEX IF NOT EXISTS idx_prescription_drafts_clinic_id ON prescription_drafts(clinic_id);
CREATE INDEX IF NOT EXISTS idx_prescription_drafts_patient_id ON prescription_drafts(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescription_drafts_doctor_id ON prescription_drafts(doctor_id);

-- RLS for prescription_drafts
ALTER TABLE prescription_drafts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'prescription_drafts' AND policyname = 'prescription_drafts_clinic_isolation'
  ) THEN
    CREATE POLICY prescription_drafts_clinic_isolation ON prescription_drafts
      FOR ALL
      USING (clinic_id = get_user_clinic_id())
      WITH CHECK (clinic_id = get_user_clinic_id());
  END IF;
END $$;

-- ── Drug Interaction Alerts Log ──

CREATE TABLE IF NOT EXISTS drug_interaction_alerts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id      UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  doctor_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Alert details
  medications    JSONB NOT NULL DEFAULT '[]'::jsonb,
  alerts         JSONB NOT NULL DEFAULT '[]'::jsonb,
  overall_severity TEXT NOT NULL DEFAULT 'safe' CHECK (overall_severity IN ('dangerous', 'caution', 'safe')),

  -- Override tracking
  overridden     BOOLEAN NOT NULL DEFAULT false,
  override_reason TEXT,
  overridden_at  TIMESTAMPTZ,
  overridden_by  UUID REFERENCES users(id),

  -- AI metadata
  ai_enhanced    BOOLEAN NOT NULL DEFAULT false,
  ai_model       TEXT,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for drug_interaction_alerts
CREATE INDEX IF NOT EXISTS idx_drug_interaction_alerts_clinic_id ON drug_interaction_alerts(clinic_id);
CREATE INDEX IF NOT EXISTS idx_drug_interaction_alerts_patient_id ON drug_interaction_alerts(patient_id);
CREATE INDEX IF NOT EXISTS idx_drug_interaction_alerts_doctor_id ON drug_interaction_alerts(doctor_id);
CREATE INDEX IF NOT EXISTS idx_drug_interaction_alerts_severity ON drug_interaction_alerts(overall_severity);

-- RLS for drug_interaction_alerts
ALTER TABLE drug_interaction_alerts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'drug_interaction_alerts' AND policyname = 'drug_interaction_alerts_clinic_isolation'
  ) THEN
    CREATE POLICY drug_interaction_alerts_clinic_isolation ON drug_interaction_alerts
      FOR ALL
      USING (clinic_id = get_user_clinic_id())
      WITH CHECK (clinic_id = get_user_clinic_id());
  END IF;
END $$;

-- ── Updated_at triggers ──

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'voice_notes_updated_at'
  ) THEN
    CREATE TRIGGER voice_notes_updated_at
      BEFORE UPDATE ON voice_notes
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'prescription_drafts_updated_at'
  ) THEN
    CREATE TRIGGER prescription_drafts_updated_at
      BEFORE UPDATE ON prescription_drafts
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
