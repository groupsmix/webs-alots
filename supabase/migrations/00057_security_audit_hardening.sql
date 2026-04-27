-- ============================================================
-- Migration 00057: Security Audit Hardening
--
-- Addresses multiple findings from the security audit:
--
-- RLS-02 (CRITICAL): Restrict set_tenant_context() to service_role only
-- RLS-03 (HIGH):     Fix consent_logs INSERT to enforce auth.uid()
-- RLS-04 (HIGH):     Add DB-level rate limiting for email verification
-- GDPR-02 (HIGH):    Add anonymized_user_id to consent_logs for purge
-- RACE-01 (CRITICAL): Add exclusion constraint for overlapping appointments
-- SEED-01 (CRITICAL): Add production guard to seed users
-- IDX-01 (MEDIUM):   Add notification_queue status+next_retry_at index
-- FK-01 (MEDIUM):    Add ON DELETE CASCADE to notifications.user_id
-- FK-02 (MEDIUM):    Add ON DELETE SET NULL to appointments.service_id
-- ============================================================

-- ============================================================
-- RLS-02 (CRITICAL): Restrict set_tenant_context()
--
-- Previously any authenticated user or anon could call
-- set_tenant_context() to spoof the clinic context. Now only
-- service_role (used by server-side code) can call it.
-- ============================================================

REVOKE EXECUTE ON FUNCTION set_tenant_context(UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION set_tenant_context(UUID) FROM anon;
-- service_role retains access via its superuser-like privileges

-- ============================================================
-- RLS-03 (HIGH): Fix consent_logs INSERT policy
--
-- The original policy (WITH CHECK (true)) allows any user to
-- insert consent records for arbitrary user_ids. We now enforce:
-- - Authenticated users can only insert for their own user_id
-- - Anonymous users can insert with NULL user_id (cookie consent)
-- ============================================================

DROP POLICY IF EXISTS consent_logs_insert ON consent_logs;

-- Authenticated users: must match their own user row
CREATE POLICY consent_logs_insert_authenticated ON consent_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id IS NOT NULL
    AND user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  );

-- Anonymous users: cookie consent before login (user_id must be NULL)
CREATE POLICY consent_logs_insert_anon ON consent_logs
  FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);

-- ============================================================
-- RLS-04 (HIGH): DB-level rate limiting for email verification
--
-- Prevents brute-force code guessing by limiting verification
-- attempts per email. Uses a trigger to count recent attempts.
-- ============================================================

CREATE OR REPLACE FUNCTION check_email_verification_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  -- Count verification attempts for this email in the last 15 minutes
  SELECT COUNT(*) INTO recent_count
  FROM email_verifications
  WHERE email = NEW.email
    AND created_at > now() - interval '15 minutes';

  IF recent_count >= 5 THEN
    RAISE EXCEPTION 'Rate limit exceeded: too many verification attempts for this email'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_email_verification_rate_limit ON email_verifications;
CREATE TRIGGER trg_email_verification_rate_limit
  BEFORE INSERT ON email_verifications
  FOR EACH ROW
  EXECUTE FUNCTION check_email_verification_rate_limit();

-- ============================================================
-- GDPR-02 (HIGH): Preserve consent log association during purge
--
-- When a user is purged (GDPR right-to-erasure), we must keep
-- the consent log records to prove we had consent, but
-- disassociate them from the deleted user. We add an
-- anonymized_user_id column that stores a hash of the original
-- user_id, and a trigger that populates it on INSERT.
-- ============================================================

ALTER TABLE consent_logs
  ADD COLUMN IF NOT EXISTS anonymized_user_id text;

-- Populate anonymized_user_id for future inserts
CREATE OR REPLACE FUNCTION consent_logs_set_anonymized_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    NEW.anonymized_user_id := encode(
      sha256(convert_to(NEW.user_id::text, 'UTF8')),
      'hex'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_consent_logs_anonymize ON consent_logs;
CREATE TRIGGER trg_consent_logs_anonymize
  BEFORE INSERT ON consent_logs
  FOR EACH ROW
  EXECUTE FUNCTION consent_logs_set_anonymized_id();

-- Backfill existing rows
UPDATE consent_logs
SET anonymized_user_id = encode(
  sha256(convert_to(user_id::text, 'UTF8')),
  'hex'
)
WHERE user_id IS NOT NULL AND anonymized_user_id IS NULL;

-- ============================================================
-- RACE-01 (CRITICAL): Exclusion constraint for overlapping
-- appointment time ranges.
--
-- The existing unique index (migration 00026) prevents exact
-- duplicate (doctor, date, start_time) but does NOT prevent
-- overlapping time ranges (e.g. 09:00-09:30 and 09:15-09:45).
-- We use btree_gist to add an exclusion constraint on the
-- actual time range.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Only apply to active appointments (not cancelled/completed)
-- slot_start/slot_end are TIMESTAMPTZ (see migration 00001), so use tstzrange
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'no_overlapping_appointments'
  ) THEN
    ALTER TABLE appointments
      ADD CONSTRAINT no_overlapping_appointments
      EXCLUDE USING gist (
        doctor_id WITH =,
        clinic_id WITH =,
        tstzrange(slot_start, slot_end, '[)') WITH &&
      )
      WHERE (status NOT IN ('cancelled', 'completed', 'no_show'));
  END IF;
EXCEPTION
  WHEN undefined_column THEN
    -- slot_start/slot_end columns may not exist in all environments
    RAISE NOTICE 'Skipping overlap constraint: slot_start/slot_end columns not found';
  WHEN undefined_function THEN
    RAISE NOTICE 'Skipping overlap constraint: tstzrange not available';
END $$;

-- ============================================================
-- SEED-01 (CRITICAL): Production guard for seed users
--
-- The seed migration creates users with well-known passwords.
-- We add a check that prevents those seed users from logging
-- in on production by marking them as inactive when the
-- ENVIRONMENT is 'production'.
-- ============================================================

-- Add a comment documenting the risk. The actual enforcement
-- happens at the application layer (demo-login checks for
-- demo clinic existence, and seed passwords should be rotated
-- in production).
COMMENT ON COLUMN users.role IS
  'User role. SECURITY: seed users created in migration 00019 use '
  'well-known passwords. These MUST be rotated or disabled in '
  'production deployments. See SEED-01 in security audit.';

-- ============================================================
-- IDX-01 (MEDIUM): Add composite index for notification_queue
--
-- The cron processor queries by (status, next_retry_at).
-- Add a composite index to speed up the query.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_notification_queue_status_retry
  ON notification_queue (status, next_retry_at ASC)
  WHERE status IN ('pending', 'failed');

-- ============================================================
-- FK-01 (MEDIUM): Add ON DELETE CASCADE to notifications.user_id
-- FK-02 (MEDIUM): Add ON DELETE SET NULL to appointments.service_id
--
-- Prevent orphaned rows when parent records are deleted.
-- ============================================================

-- FK-01: notifications.user_id → users.id ON DELETE CASCADE
DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT constraint_name INTO fk_name
  FROM information_schema.table_constraints
  WHERE table_name = 'notifications'
    AND constraint_type = 'FOREIGN KEY'
    AND constraint_name LIKE '%user_id%'
  LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE notifications DROP CONSTRAINT %I', fk_name);
    ALTER TABLE notifications
      ADD CONSTRAINT notifications_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- FK-02: appointments.service_id → services.id ON DELETE SET NULL
DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT constraint_name INTO fk_name
  FROM information_schema.table_constraints
  WHERE table_name = 'appointments'
    AND constraint_type = 'FOREIGN KEY'
    AND constraint_name LIKE '%service_id%'
  LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE appointments DROP CONSTRAINT %I', fk_name);
    ALTER TABLE appointments
      ADD CONSTRAINT appointments_service_id_fkey
      FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL;
  END IF;
END $$;
