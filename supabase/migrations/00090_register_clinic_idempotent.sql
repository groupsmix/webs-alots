-- =================================================================================
-- Migration 00090: Make register_new_clinic idempotent (Audit R-03)
--
-- The users INSERT can fail with a unique constraint violation on auth_id
-- if a user retries the registration flow (e.g. browser refresh, network
-- timeout retry). Adding ON CONFLICT (auth_id) DO UPDATE makes the
-- function idempotent — the second call updates the user profile to point
-- to the new clinic instead of raising a duplicate key error.
-- =================================================================================

CREATE OR REPLACE FUNCTION register_new_clinic(
  p_clinic_name TEXT,
  p_subdomain TEXT,
  p_phone TEXT,
  p_doctor_name TEXT,
  p_email TEXT,
  p_city TEXT,
  p_specialty TEXT,
  p_auth_id UUID
) RETURNS UUID AS $$
DECLARE
  v_clinic_id UUID;
BEGIN
  -- 1. Insert the clinic
  INSERT INTO clinics (
    name,
    type,
    tier,
    status,
    subdomain,
    phone,
    owner_name,
    owner_email,
    city,
    config
  ) VALUES (
    p_clinic_name,
    'doctor',
    'vitrine',
    'active',
    p_subdomain,
    p_phone,
    p_doctor_name,
    p_email,
    p_city,
    jsonb_build_object(
      'specialty', p_specialty,
      'city', p_city,
      'phone', p_phone,
      'email', p_email,
      'onboarding_completed', false
    )
  ) RETURNING id INTO v_clinic_id;

  -- 2. Insert the clinic_admin user profile (idempotent on retry)
  -- R-03: ON CONFLICT handles the case where a user retries registration
  -- after a partial failure or network timeout. The UPDATE rebinds the
  -- existing auth user to the newly created clinic.
  INSERT INTO users (
    auth_id,
    clinic_id,
    role,
    name,
    phone,
    email
  ) VALUES (
    p_auth_id,
    v_clinic_id,
    'clinic_admin',
    p_doctor_name,
    p_phone,
    p_email
  )
  ON CONFLICT (auth_id) DO UPDATE SET
    clinic_id = EXCLUDED.clinic_id,
    role = EXCLUDED.role,
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email;

  RETURN v_clinic_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public;
