-- ============================================================
-- 00061: Veterinary Vertical
--
-- 1. Expand category CHECK constraint to include 'veterinary'
-- 2. Seed veterinary clinic types
-- 3. Create pet_profiles table
-- 4. Add RLS policies for pet_profiles
-- ============================================================

-- ============================================================
-- 1. EXPAND CATEGORY CHECK CONSTRAINT
-- ============================================================

-- Drop the existing CHECK constraint and re-create with 'veterinary'
DO $$
BEGIN
  -- Try to drop the constraint if it exists (name may vary)
  ALTER TABLE clinic_types DROP CONSTRAINT IF EXISTS clinic_types_category_check;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

ALTER TABLE clinic_types
  ADD CONSTRAINT clinic_types_category_check
  CHECK (category IN (
    'medical', 'para_medical', 'diagnostic', 'pharmacy_retail',
    'clinics_centers', 'veterinary', 'restaurant'
  ));

-- ============================================================
-- 2. SEED VETERINARY CLINIC TYPES
-- ============================================================

INSERT INTO clinic_types (type_key, name_fr, name_ar, category, icon, sort_order, features_config) VALUES
('vet_general',    'Vétérinaire Généraliste', 'طبيب بيطري عام',    'veterinary', 'PawPrint',    38, '{"appointments":true,"prescriptions":true,"consultations":true,"vaccination":true,"stock":true,"pet_profiles":true,"website":true}'),
('vet_specialist', 'Vétérinaire Spécialiste', 'طبيب بيطري متخصص',  'veterinary', 'Stethoscope', 39, '{"appointments":true,"prescriptions":true,"consultations":true,"vaccination":true,"stock":true,"pet_profiles":true,"website":true}'),
('vet_emergency',  'Urgences Vétérinaires',   'طوارئ بيطرية',       'veterinary', 'Siren',       40, '{"appointments":true,"prescriptions":true,"consultations":true,"vaccination":true,"stock":true,"pet_profiles":true,"website":true}'),
('pet_grooming',   'Toilettage Animaux',      'تنظيف الحيوانات',    'veterinary', 'Scissors',    41, '{"appointments":true,"prescriptions":false,"consultations":false,"vaccination":false,"stock":true,"pet_profiles":true,"website":true}')
ON CONFLICT (type_key) DO NOTHING;

-- ============================================================
-- 3. CREATE PET_PROFILES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS pet_profiles (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  clinic_id      UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  species        TEXT NOT NULL,           -- e.g. 'dog', 'cat', 'bird', 'rabbit', 'other'
  breed          TEXT,
  weight_kg      NUMERIC(6,2),
  date_of_birth  DATE,
  photo_url      TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pet_profiles_owner     ON pet_profiles(owner_id);
CREATE INDEX IF NOT EXISTS idx_pet_profiles_clinic    ON pet_profiles(clinic_id);
CREATE INDEX IF NOT EXISTS idx_pet_profiles_species   ON pet_profiles(species);

COMMENT ON TABLE  pet_profiles IS 'Animal profiles for the veterinary vertical — one pet per row, linked to owner (user) and clinic.';
COMMENT ON COLUMN pet_profiles.species IS 'Animal species: dog, cat, bird, rabbit, reptile, other';
COMMENT ON COLUMN pet_profiles.weight_kg IS 'Weight in kilograms (max 9999.99 kg)';

-- ============================================================
-- 4. RLS POLICIES FOR PET_PROFILES
-- ============================================================

ALTER TABLE pet_profiles ENABLE ROW LEVEL SECURITY;

-- Clinic staff can see all pets in their clinic
CREATE POLICY "pet_profiles_select_clinic_staff" ON pet_profiles
  FOR SELECT
  USING (
    clinic_id::text = current_setting('request.headers', true)::json->>'x-clinic-id'
  );

-- Pet owners can see their own pets
CREATE POLICY "pet_profiles_select_owner" ON pet_profiles
  FOR SELECT
  USING (owner_id = auth.uid());

-- Clinic admin and receptionist can insert pets
CREATE POLICY "pet_profiles_insert_staff" ON pet_profiles
  FOR INSERT
  WITH CHECK (
    clinic_id::text = current_setting('request.headers', true)::json->>'x-clinic-id'
  );

-- Pet owners can insert their own pets
CREATE POLICY "pet_profiles_insert_owner" ON pet_profiles
  FOR INSERT
  WITH CHECK (
    owner_id = auth.uid()
    AND clinic_id::text = current_setting('request.headers', true)::json->>'x-clinic-id'
  );

-- Clinic staff can update pets in their clinic
CREATE POLICY "pet_profiles_update_staff" ON pet_profiles
  FOR UPDATE
  USING (
    clinic_id::text = current_setting('request.headers', true)::json->>'x-clinic-id'
  )
  WITH CHECK (
    clinic_id::text = current_setting('request.headers', true)::json->>'x-clinic-id'
  );

-- Pet owners can update their own pets
CREATE POLICY "pet_profiles_update_owner" ON pet_profiles
  FOR UPDATE
  USING (
    owner_id = auth.uid()
    AND clinic_id::text = current_setting('request.headers', true)::json->>'x-clinic-id'
  )
  WITH CHECK (
    owner_id = auth.uid()
    AND clinic_id::text = current_setting('request.headers', true)::json->>'x-clinic-id'
  );

-- Only clinic admin can delete pets
CREATE POLICY "pet_profiles_delete_staff" ON pet_profiles
  FOR DELETE
  USING (
    clinic_id::text = current_setting('request.headers', true)::json->>'x-clinic-id'
  );

-- ============================================================
-- 5. UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_pet_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pet_profiles_updated_at
  BEFORE UPDATE ON pet_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_pet_profiles_updated_at();
