-- ============================================================
-- Migration 00069: Harden handle_new_auth_user trigger and
--                  register_new_clinic RPC (S-03)
--
-- Problem (audits A2: §4.4, A5: #8):
--   `raw_user_meta_data` is set client-side via supabase.auth.signUp's
--   `options.data` field, so any value there is fully attacker-controlled.
--   Migrations 00028 and 00045 still read role / clinic_id / is_super_admin
--   out of `raw_user_meta_data` for the "service-role created user"
--   heuristic in handle_new_auth_user(). The heuristic
--   (email_confirmed_at IS NOT NULL AND created_at = email_confirmed_at)
--   is unreliable and the audit recommends never trusting that JSON
--   blob for privileged claims at all.
--
-- Fix:
--   1. handle_new_auth_user() ignores role / clinic_id / is_super_admin in
--      raw_user_meta_data entirely. Self-signup paths always default to
--      role='patient' with clinic_id=NULL. Privileged role + clinic
--      assignment may only come from `raw_app_meta_data.invited_to_clinic`
--      / `raw_app_meta_data.invited_role` (set server-side by GoTrue
--      during admin invitation flows), and only `receptionist | doctor |
--      patient` are accepted there — never `clinic_admin` or `super_admin`.
--   2. The trigger upserts with `ON CONFLICT (auth_id) DO NOTHING` so a
--      privileged service-role insert (e.g. register_new_clinic,
--      super-admin admin-create) running before/after the trigger is
--      never downgraded to 'patient'.
--   3. Re-affirm the UNIQUE constraint on `public.users.auth_id`. It
--      already exists since 00001, but enforcing it explicitly here makes
--      the assumption load-bearing and self-documenting.
--   4. register_new_clinic() now uses `INSERT … ON CONFLICT (auth_id) DO
--      UPDATE` so that the privileged service-role row created by the
--      RPC always wins over whatever 'patient' row the trigger left.
-- ============================================================

-- ---------- 1. UNIQUE (auth_id) on public.users (idempotent) ----------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'users'
      AND c.contype = 'u'
      AND (
        SELECT array_agg(a.attname ORDER BY a.attname)
        FROM unnest(c.conkey) k
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k
      ) = ARRAY['auth_id']
  ) THEN
    BEGIN
      ALTER TABLE public.users
        ADD CONSTRAINT users_auth_id_key UNIQUE (auth_id);
    EXCEPTION
      -- A unique index named users_auth_id_key (or equivalent) may already
      -- back the column without a matching pg_constraint row. Tolerate it.
      WHEN duplicate_table THEN NULL;
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- ---------- 2. Hardened auth trigger ----------
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  v_clinic_id UUID;
  v_role TEXT := 'patient';  -- ALWAYS default to least-privileged role
BEGIN
  -- Privileged role + clinic claims may ONLY come from raw_app_meta_data,
  -- which is set server-side by GoTrue during admin invitation flows and
  -- is NOT writeable from supabase.auth.signUp(). raw_user_meta_data is
  -- attacker-controlled, so any role / clinic_id / is_super_admin keys
  -- present there are ignored entirely.
  IF NEW.raw_app_meta_data ? 'invited_to_clinic' THEN
    BEGIN
      v_clinic_id := (NEW.raw_app_meta_data->>'invited_to_clinic')::UUID;
    EXCEPTION WHEN OTHERS THEN
      v_clinic_id := NULL;
    END;
    v_role := COALESCE(
      NULLIF(NEW.raw_app_meta_data->>'invited_role', ''),
      'patient'
    );
    -- Invitation cannot escalate to clinic_admin or super_admin. Those
    -- privileged roles are created exclusively via service-role inserts
    -- (e.g. register_new_clinic, super-admin onboarding endpoints) which
    -- bypass the trigger via the ON CONFLICT (auth_id) DO NOTHING below.
    IF v_role NOT IN ('receptionist', 'doctor', 'patient') THEN
      v_role := 'patient';
    END IF;
  END IF;

  -- ON CONFLICT (auth_id) DO NOTHING: a privileged service-role insert
  -- may have already created the public.users row (e.g. register_new_clinic
  -- ran INSERT … ON CONFLICT DO UPDATE before the trigger committed, or
  -- a follow-up RPC will overwrite this row). In either case the trigger
  -- must never downgrade the privileged row to 'patient' / NULL clinic.
  INSERT INTO public.users (auth_id, role, name, phone, email, clinic_id)
  VALUES (
    NEW.id,
    v_role,
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      NEW.phone,
      NEW.email,
      'New User'
    ),
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone'),
    NEW.email,
    v_clinic_id
  )
  ON CONFLICT (auth_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ---------- 3. register_new_clinic upserts on auth_id ----------
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

  -- 2. Upsert the clinic_admin user profile.
  --    handle_new_auth_user() may have already inserted a row with
  --    role='patient' and clinic_id=NULL; this UPSERT promotes it
  --    atomically to the correct privileged values.
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
    role      = EXCLUDED.role,
    name      = COALESCE(EXCLUDED.name, public.users.name),
    phone     = COALESCE(EXCLUDED.phone, public.users.phone),
    email     = COALESCE(EXCLUDED.email, public.users.email);

  RETURN v_clinic_id;
EXCEPTION
  WHEN OTHERS THEN
    -- If any step fails, PostgreSQL will automatically roll back the transaction.
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
