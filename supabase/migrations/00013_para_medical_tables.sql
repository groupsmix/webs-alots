-- Phase 3: Para-Medical Types
-- Physiotherapist, Nutritionist, Psychologist, Speech Therapist, Optician

-- ========== Physiotherapist ==========

CREATE TABLE IF NOT EXISTS exercise_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES users(id),
  therapist_id uuid NOT NULL REFERENCES users(id),
  title text NOT NULL,
  exercises jsonb NOT NULL DEFAULT '[]',
  frequency text DEFAULT 'daily',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','paused')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS physio_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES users(id),
  therapist_id uuid NOT NULL REFERENCES users(id),
  program_id uuid REFERENCES exercise_programs(id),
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  duration_minutes int NOT NULL DEFAULT 30,
  attended boolean NOT NULL DEFAULT true,
  progress_notes text,
  pain_level_before int CHECK (pain_level_before BETWEEN 0 AND 10),
  pain_level_after int CHECK (pain_level_after BETWEEN 0 AND 10),
  exercises_completed jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS progress_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES users(id),
  photo_url text NOT NULL,
  photo_date date NOT NULL DEFAULT CURRENT_DATE,
  category text DEFAULT 'general',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ========== Nutritionist ==========

CREATE TABLE IF NOT EXISTS meal_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES users(id),
  nutritionist_id uuid NOT NULL REFERENCES users(id),
  title text NOT NULL,
  type text NOT NULL DEFAULT 'weekly' CHECK (type IN ('daily','weekly')),
  daily_plans jsonb NOT NULL DEFAULT '[]',
  target_calories int DEFAULT 2000,
  notes text,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('active','completed','draft')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS body_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES users(id),
  measurement_date date NOT NULL DEFAULT CURRENT_DATE,
  weight_kg numeric(5,2),
  height_cm numeric(5,1),
  bmi numeric(4,1),
  body_fat_pct numeric(4,1),
  waist_cm numeric(5,1),
  hip_cm numeric(5,1),
  chest_cm numeric(5,1),
  arm_cm numeric(5,1),
  thigh_cm numeric(5,1),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ========== Psychologist ==========

CREATE TABLE IF NOT EXISTS therapy_session_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES users(id),
  therapist_id uuid NOT NULL REFERENCES users(id),
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  session_number int NOT NULL DEFAULT 1,
  duration_minutes int NOT NULL DEFAULT 50,
  session_type text NOT NULL DEFAULT 'individual' CHECK (session_type IN ('individual','couple','family','group')),
  mood_rating int CHECK (mood_rating BETWEEN 1 AND 10),
  presenting_issues text,
  interventions text,
  observations text,
  homework text,
  is_confidential boolean NOT NULL DEFAULT true,
  risk_assessment text CHECK (risk_assessment IN ('none','low','moderate','high')),
  next_session_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS therapy_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES users(id),
  therapist_id uuid NOT NULL REFERENCES users(id),
  diagnosis text,
  treatment_approach text NOT NULL DEFAULT '',
  goals jsonb NOT NULL DEFAULT '[]',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  review_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','on_hold')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ========== Speech Therapist ==========

CREATE TABLE IF NOT EXISTS speech_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('articulation','fluency','language','voice','pragmatics','phonology')),
  description text NOT NULL DEFAULT '',
  difficulty text NOT NULL DEFAULT 'beginner' CHECK (difficulty IN ('beginner','intermediate','advanced')),
  target_sounds jsonb NOT NULL DEFAULT '[]',
  instructions text NOT NULL DEFAULT '',
  materials_needed text,
  duration_minutes int NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS speech_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES users(id),
  therapist_id uuid NOT NULL REFERENCES users(id),
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  duration_minutes int NOT NULL DEFAULT 30,
  attended boolean NOT NULL DEFAULT true,
  exercises_assigned jsonb NOT NULL DEFAULT '[]',
  exercises_completed jsonb NOT NULL DEFAULT '[]',
  accuracy_pct int CHECK (accuracy_pct BETWEEN 0 AND 100),
  notes text,
  home_practice text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS speech_progress_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES users(id),
  therapist_id uuid NOT NULL REFERENCES users(id),
  report_date date NOT NULL DEFAULT CURRENT_DATE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  goals_summary text NOT NULL DEFAULT '',
  progress_summary text NOT NULL DEFAULT '',
  areas_of_improvement jsonb NOT NULL DEFAULT '[]',
  areas_of_concern jsonb NOT NULL DEFAULT '[]',
  recommendations text NOT NULL DEFAULT '',
  next_steps text NOT NULL DEFAULT '',
  overall_progress text NOT NULL DEFAULT 'moderate' CHECK (overall_progress IN ('significant','moderate','minimal','regression')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ========== Optician ==========

CREATE TABLE IF NOT EXISTS lens_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('single_vision','bifocal','progressive','contact','sunglasses')),
  material text NOT NULL DEFAULT '',
  coating text,
  power_range text NOT NULL DEFAULT '',
  stock_quantity int NOT NULL DEFAULT 0,
  min_threshold int NOT NULL DEFAULT 5,
  unit_cost numeric(10,2) NOT NULL DEFAULT 0,
  selling_price numeric(10,2) NOT NULL DEFAULT 0,
  supplier text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS frame_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  brand text NOT NULL,
  model text NOT NULL,
  color text NOT NULL DEFAULT '',
  size text NOT NULL DEFAULT '',
  material text NOT NULL DEFAULT '',
  frame_type text NOT NULL DEFAULT 'full_rim' CHECK (frame_type IN ('full_rim','semi_rimless','rimless')),
  gender text NOT NULL DEFAULT 'unisex' CHECK (gender IN ('men','women','unisex','kids')),
  price numeric(10,2) NOT NULL DEFAULT 0,
  cost_price numeric(10,2) NOT NULL DEFAULT 0,
  stock_quantity int NOT NULL DEFAULT 0,
  photo_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS optical_prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES users(id),
  ophthalmologist_name text,
  prescription_date date NOT NULL DEFAULT CURRENT_DATE,
  expiry_date date,
  right_eye jsonb NOT NULL DEFAULT '{}',
  left_eye jsonb NOT NULL DEFAULT '{}',
  notes text,
  frame_id uuid REFERENCES frame_catalog(id),
  lens_type text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','ready','delivered')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ========== RLS Policies ==========

ALTER TABLE exercise_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE physio_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE body_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE therapy_session_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE therapy_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE speech_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE speech_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE speech_progress_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE lens_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE frame_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE optical_prescriptions ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (scoped by clinic_id in app logic)
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'exercise_programs','physio_sessions','progress_photos',
    'meal_plans','body_measurements',
    'therapy_session_notes','therapy_plans',
    'speech_exercises','speech_sessions','speech_progress_reports',
    'lens_inventory','frame_catalog','optical_prescriptions'
  ])
  LOOP
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (true) WITH CHECK (true)',
      'allow_all_' || tbl, tbl);
  END LOOP;
END $$;

-- ========== Insert para-medical clinic types ==========

INSERT INTO clinic_types (type_key, name_fr, name_ar, category, icon, features_config, sort_order, is_active)
VALUES
  ('physiotherapist', 'Kinésithérapeute', 'معالج طبيعي', 'para_medical', 'Activity', '{"appointments":true,"exercise_programs":true,"consultations":true}', 20, true),
  ('nutritionist', 'Nutritionniste', 'أخصائي تغذية', 'para_medical', 'Apple', '{"appointments":true,"meal_plans":true,"consultations":true}', 21, true),
  ('psychologist', 'Psychologue', 'أخصائي نفسي', 'para_medical', 'Brain', '{"appointments":true,"therapy_notes":true,"consultations":true}', 22, true),
  ('speech_therapist', 'Orthophoniste', 'أخصائي نطق', 'para_medical', 'Mic', '{"appointments":true,"speech_exercises":true,"consultations":true}', 23, true),
  ('optician', 'Opticien', 'نظاراتي', 'para_medical', 'Eye', '{"appointments":true,"lens_inventory":true,"frame_catalog":true,"optical_prescriptions":true}', 24, true)
ON CONFLICT (type_key) DO NOTHING;
