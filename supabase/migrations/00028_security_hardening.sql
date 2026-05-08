-- ============================================================
-- Migration 00028: Security Hardening
--
-- Fixes:
--   CRITICAL-01: Auth trigger allows arbitrary role assignment via raw_user_meta_data
--   CRITICAL-04: users_insert_auth_trigger RLS policy allows unrestricted insertion
--   HIGH-08:     clinics_select_active_public leaks all active clinics to any user
-- ============================================================

-- ============================================================
-- FIX CRITICAL-01: Harden auth trigger to prevent privilege escalation
--
-- The old trigger read role and clinic_id directly from raw_user_meta_data,
-- which is attacker-controlled (set via supabase.auth.signUp options.data).
-- An attacker could self-assign super_admin role and any clinic_id.
--
-- The new trigger:
--   1. Always defaults role to 'patient'
--   2. Only assigns clinic_id from raw_app_meta_data (server-controlled)
--      when the user was invited by an admin
--   3. Restricts invitation roles to receptionist, doctor, patient
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  v_clinic_id UUID;
  v_role TEXT := 'patient';  -- ALWAYS default to least-privileged role
BEGIN
  -- Only allow clinic_id and role assignment if it comes from an admin
  -- invitation flow. Invitations set signed claims in raw_app_meta_data
  -- (not user-controlled, unlike raw_user_meta_data).
  IF NEW.raw_app_meta_data ? 'invited_to_clinic' THEN
    v_clinic_id := (NEW.raw_app_meta_data->>'invited_to_clinic')::UUID;
    -- Invitation role can only be: receptionist, doctor, patient
    v_role := COALESCE(
      NULLIF(NEW.raw_app_meta_data->>'invited_role', ''),
      'patient'
    );
    -- Prevent invitation-based escalation to admin roles
    IF v_role NOT IN ('receptionist', 'doctor', 'patient') THEN
      v_role := 'patient';
    END IF;
  END IF;

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
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FIX CRITICAL-04: Restrict users INSERT policy
--
-- The old policy WITH CHECK (TRUE) allowed any authenticated user to
-- insert arbitrary rows into the users table with any role or clinic_id.
-- The new policy only allows:
--   1. The auth trigger (runs as service role, auth.uid() IS NULL)
--   2. A user inserting their own profile as a patient
-- ============================================================

DROP POLICY IF EXISTS "users_insert_auth_trigger" ON users;
CREATE POLICY "users_insert_self_only" ON users
  FOR INSERT WITH CHECK (
    -- Allow the auth trigger (runs as SECURITY DEFINER / service role)
    auth.uid() IS NULL
    -- Or the user inserting their own record as patient only
    OR (auth_id = auth.uid() AND role = 'patient')
  );

-- ============================================================
-- FIX HIGH-08: Restrict clinic visibility
--
-- The old policy allowed any authenticated user to SELECT all active
-- clinics, leaking clinic names, configurations, and sensitive data.
-- The new policy restricts visibility to:
--   1. The user's own clinic
--   2. Unauthenticated access (for public directory features)
--   3. Super admins (platform management)
-- ============================================================

DROP POLICY IF EXISTS "clinics_select_active_public" ON clinics;
CREATE POLICY "clinics_select_active_public" ON clinics
  FOR SELECT USING (
    status = 'active'
    AND (
      id = get_user_clinic_id()        -- Own clinic
      OR auth.uid() IS NULL            -- Unauthenticated (public directory)
      OR is_super_admin()              -- Platform admin
    )
  );
