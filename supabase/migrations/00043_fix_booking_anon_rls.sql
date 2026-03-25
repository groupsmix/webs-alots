-- Migration 00043: Fix booking flow for anonymous users
--
-- Problem: The booking API route runs as the anon role (via createTenantClient)
-- but several operations fail due to missing RLS policies:
--   1. INSERT into users (patient record creation) — blocked by RLS
--   2. INSERT into appointments — no anon INSERT policy
--   3. DELETE from appointments (race-condition rollback) — no anon DELETE policy
--   4. INSERT into activity_logs (audit trail) — no anon INSERT policy
--
-- Solution:
--   A) SECURITY DEFINER function for patient find-or-create (avoids exposing
--      patient SELECT + INSERT to the anon role directly)
--   B) Scoped anon INSERT/DELETE policies on appointments (tenant-isolated)
--   C) Scoped anon INSERT policy on activity_logs (tenant-isolated)

-- ============================================================
-- A) SECURITY DEFINER function: booking_find_or_create_patient
-- ============================================================
-- Finds an existing patient by phone (preferred) or name within the clinic,
-- or creates a new one.  Runs as the function owner (bypasses RLS) so the
-- anon role does not need direct SELECT/INSERT on the users table for patients.

CREATE OR REPLACE FUNCTION booking_find_or_create_patient(
  p_clinic_id UUID,
  p_name      TEXT,
  p_phone     TEXT DEFAULT NULL,
  p_email     TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_id UUID;
  v_request_clinic_id UUID;
BEGIN
  -- Tenant guard: the caller's x-clinic-id header must match p_clinic_id
  v_request_clinic_id := get_request_clinic_id();
  IF v_request_clinic_id IS NULL OR v_request_clinic_id <> p_clinic_id THEN
    RAISE EXCEPTION 'Tenant mismatch: request clinic does not match p_clinic_id';
  END IF;

  -- 1. Look up by phone (preferred — avoids name collisions)
  IF p_phone IS NOT NULL AND p_phone <> '' THEN
    SELECT id INTO v_patient_id
      FROM users
     WHERE clinic_id = p_clinic_id
       AND phone = p_phone
       AND role = 'patient'
     LIMIT 1;

    IF v_patient_id IS NOT NULL THEN
      RETURN v_patient_id;
    END IF;
  END IF;

  -- 2. Look up by name (only if exactly one match to avoid ambiguity)
  SELECT id INTO v_patient_id
    FROM users
   WHERE clinic_id = p_clinic_id
     AND name = p_name
     AND role = 'patient'
   LIMIT 1;

  -- Check if there are multiple matches (ambiguous)
  IF v_patient_id IS NOT NULL THEN
    DECLARE
      v_count INT;
    BEGIN
      SELECT count(*) INTO v_count
        FROM users
       WHERE clinic_id = p_clinic_id
         AND name = p_name
         AND role = 'patient';
      IF v_count = 1 THEN
        RETURN v_patient_id;
      END IF;
      -- Multiple matches — fall through to create a new record
    END;
  END IF;

  -- 3. Create a new patient record
  INSERT INTO users (clinic_id, name, phone, email, role)
  VALUES (p_clinic_id, p_name, p_phone, p_email, 'patient')
  RETURNING id INTO v_patient_id;

  RETURN v_patient_id;
END;
$$;

-- Grant EXECUTE to anon + authenticated so the RPC is callable
GRANT EXECUTE ON FUNCTION booking_find_or_create_patient(UUID, TEXT, TEXT, TEXT) TO anon, authenticated;

-- ============================================================
-- B) Anon INSERT/DELETE policies on appointments
-- ============================================================
-- Scoped to get_request_clinic_id() so tenant isolation is maintained.
-- The booking token verification in the API route prevents abuse.

-- INSERT: allow anon to create appointments for the clinic in the x-clinic-id header
CREATE POLICY anon_appointments_insert
  ON appointments
  FOR INSERT
  TO anon
  WITH CHECK (
    auth.uid() IS NULL
    AND clinic_id = get_request_clinic_id()
  );

-- DELETE: allow anon to delete appointments for race-condition rollback only
-- Scoped to the same clinic and only very recent appointments (created_at within last 30 seconds)
CREATE POLICY anon_appointments_delete
  ON appointments
  FOR DELETE
  TO anon
  USING (
    auth.uid() IS NULL
    AND clinic_id = get_request_clinic_id()
    AND created_at >= now() - interval '30 seconds'
  );

-- ============================================================
-- C) Anon INSERT policy on activity_logs
-- ============================================================
-- Allows the booking flow to write audit entries.

CREATE POLICY anon_activity_logs_insert
  ON activity_logs
  FOR INSERT
  TO anon
  WITH CHECK (
    auth.uid() IS NULL
    AND clinic_id = get_request_clinic_id()
  );
