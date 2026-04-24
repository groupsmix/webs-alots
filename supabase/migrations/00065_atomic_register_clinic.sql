-- =================================================================================
-- Migration 00065: Atomic Clinic Registration (Audit 5.6 Fix)
--
-- Replaces the manual, multi-step rollback in /api/v1/register-clinic/route.ts
-- with a single atomic PostgreSQL function. If the function fails at any point,
-- the entire transaction is automatically rolled back, preventing orphaned data.
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

  -- 2. Insert the clinic_admin user profile
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
  );

  RETURN v_clinic_id;
EXCEPTION
  WHEN OTHERS THEN
    -- If any step fails, PostgreSQL will automatically roll back the transaction.
    -- We re-raise the exception so the client knows it failed.
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
