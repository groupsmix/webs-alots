-- 00116: Clinical Encounters & Addenda
-- Adapted from ECC healthcare-emr-patterns: single-page encounter flow,
-- locked encounter pattern (no edits after sign, addendum only).
-- All tables scoped by clinic_id with RLS policies.

-- ── Clinical Encounters ──

CREATE TABLE IF NOT EXISTS clinical_encounters (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    uuid NOT NULL,
  doctor_id     uuid NOT NULL,
  clinic_id     uuid NOT NULL,
  appointment_id uuid,
  status        text NOT NULL DEFAULT 'in_progress'
                CHECK (status IN ('in_progress', 'signed', 'addendum')),

  chief_complaint           text NOT NULL DEFAULT '',
  history_of_present_illness text NOT NULL DEFAULT '',
  examination               text NOT NULL DEFAULT '',
  vitals                    jsonb NOT NULL DEFAULT '{}',
  diagnosis                 text NOT NULL DEFAULT '',
  icd_code                  text,
  medications               jsonb NOT NULL DEFAULT '[]',
  investigations            text NOT NULL DEFAULT '',
  plan                      text NOT NULL DEFAULT '',

  signed_at     timestamptz,
  signed_by     uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE clinical_encounters IS 'ECC-EMR: Single-page clinical encounter with locked-after-sign pattern';
COMMENT ON COLUMN clinical_encounters.status IS 'in_progress | signed | addendum — once signed, only addenda allowed';
COMMENT ON COLUMN clinical_encounters.vitals IS 'PHI: patient_vitals — JSON with HR, BP, temp, RR, SpO2, weight, consciousness';

-- ── Encounter Addenda (linked, immutable) ──

CREATE TABLE IF NOT EXISTS encounter_addenda (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id  uuid NOT NULL REFERENCES clinical_encounters(id),
  author_id     uuid NOT NULL,
  clinic_id     uuid NOT NULL,
  content       text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE encounter_addenda IS 'ECC-EMR: Addendum records linked to locked encounters';

-- ── Indexes ──

CREATE INDEX IF NOT EXISTS idx_encounters_clinic_patient
  ON clinical_encounters (clinic_id, patient_id);

CREATE INDEX IF NOT EXISTS idx_encounters_clinic_doctor
  ON clinical_encounters (clinic_id, doctor_id);

CREATE INDEX IF NOT EXISTS idx_encounters_status
  ON clinical_encounters (clinic_id, status);

CREATE INDEX IF NOT EXISTS idx_addenda_encounter
  ON encounter_addenda (encounter_id);

CREATE INDEX IF NOT EXISTS idx_addenda_clinic
  ON encounter_addenda (clinic_id);

-- ── RLS ──

ALTER TABLE clinical_encounters ENABLE ROW LEVEL SECURITY;
ALTER TABLE encounter_addenda ENABLE ROW LEVEL SECURITY;

-- Encounters: staff can read/write their own clinic's encounters
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'encounters_clinic_isolation'
  ) THEN
    CREATE POLICY encounters_clinic_isolation ON clinical_encounters
      FOR ALL TO authenticated
      USING (clinic_id IN (
        SELECT u.clinic_id FROM users u WHERE u.id = auth.uid()
      ))
      WITH CHECK (clinic_id IN (
        SELECT u.clinic_id FROM users u WHERE u.id = auth.uid()
      ));
  END IF;
END $$;

-- Addenda: staff can read/write their own clinic's addenda
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'addenda_clinic_isolation'
  ) THEN
    CREATE POLICY addenda_clinic_isolation ON encounter_addenda
      FOR ALL TO authenticated
      USING (clinic_id IN (
        SELECT u.clinic_id FROM users u WHERE u.id = auth.uid()
      ))
      WITH CHECK (clinic_id IN (
        SELECT u.clinic_id FROM users u WHERE u.id = auth.uid()
      ));
  END IF;
END $$;

-- Audit: encounters and addenda are insert-only for audit purposes on the addenda table
-- (no updates/deletes on addenda — they are immutable records)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'addenda_no_update'
  ) THEN
    CREATE POLICY addenda_no_update ON encounter_addenda
      FOR UPDATE USING (false);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'addenda_no_delete'
  ) THEN
    CREATE POLICY addenda_no_delete ON encounter_addenda
      FOR DELETE USING (false);
  END IF;
END $$;

-- ── Prevent edits on signed encounters (DB-level guard) ──

CREATE OR REPLACE FUNCTION prevent_signed_encounter_edit()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('signed', 'addendum') AND NEW.status != 'addendum' THEN
    RAISE EXCEPTION 'Cannot edit a signed encounter. Use addenda instead.';
  END IF;
  IF OLD.status IN ('signed', 'addendum') THEN
    -- Only allow status change to 'addendum' and updated_at change
    IF NEW.chief_complaint != OLD.chief_complaint
      OR NEW.examination != OLD.examination
      OR NEW.diagnosis != OLD.diagnosis
      OR NEW.medications != OLD.medications
      OR NEW.plan != OLD.plan THEN
      RAISE EXCEPTION 'Cannot modify clinical content of a signed encounter.';
    END IF;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_signed_encounter_edit ON clinical_encounters;
CREATE TRIGGER trg_prevent_signed_encounter_edit
  BEFORE UPDATE ON clinical_encounters
  FOR EACH ROW EXECUTE FUNCTION prevent_signed_encounter_edit();
