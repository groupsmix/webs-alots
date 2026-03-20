-- ============================================================
-- Migration 00011: Specialty Modules
-- Adds tables for Pediatrician, Gynecologist, and Ophthalmologist
-- specialty features.
-- ============================================================

-- ============================================================
-- 1. PEDIATRICIAN — Growth Measurements
-- ============================================================

CREATE TABLE growth_measurements (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id     UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id    UUID NOT NULL REFERENCES users(id),
  doctor_id     UUID NOT NULL REFERENCES users(id),
  measured_at   DATE NOT NULL DEFAULT CURRENT_DATE,
  age_months    INT NOT NULL CHECK (age_months >= 0),
  weight_kg     DECIMAL(5,2),
  height_cm     DECIMAL(5,1),
  head_circ_cm  DECIMAL(5,1),
  bmi           DECIMAL(4,1),
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_growth_measurements_clinic ON growth_measurements(clinic_id);
CREATE INDEX idx_growth_measurements_patient ON growth_measurements(patient_id);
CREATE INDEX idx_growth_measurements_doctor ON growth_measurements(doctor_id);

-- ============================================================
-- 2. PEDIATRICIAN — Vaccinations
-- ============================================================

CREATE TABLE vaccinations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID REFERENCES users(id),
  vaccine_name    TEXT NOT NULL,
  dose_number     INT NOT NULL DEFAULT 1,
  scheduled_date  DATE NOT NULL,
  administered_date DATE,
  status          TEXT NOT NULL DEFAULT 'scheduled'
                  CHECK (status IN ('scheduled', 'administered', 'overdue', 'skipped')),
  lot_number      TEXT,
  site            TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_vaccinations_clinic ON vaccinations(clinic_id);
CREATE INDEX idx_vaccinations_patient ON vaccinations(patient_id);
CREATE INDEX idx_vaccinations_status ON vaccinations(status);

-- ============================================================
-- 3. PEDIATRICIAN — Developmental Milestones
-- ============================================================

CREATE TABLE developmental_milestones (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id     UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id    UUID NOT NULL REFERENCES users(id),
  doctor_id     UUID REFERENCES users(id),
  category      TEXT NOT NULL CHECK (category IN ('motor', 'language', 'social', 'cognitive')),
  milestone     TEXT NOT NULL,
  expected_age_months INT,
  achieved_date DATE,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'achieved', 'delayed', 'concern')),
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_milestones_clinic ON developmental_milestones(clinic_id);
CREATE INDEX idx_milestones_patient ON developmental_milestones(patient_id);

-- ============================================================
-- 4. GYNECOLOGIST — Pregnancies
-- ============================================================

CREATE TABLE pregnancies (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id         UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id        UUID NOT NULL REFERENCES users(id),
  doctor_id         UUID NOT NULL REFERENCES users(id),
  lmp_date          DATE NOT NULL,
  edd_date          DATE NOT NULL,
  status            TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'delivered', 'miscarriage', 'ectopic', 'terminated')),
  gravida           INT,
  para              INT,
  blood_type        TEXT,
  rh_factor         TEXT CHECK (rh_factor IN ('positive', 'negative')),
  risk_factors      JSONB DEFAULT '[]',
  birth_plan_notes  TEXT,
  delivery_date     DATE,
  delivery_type     TEXT CHECK (delivery_type IN ('vaginal', 'cesarean', 'assisted')),
  baby_weight_kg    DECIMAL(4,2),
  baby_gender       TEXT CHECK (baby_gender IN ('male', 'female')),
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pregnancies_clinic ON pregnancies(clinic_id);
CREATE INDEX idx_pregnancies_patient ON pregnancies(patient_id);
CREATE INDEX idx_pregnancies_doctor ON pregnancies(doctor_id);
CREATE INDEX idx_pregnancies_status ON pregnancies(status);

-- ============================================================
-- 5. GYNECOLOGIST — Ultrasound Records
-- ============================================================

CREATE TABLE ultrasound_records (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  pregnancy_id    UUID NOT NULL REFERENCES pregnancies(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  scan_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  trimester       INT NOT NULL CHECK (trimester BETWEEN 1 AND 3),
  gestational_weeks INT,
  gestational_days  INT CHECK (gestational_days BETWEEN 0 AND 6),
  measurements    JSONB DEFAULT '{}',
  findings        TEXT,
  image_urls      JSONB DEFAULT '[]',
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ultrasound_clinic ON ultrasound_records(clinic_id);
CREATE INDEX idx_ultrasound_pregnancy ON ultrasound_records(pregnancy_id);
CREATE INDEX idx_ultrasound_patient ON ultrasound_records(patient_id);

-- ============================================================
-- 6. OPHTHALMOLOGIST — Vision Tests
-- ============================================================

CREATE TABLE vision_tests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  test_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  od_acuity       TEXT,
  os_acuity       TEXT,
  od_sphere       DECIMAL(4,2),
  od_cylinder     DECIMAL(4,2),
  od_axis         INT CHECK (od_axis BETWEEN 0 AND 180),
  os_sphere       DECIMAL(4,2),
  os_cylinder     DECIMAL(4,2),
  os_axis         INT CHECK (os_axis BETWEEN 0 AND 180),
  od_add          DECIMAL(3,2),
  os_add          DECIMAL(3,2),
  pd_mm           DECIMAL(4,1),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_vision_tests_clinic ON vision_tests(clinic_id);
CREATE INDEX idx_vision_tests_patient ON vision_tests(patient_id);
CREATE INDEX idx_vision_tests_doctor ON vision_tests(doctor_id);

-- ============================================================
-- 7. OPHTHALMOLOGIST — Intraocular Pressure (IOP)
-- ============================================================

CREATE TABLE iop_measurements (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  measured_at     DATE NOT NULL DEFAULT CURRENT_DATE,
  od_pressure     DECIMAL(4,1) NOT NULL,
  os_pressure     DECIMAL(4,1) NOT NULL,
  method          TEXT DEFAULT 'goldmann'
                  CHECK (method IN ('goldmann', 'non_contact', 'tonopen', 'icare', 'other')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_iop_clinic ON iop_measurements(clinic_id);
CREATE INDEX idx_iop_patient ON iop_measurements(patient_id);
CREATE INDEX idx_iop_doctor ON iop_measurements(doctor_id);

-- ============================================================
-- 8. UPDATE FEATURES CONFIG
-- Add specialty feature flags to ClinicFeatureKey
-- ============================================================

-- Add pediatrics features to pediatrics clinic type (if exists)
UPDATE clinic_types
SET features_config = features_config || '{"growth_charts": true, "vaccination": true}'::jsonb
WHERE type_key = 'pediatrics';

-- Add gynecology features to gynecology clinic type (if exists)
UPDATE clinic_types
SET features_config = features_config || '{"pregnancy_tracking": true, "ultrasound_records": true}'::jsonb
WHERE type_key = 'gynecology';

-- Add ophthalmology features to ophthalmology clinic type (if exists)
UPDATE clinic_types
SET features_config = features_config || '{"vision_tests": true, "iop_tracking": true}'::jsonb
WHERE type_key = 'ophthalmology';
