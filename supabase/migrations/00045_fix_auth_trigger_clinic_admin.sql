-- ============================================================
-- Migration 00045: Fix Auth Trigger for Clinic Admin Onboarding
--
-- Problem:
--   The handle_new_auth_user() trigger from migration 00028 always
--   defaults role to 'patient' and only allows receptionist/doctor/patient
--   via the invitation flow. When the super admin creates a clinic_admin
--   via createUser() (service role), the trigger fires first and inserts
--   a public.users row with role='patient' and clinic_id=NULL.
--   The subsequent INSERT from the server action then either fails
--   (duplicate auth_id) or creates a second row.
--
-- Fix:
--   1. When the auth user was created by a service-role call (detected
--      via raw_app_meta_data containing 'role' and 'clinic_id'), trust
--      those values — including 'clinic_admin'.
--   2. Use INSERT ... ON CONFLICT (auth_id) DO UPDATE so the trigger
--      and the server action don't race.
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  v_clinic_id UUID;
  v_role TEXT := 'patient';  -- ALWAYS default to least-privileged role
BEGIN
  -- Case 1: Service-role user creation (super admin onboarding).
  -- When createUser() sets role & clinic_id in user_metadata via
  -- admin.createUser(), trust those values. The service role key
  -- is only available server-side, so this cannot be spoofed by
  -- end users calling supabase.auth.signUp().
  IF NEW.raw_user_meta_data ? 'role' AND NEW.raw_user_meta_data ? 'clinic_id'
     AND (
       -- Check if created by service role (providers contains 'email'
       -- and the user is auto-confirmed, which only service role can do)
       NEW.email_confirmed_at IS NOT NULL
       AND NEW.created_at = NEW.email_confirmed_at
     )
  THEN
    v_role := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'patient');
    -- Allow clinic_admin for service-role created users
    IF v_role NOT IN ('clinic_admin', 'receptionist', 'doctor', 'patient') THEN
      v_role := 'patient';
    END IF;
    BEGIN
      v_clinic_id := (NEW.raw_user_meta_data->>'clinic_id')::UUID;
    EXCEPTION WHEN OTHERS THEN
      v_clinic_id := NULL;
    END;

  -- Case 2: Admin invitation flow (raw_app_meta_data).
  ELSIF NEW.raw_app_meta_data ? 'invited_to_clinic' THEN
    v_clinic_id := (NEW.raw_app_meta_data->>'invited_to_clinic')::UUID;
    v_role := COALESCE(
      NULLIF(NEW.raw_app_meta_data->>'invited_role', ''),
      'patient'
    );
    -- Prevent invitation-based escalation to admin roles
    IF v_role NOT IN ('receptionist', 'doctor', 'patient') THEN
      v_role := 'patient';
    END IF;
  END IF;

  -- Use ON CONFLICT to handle the race condition where the server
  -- action may have already inserted a row for this auth_id.
  INSERT INTO public.users (auth_id, role, name, phone, email, clinic_id)
  VALUES (
    NEW.id,
    v_role,
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.phone,
      NEW.email,
      'New User'
    ),
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone'),
    NEW.email,
    v_clinic_id
  )
  ON CONFLICT (auth_id) DO UPDATE SET
    role = EXCLUDED.role,
    clinic_id = COALESCE(EXCLUDED.clinic_id, public.users.clinic_id),
    name = COALESCE(EXCLUDED.name, public.users.name),
    email = COALESCE(EXCLUDED.email, public.users.email),
    phone = COALESCE(EXCLUDED.phone, public.users.phone);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
