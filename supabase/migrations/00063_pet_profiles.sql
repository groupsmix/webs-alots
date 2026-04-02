-- ============================================================
-- Migration 00061: Pet Profiles (Veterinary Vertical)
-- Adds pet_profiles table for veterinary clinics to track
-- animal patients (name, species, breed, weight, DOB).
-- Also adds pet_id column to vaccinations table to link
-- vaccination records to specific pets.
-- ============================================================

-- ============================================================
-- 1. PET PROFILES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS pet_profiles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  owner_id        UUID NOT NULL REFERENCES users(id),
  name            TEXT NOT NULL,
  species         TEXT NOT NULL CHECK (species IN (
    'dog', 'cat', 'bird', 'rabbit', 'hamster', 'fish',
    'reptile', 'horse', 'cattle', 'sheep', 'goat', 'other'
  )),
  breed           TEXT,
  weight_kg       NUMERIC(6,2),
  date_of_birth   DATE,
  photo_url       TEXT,
  notes           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pet_profiles_clinic ON pet_profiles(clinic_id);
CREATE INDEX IF NOT EXISTS idx_pet_profiles_owner ON pet_profiles(owner_id);
CREATE INDEX IF NOT EXISTS idx_pet_profiles_species ON pet_profiles(clinic_id, species);

-- ============================================================
-- 2. ENABLE RLS
-- ============================================================

ALTER TABLE pet_profiles ENABLE ROW LEVEL SECURITY;

-- Super admin: full access
CREATE POLICY "sa_pet_profiles_all"
  ON pet_profiles FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Clinic staff: full access within their clinic
CREATE POLICY "staff_pet_profiles"
  ON pet_profiles FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());

-- Pet owner: read-only access to their own pets
CREATE POLICY "owner_pet_profiles_read"
  ON pet_profiles FOR SELECT
  USING (owner_id = get_my_user_id());

-- ============================================================
-- 3. LINK VACCINATIONS TO PET PROFILES
-- Add optional pet_id column to existing vaccinations table
-- so vaccination records can be linked to specific pets.
-- ============================================================

ALTER TABLE vaccinations
  ADD COLUMN IF NOT EXISTS pet_id UUID REFERENCES pet_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vaccinations_pet ON vaccinations(pet_id);
