-- ============================================================
-- Migration 00011: Medical Specialist Features (Tasks 9-15)
-- Adds tables for Dermatologist, Cardiologist, ENT, Orthopedist,
-- Psychiatrist, Neurologist, and remaining specialists.
-- ============================================================

-- ============================================================
-- 1. DERMATOLOGIST (Task 9)
-- ============================================================

CREATE TABLE skin_photos (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  body_region     TEXT NOT NULL,
  description     TEXT,
  image_url       TEXT,
  photo_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  tags            TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_skin_photos_clinic ON skin_photos(clinic_id);
CREATE INDEX idx_skin_photos_patient ON skin_photos(patient_id);

CREATE TABLE skin_conditions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  condition_name  TEXT NOT NULL,
  body_region     TEXT NOT NULL,
  severity        TEXT CHECK (severity IN ('mild', 'moderate', 'severe')),
  status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'monitoring')),
  diagnosis_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  notes           TEXT,
  treatments      JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_skin_conditions_clinic ON skin_conditions(clinic_id);
CREATE INDEX idx_skin_conditions_patient ON skin_conditions(patient_id);

-- ============================================================
-- 2. CARDIOLOGIST (Task 10)
-- ============================================================

CREATE TABLE ecg_records (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  record_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  file_url        TEXT,
  heart_rate      INT,
  rhythm          TEXT,
  interpretation  TEXT,
  notes           TEXT,
  is_abnormal     BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ecg_records_clinic ON ecg_records(clinic_id);
CREATE INDEX idx_ecg_records_patient ON ecg_records(patient_id);

CREATE TABLE blood_pressure_readings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  systolic        INT NOT NULL,
  diastolic       INT NOT NULL,
  heart_rate      INT,
  reading_date    TIMESTAMPTZ NOT NULL DEFAULT now(),
  position        TEXT DEFAULT 'sitting',
  arm             TEXT DEFAULT 'left',
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bp_readings_clinic ON blood_pressure_readings(clinic_id);
CREATE INDEX idx_bp_readings_patient ON blood_pressure_readings(patient_id);

CREATE TABLE heart_monitoring_notes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  note_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  category        TEXT DEFAULT 'general' CHECK (category IN ('general', 'alert', 'follow_up', 'medication')),
  title           TEXT NOT NULL,
  content         TEXT,
  severity        TEXT DEFAULT 'normal' CHECK (severity IN ('normal', 'warning', 'critical')),
  is_alert        BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_heart_notes_clinic ON heart_monitoring_notes(clinic_id);
CREATE INDEX idx_heart_notes_patient ON heart_monitoring_notes(patient_id);

-- ============================================================
-- 3. ENT SPECIALIST (Task 11)
-- ============================================================

CREATE TABLE hearing_tests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  test_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  test_type       TEXT DEFAULT 'pure_tone' CHECK (test_type IN ('pure_tone', 'speech', 'tympanometry', 'oae', 'abr')),
  left_ear_data   JSONB DEFAULT '{}',
  right_ear_data  JSONB DEFAULT '{}',
  interpretation  TEXT,
  hearing_loss_type TEXT,
  hearing_loss_degree TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_hearing_tests_clinic ON hearing_tests(clinic_id);
CREATE INDEX idx_hearing_tests_patient ON hearing_tests(patient_id);

CREATE TABLE ent_exam_records (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  exam_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  template_type   TEXT DEFAULT 'general' CHECK (template_type IN ('general', 'ear', 'nose', 'throat', 'sinus', 'vertigo')),
  findings        JSONB DEFAULT '{}',
  diagnosis       TEXT,
  plan            TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ent_exams_clinic ON ent_exam_records(clinic_id);
CREATE INDEX idx_ent_exams_patient ON ent_exam_records(patient_id);

-- ============================================================
-- 4. ORTHOPEDIST (Task 12)
-- ============================================================

CREATE TABLE xray_records (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  record_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  body_part       TEXT NOT NULL,
  image_url       TEXT,
  annotations     JSONB DEFAULT '[]',
  findings        TEXT,
  diagnosis       TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_xray_records_clinic ON xray_records(clinic_id);
CREATE INDEX idx_xray_records_patient ON xray_records(patient_id);

CREATE TABLE fracture_records (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  location        TEXT NOT NULL,
  fracture_type   TEXT NOT NULL,
  severity        TEXT DEFAULT 'simple' CHECK (severity IN ('simple', 'compound', 'comminuted', 'stress', 'greenstick')),
  status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'healing', 'healed', 'surgical')),
  injury_date     DATE NOT NULL,
  diagnosis_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_healing_date DATE,
  notes           TEXT,
  xray_record_id  UUID REFERENCES xray_records(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_fracture_records_clinic ON fracture_records(clinic_id);
CREATE INDEX idx_fracture_records_patient ON fracture_records(patient_id);

CREATE TABLE rehab_plans (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  title           TEXT NOT NULL,
  condition       TEXT NOT NULL,
  start_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  target_end_date DATE,
  status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),
  milestones      JSONB DEFAULT '[]',
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_rehab_plans_clinic ON rehab_plans(clinic_id);
CREATE INDEX idx_rehab_plans_patient ON rehab_plans(patient_id);

-- ============================================================
-- 5. PSYCHIATRIST (Task 13)
-- ============================================================

CREATE TABLE psych_session_notes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  session_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  session_number  INT DEFAULT 1,
  session_type    TEXT DEFAULT 'individual' CHECK (session_type IN ('individual', 'group', 'family', 'crisis')),
  mood_rating     INT CHECK (mood_rating BETWEEN 1 AND 10),
  content         TEXT,
  observations    TEXT,
  plan            TEXT,
  is_confidential BOOLEAN DEFAULT TRUE,
  access_level    TEXT DEFAULT 'doctor_only' CHECK (access_level IN ('doctor_only', 'care_team', 'full')),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_psych_notes_clinic ON psych_session_notes(clinic_id);
CREATE INDEX idx_psych_notes_patient ON psych_session_notes(patient_id);
CREATE INDEX idx_psych_notes_doctor ON psych_session_notes(doctor_id);

CREATE TABLE psych_medications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  medication_name TEXT NOT NULL,
  dosage          TEXT NOT NULL,
  frequency       TEXT NOT NULL,
  start_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date        DATE,
  status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'discontinued', 'adjusted', 'completed')),
  reason          TEXT,
  side_effects    TEXT,
  notes           TEXT,
  dosage_history  JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_psych_meds_clinic ON psych_medications(clinic_id);
CREATE INDEX idx_psych_meds_patient ON psych_medications(patient_id);

-- ============================================================
-- 6. NEUROLOGIST (Task 14)
-- ============================================================

CREATE TABLE eeg_records (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  record_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  file_url        TEXT,
  duration_minutes INT,
  findings        TEXT,
  interpretation  TEXT,
  is_abnormal     BOOLEAN DEFAULT FALSE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_eeg_records_clinic ON eeg_records(clinic_id);
CREATE INDEX idx_eeg_records_patient ON eeg_records(patient_id);

CREATE TABLE neuro_exam_records (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  exam_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  mental_status   JSONB DEFAULT '{}',
  cranial_nerves  JSONB DEFAULT '{}',
  motor_function  JSONB DEFAULT '{}',
  sensory_function JSONB DEFAULT '{}',
  reflexes        JSONB DEFAULT '{}',
  coordination    JSONB DEFAULT '{}',
  gait            JSONB DEFAULT '{}',
  diagnosis       TEXT,
  plan            TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_neuro_exams_clinic ON neuro_exam_records(clinic_id);
CREATE INDEX idx_neuro_exams_patient ON neuro_exam_records(patient_id);

-- ============================================================
-- 7. REMAINING SPECIALISTS (Task 15)
-- ============================================================

-- Urologist
CREATE TABLE urology_exams (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  exam_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  template_type   TEXT DEFAULT 'general' CHECK (template_type IN ('general', 'prostate', 'kidney', 'bladder', 'uti')),
  findings        JSONB DEFAULT '{}',
  lab_results     JSONB DEFAULT '{}',
  diagnosis       TEXT,
  plan            TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_urology_exams_clinic ON urology_exams(clinic_id);

-- Pulmonologist
CREATE TABLE spirometry_records (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  test_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  fvc             DECIMAL(5,2),
  fev1            DECIMAL(5,2),
  fev1_fvc_ratio  DECIMAL(5,2),
  pef             DECIMAL(5,2),
  interpretation  TEXT,
  test_quality    TEXT DEFAULT 'acceptable' CHECK (test_quality IN ('acceptable', 'good', 'poor')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_spirometry_clinic ON spirometry_records(clinic_id);

CREATE TABLE respiratory_tests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  test_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  test_type       TEXT NOT NULL,
  results         JSONB DEFAULT '{}',
  interpretation  TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_respiratory_tests_clinic ON respiratory_tests(clinic_id);

-- Endocrinologist
CREATE TABLE blood_sugar_readings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  reading_date    TIMESTAMPTZ NOT NULL DEFAULT now(),
  glucose_level   DECIMAL(6,2) NOT NULL,
  reading_type    TEXT DEFAULT 'fasting' CHECK (reading_type IN ('fasting', 'post_meal', 'random', 'hba1c')),
  unit            TEXT DEFAULT 'mg/dL',
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_blood_sugar_clinic ON blood_sugar_readings(clinic_id);
CREATE INDEX idx_blood_sugar_patient ON blood_sugar_readings(patient_id);

CREATE TABLE hormone_levels (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  test_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  hormone_name    TEXT NOT NULL,
  value           DECIMAL(10,3) NOT NULL,
  unit            TEXT NOT NULL,
  reference_range TEXT,
  is_abnormal     BOOLEAN DEFAULT FALSE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_hormone_levels_clinic ON hormone_levels(clinic_id);
CREATE INDEX idx_hormone_levels_patient ON hormone_levels(patient_id);

CREATE TABLE diabetes_management (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  diabetes_type   TEXT CHECK (diabetes_type IN ('type1', 'type2', 'gestational', 'prediabetes')),
  diagnosis_date  DATE,
  current_hba1c   DECIMAL(4,1),
  target_hba1c    DECIMAL(4,1) DEFAULT 7.0,
  medications     JSONB DEFAULT '[]',
  diet_plan       TEXT,
  exercise_plan   TEXT,
  monitoring_frequency TEXT DEFAULT 'daily',
  notes           TEXT,
  last_review_date DATE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_diabetes_mgmt_clinic ON diabetes_management(clinic_id);
CREATE INDEX idx_diabetes_mgmt_patient ON diabetes_management(patient_id);

-- Rheumatologist
CREATE TABLE joint_assessments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  joints_data     JSONB DEFAULT '{}',
  vas_pain_score  INT CHECK (vas_pain_score BETWEEN 0 AND 10),
  morning_stiffness_minutes INT,
  swollen_joint_count INT DEFAULT 0,
  tender_joint_count INT DEFAULT 0,
  das28_score     DECIMAL(4,2),
  functional_status TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_joint_assessments_clinic ON joint_assessments(clinic_id);
CREATE INDEX idx_joint_assessments_patient ON joint_assessments(patient_id);

CREATE TABLE mobility_tests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  test_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  test_type       TEXT NOT NULL,
  joint           TEXT NOT NULL,
  range_of_motion JSONB DEFAULT '{}',
  strength_score  INT CHECK (strength_score BETWEEN 0 AND 5),
  pain_during_test INT CHECK (pain_during_test BETWEEN 0 AND 10),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_mobility_tests_clinic ON mobility_tests(clinic_id);
CREATE INDEX idx_mobility_tests_patient ON mobility_tests(patient_id);

-- ============================================================
-- 8. UPDATE FEATURE FLAGS
-- ============================================================

-- Add specialist feature keys to relevant clinic types
UPDATE clinic_types
SET features_config = features_config || '{
  "dermatology": true,
  "cardiology": true,
  "ent": true,
  "orthopedics": true,
  "psychiatry": true,
  "neurology": true,
  "urology": true,
  "pulmonology": true,
  "endocrinology": true,
  "rheumatology": true
}'::jsonb
WHERE type_key = 'general_medicine';
