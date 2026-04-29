-- =============================================================================
-- Migration 00068: Consolidated Audit Fixes
--
-- Addresses findings from 5 security/schema/performance audits.
-- Each section references the original audit item (S-XX, D-XX, etc.).
-- =============================================================================

BEGIN;

-- ─── S-01: Drop plaintext key column on clinic_api_keys ─────────────────────
-- The raw API key must never be persisted. Only key_hash (SHA-256) is kept.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clinic_api_keys' AND column_name = 'key'
  ) THEN
    -- Drop the btree index on the plaintext key first
    DROP INDEX IF EXISTS idx_clinic_api_keys_key;
    ALTER TABLE clinic_api_keys DROP COLUMN "key";
    RAISE NOTICE 'S-01: Dropped plaintext key column from clinic_api_keys';
  END IF;
END $$;

-- ─── S-04: REVOKE EXECUTE on SECURITY DEFINER functions from public/anon ────
-- These functions should only be callable by service_role, not by anon JWTs.
DO $$
DECLARE
  func_name TEXT;
  func_names TEXT[] := ARRAY[
    'register_new_clinic',
    'booking_find_or_create_patient',
    'handle_new_auth_user',
    'set_tenant_context'
  ];
BEGIN
  FOREACH func_name IN ARRAY func_names
  LOOP
    BEGIN
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION %I FROM PUBLIC, anon, authenticated',
        func_name
      );
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION %I TO service_role',
        func_name
      );
      RAISE NOTICE 'S-04: Revoked public execute on %', func_name;
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'S-04: Function % does not exist, skipping', func_name;
    END;
  END LOOP;
END $$;

-- ─── S-07: Create public_clinic_directory view for anon access ──────────────
-- Anon callers should only see (id, name, subdomain, type, status) — not
-- owner email/phone/config. Replace the broad clinics_select_active_public
-- RLS policy with a restricted view.
CREATE OR REPLACE VIEW public_clinic_directory AS
SELECT id, name, subdomain, type, status
FROM clinics
WHERE status = 'active';

-- Grant anon read on the view
GRANT SELECT ON public_clinic_directory TO anon;

-- Drop the overly broad anon SELECT policy if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'clinics' AND policyname = 'clinics_select_active_public'
  ) THEN
    DROP POLICY clinics_select_active_public ON clinics;
    RAISE NOTICE 'S-07: Dropped clinics_select_active_public RLS policy';
  END IF;
END $$;

-- ─── S-21: Enforce consultation_notes.private flag in RLS ───────────────────
-- Only the author doctor can see private notes; other staff see non-private.
DO $$
BEGIN
  -- Drop existing policy if present
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'consultation_notes'
    AND policyname = 'consultation_notes_select_clinic'
  ) THEN
    DROP POLICY consultation_notes_select_clinic ON consultation_notes;
  END IF;

  -- Create the tightened policy
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'consultation_notes'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY consultation_notes_select_private ON consultation_notes
      FOR SELECT USING (
        clinic_id = (current_setting('request.header.x-clinic-id', true))::uuid
        AND (
          -- Author can always see their own notes
          doctor_id = (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1)
          -- Others can only see non-private notes
          OR private IS NOT TRUE
        )
      )
    $policy$;
    RAISE NOTICE 'S-21: Created consultation_notes_select_private RLS policy';
  END IF;
END $$;

-- ─── D-01: Add currency column to payments ──────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'currency'
  ) THEN
    ALTER TABLE payments ADD COLUMN currency CHAR(3) NOT NULL DEFAULT 'MAD'
      CHECK (currency ~ '^[A-Z]{3}$');
    CREATE INDEX IF NOT EXISTS idx_payments_currency ON payments (currency);
    RAISE NOTICE 'D-01: Added currency column to payments';
  END IF;
END $$;

-- ─── D-03: Unique indexes on users.email and users.phone ────────────────────
-- Use functional indexes with normalization for dedup.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_uq
  ON users (lower(email))
  WHERE email IS NOT NULL;

-- E.164-normalized partial unique on phone
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_normalized_uq
  ON users (regexp_replace(phone, '[^0-9+]', '', 'g'))
  WHERE phone IS NOT NULL;

-- ─── D-04: users.auth_id UNIQUE + role CHECK ────────────────────────────────
DO $$
BEGIN
  -- Add UNIQUE constraint on auth_id if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'users' AND indexname = 'users_auth_id_unique'
  ) THEN
    CREATE UNIQUE INDEX users_auth_id_unique ON users (auth_id) WHERE auth_id IS NOT NULL;
    RAISE NOTICE 'D-04: Created unique index on users.auth_id';
  END IF;

  -- Add CHECK constraint for valid roles
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_role_valid_check' AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_role_valid_check
      CHECK (role IN ('super_admin', 'clinic_admin', 'receptionist', 'doctor', 'patient'));
    RAISE NOTICE 'D-04: Added role CHECK constraint on users';
  END IF;
END $$;

-- ─── D-08: users.role / clinic_id cross-constraint ──────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_role_clinic_id_check' AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_role_clinic_id_check
      CHECK (
        (role = 'super_admin' AND clinic_id IS NULL)
        OR (role <> 'super_admin' AND clinic_id IS NOT NULL)
      );
    RAISE NOTICE 'D-08: Added role/clinic_id cross-constraint on users';
  END IF;
END $$;

-- ─── D-09: loyalty_points.points CHECK >= 0 ─────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loyalty_points' AND column_name = 'points'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'loyalty_points_non_negative' AND conrelid = 'loyalty_points'::regclass
    ) THEN
      ALTER TABLE loyalty_points ADD CONSTRAINT loyalty_points_non_negative
        CHECK (points >= 0);
      RAISE NOTICE 'D-09: Added non-negative CHECK on loyalty_points.points';
    END IF;
  END IF;
END $$;

-- ─── D-11: family_members clinic_id backfill ────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'family_members'
  ) THEN
    -- Add clinic_id column if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'family_members' AND column_name = 'clinic_id'
    ) THEN
      ALTER TABLE family_members ADD COLUMN clinic_id UUID REFERENCES clinics(id);

      -- Backfill from the primary user
      UPDATE family_members fm
      SET clinic_id = u.clinic_id
      FROM users u
      WHERE fm.user_id = u.id
      AND fm.clinic_id IS NULL;

      -- Make NOT NULL after backfill
      ALTER TABLE family_members ALTER COLUMN clinic_id SET NOT NULL;
      RAISE NOTICE 'D-11: Added and backfilled clinic_id on family_members';
    END IF;
  END IF;
END $$;

-- ─── S-38: Add iv, auth_tag, sha256 columns to documents ───────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'documents'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'documents' AND column_name = 'iv'
    ) THEN
      ALTER TABLE documents ADD COLUMN iv BYTEA;
      ALTER TABLE documents ADD COLUMN auth_tag BYTEA;
      ALTER TABLE documents ADD COLUMN sha256 BYTEA;
      RAISE NOTICE 'S-38: Added encryption columns to documents';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'prescription_requests'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'prescription_requests' AND column_name = 'iv'
    ) THEN
      ALTER TABLE prescription_requests ADD COLUMN iv BYTEA;
      ALTER TABLE prescription_requests ADD COLUMN auth_tag BYTEA;
      ALTER TABLE prescription_requests ADD COLUMN sha256 BYTEA;
      RAISE NOTICE 'S-38: Added encryption columns to prescription_requests';
    END IF;
  END IF;
END $$;

-- ─── CC-03: Statement timeout on SECURITY DEFINER functions ─────────────────
-- Prevent long-running functions from holding locks indefinitely.
DO $$
BEGIN
  -- register_new_clinic
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'register_new_clinic') THEN
    ALTER FUNCTION register_new_clinic SET statement_timeout = '5s';
    ALTER FUNCTION register_new_clinic SET lock_timeout = '2s';
    RAISE NOTICE 'CC-03: Set timeouts on register_new_clinic';
  END IF;

  -- booking_find_or_create_patient
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'booking_find_or_create_patient') THEN
    ALTER FUNCTION booking_find_or_create_patient SET statement_timeout = '5s';
    ALTER FUNCTION booking_find_or_create_patient SET lock_timeout = '2s';
    RAISE NOTICE 'CC-03: Set timeouts on booking_find_or_create_patient';
  END IF;
END $$;

-- ─── P-01: Replace idx_appointments_slot with doctor_date index ─────────────
DROP INDEX IF EXISTS idx_appointments_slot;
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date
  ON appointments (doctor_id, appointment_date, start_time)
  WHERE status NOT IN ('cancelled', 'no_show');

-- ─── P-02: Replace idx_appointments_status with partial index ───────────────
DROP INDEX IF EXISTS idx_appointments_status;
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_active
  ON appointments (clinic_id, appointment_date)
  WHERE status IN ('pending', 'confirmed', 'checked_in', 'in_progress');

-- ─── P-04: Add compound index for cron queries ─────────────────────────────
CREATE INDEX IF NOT EXISTS idx_appointments_cron_compound
  ON appointments (clinic_id, appointment_date, status);

-- ─── S-27: partner_api_keys table (hard schema requirement) ─────────────────
CREATE TABLE IF NOT EXISTS partner_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  partner_name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS on partner_api_keys
ALTER TABLE partner_api_keys ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'partner_api_keys'
    AND policyname = 'partner_api_keys_clinic_scope'
  ) THEN
    CREATE POLICY partner_api_keys_clinic_scope ON partner_api_keys
    FOR ALL USING (
      clinic_id = (current_setting('request.header.x-clinic-id', true))::uuid
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_partner_api_keys_hash ON partner_api_keys (key_prefix, is_active);
CREATE INDEX IF NOT EXISTS idx_partner_api_keys_clinic ON partner_api_keys (clinic_id);

-- ─── S-28: Add expires_at to clinic_api_keys for rotation enforcement ───────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clinic_api_keys' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE clinic_api_keys ADD COLUMN expires_at TIMESTAMPTZ;
    RAISE NOTICE 'S-28: Added expires_at to clinic_api_keys';
  END IF;
END $$;

-- ─── D-05: Document money column convention ─────────────────────────────────
-- Adding a comment to clarify the convention (DECIMAL major units, not centimes)
COMMENT ON COLUMN payments.amount IS 'Amount in major currency units (e.g. 200.00 MAD). DECIMAL(10,2).';

-- ─── CC-02: Advisory lock on email_verifications rate-limit trigger ──────────
-- Prevent TOCTOU race in the email verification rate-limit trigger.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'check_email_verification_rate_limit'
  ) THEN
    -- Replace the trigger function with one that takes an advisory lock
    CREATE OR REPLACE FUNCTION check_email_verification_rate_limit()
    RETURNS TRIGGER AS $func$
    DECLARE
      recent_count INT;
    BEGIN
      -- CC-02: Take advisory lock keyed on email hash to prevent TOCTOU
      PERFORM pg_advisory_xact_lock(hashtext(NEW.email));

      SELECT COUNT(*) INTO recent_count
      FROM email_verifications
      WHERE email = NEW.email
        AND created_at > (NOW() - INTERVAL '1 hour');

      IF recent_count >= 5 THEN
        RAISE EXCEPTION 'Too many verification attempts for this email'
          USING ERRCODE = 'P0001';
      END IF;

      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public;

    RAISE NOTICE 'CC-02: Updated email verification rate-limit trigger with advisory lock';
  END IF;
END $$;

-- ─── S-03: Harden handle_new_auth_user trigger ─────────────────────────────
-- Strip role, clinic_id, and is_super_admin from raw_user_meta_data.
-- Force role to 'patient' for self-signup paths.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'handle_new_auth_user'
  ) THEN
    CREATE OR REPLACE FUNCTION handle_new_auth_user()
    RETURNS TRIGGER AS $func$
    DECLARE
      safe_meta JSONB;
      user_role TEXT := 'patient';
      user_clinic_id UUID := NULL;
    BEGIN
      -- S-03: Strip dangerous fields from client-supplied metadata
      safe_meta := NEW.raw_user_meta_data;
      safe_meta := safe_meta - 'role' - 'clinic_id' - 'is_super_admin';

      -- Force role to patient for self-signup. Privileged routes
      -- (register_new_clinic, admin-create) override via service-role inserts.
      INSERT INTO public.users (
        auth_id,
        email,
        name,
        role,
        clinic_id,
        created_at,
        updated_at
      ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(safe_meta->>'full_name', safe_meta->>'name', split_part(NEW.email, '@', 1)),
        user_role,
        user_clinic_id,
        NOW(),
        NOW()
      )
      ON CONFLICT (auth_id) DO UPDATE SET
        email = EXCLUDED.email,
        updated_at = NOW();

      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public;

    RAISE NOTICE 'S-03: Hardened handle_new_auth_user trigger';
  END IF;
END $$;

-- ─── R-02: Add retention cleanup for rate_limit_entries ─────────────────────
-- This is a helper function that can be called by the cron
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limit_entries()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM rate_limit_entries
  WHERE reset_at < (extract(epoch from now()) * 1000 - 86400000);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
SET statement_timeout = '10s';

-- ─── D-12: HMAC-based anonymized_user_id for consent_logs ───────────────────
-- Add a comment documenting the pseudonymization approach
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'consent_logs' AND column_name = 'anonymized_user_id'
  ) THEN
    COMMENT ON COLUMN consent_logs.anonymized_user_id IS
      'Pseudonymous ID: HMAC-SHA256(user_id, server_pepper). NOT truly anonymous. Pepper rotated annually per docs/compliance/retention.md.';
    RAISE NOTICE 'D-12: Documented anonymized_user_id pseudonymization';
  END IF;
END $$;

-- ─── C-03: processing_consents table for consent ledger ─────────────────────
CREATE TABLE IF NOT EXISTS processing_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  processing_activity TEXT NOT NULL,
  legal_basis TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'app',
  ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE processing_consents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'processing_consents'
    AND policyname = 'processing_consents_user_own'
  ) THEN
    CREATE POLICY processing_consents_user_own ON processing_consents
    FOR ALL USING (
      user_id = (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1)
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_processing_consents_user ON processing_consents (user_id);

COMMIT;
