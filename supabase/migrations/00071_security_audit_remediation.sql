-- =============================================================================
-- Migration 00071: Security audit remediation (C-05, C-06)
--
-- C-05: Add partial UNIQUE on (clinic_id, phone) WHERE role='patient'
--       to prevent duplicate-phone crashes in webhook .single() lookups.
--
-- C-06: Change users.clinic_id and appointments.clinic_id from
--       ON DELETE CASCADE to ON DELETE RESTRICT, add clinics.deleted_at
--       for soft-delete support.
-- =============================================================================

BEGIN;

-- ── C-05: Partial unique index on users(clinic_id, phone) for patients ──
-- The WhatsApp webhook handler uses .single() to look up a patient by
-- (phone, clinic_id, role='patient'). Without a UNIQUE constraint, two
-- patients sharing a phone (family WhatsApp) crash the webhook with a
-- Postgres "more than one row" error. This partial index prevents that
-- while still allowing the same phone across different clinics or roles.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'users_clinic_phone_patient_unique'
  ) THEN
    CREATE UNIQUE INDEX users_clinic_phone_patient_unique
      ON users (clinic_id, phone)
      WHERE role = 'patient' AND phone IS NOT NULL;
    RAISE NOTICE 'C-05: Created partial unique index users_clinic_phone_patient_unique';
  END IF;
END $$;

-- ── C-06: Add clinics.deleted_at for soft-delete ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clinics' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE clinics ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    RAISE NOTICE 'C-06: Added clinics.deleted_at column for soft-delete';
  END IF;
END $$;

-- ── C-06: Change users.clinic_id FK from CASCADE to RESTRICT ──
-- Prevents accidental clinic deletion from wiping all users/appointments.
-- Operators must soft-delete (set deleted_at) instead.
DO $$
BEGIN
  -- Drop the existing CASCADE FK on users.clinic_id
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'users_clinic_id_fkey'
      AND table_name = 'users'
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_clinic_id_fkey;
    ALTER TABLE users ADD CONSTRAINT users_clinic_id_fkey
      FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE RESTRICT;
    RAISE NOTICE 'C-06: Changed users.clinic_id FK from CASCADE to RESTRICT';
  END IF;
END $$;

DO $$
BEGIN
  -- Drop the existing CASCADE FK on appointments.clinic_id
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'appointments_clinic_id_fkey'
      AND table_name = 'appointments'
  ) THEN
    ALTER TABLE appointments DROP CONSTRAINT appointments_clinic_id_fkey;
    ALTER TABLE appointments ADD CONSTRAINT appointments_clinic_id_fkey
      FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE RESTRICT;
    RAISE NOTICE 'C-06: Changed appointments.clinic_id FK from CASCADE to RESTRICT';
  END IF;
END $$;

COMMIT;
