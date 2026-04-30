-- =============================================================================
-- Migration 00076: E-1 (STRIDE) — Prevent role escalation by non-super-admins
--
-- The CHECK constraint added in 00069 keeps users.role consistent with
-- users.clinic_id but does NOT prevent a clinic_admin (or anyone with a
-- live RLS-allowed UPDATE on users) from flipping role='patient' to
-- role='doctor' for a row already in their tenant. Privilege escalation
-- via direct SQL would slip past the application layer entirely.
--
-- This migration adds a BEFORE UPDATE trigger that blocks any role change
-- unless the executing role is `service_role` (admin client / migrations)
-- OR the authenticated caller is a super_admin in `public.users`.
-- Self-signup INSERTs are unaffected (the trigger only fires on UPDATE).
--
-- The trigger uses SECURITY DEFINER so the lookup against `public.users`
-- can run regardless of the caller's RLS policies — without elevating
-- the role-change itself, since the function only RAISEs or RETURNs NEW.
-- search_path is pinned per migration 00066 conventions.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_users_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
DECLARE
  v_caller_role TEXT;
  v_jwt_role TEXT;
BEGIN
  -- No-op when role is unchanged. Avoids unnecessary lookups on every
  -- UPDATE (e.g. profile edits that only touch name / phone).
  IF NEW.role IS NOT DISTINCT FROM OLD.role THEN
    RETURN NEW;
  END IF;

  -- Migrations and admin (service_role) clients are trusted: they bypass
  -- RLS and run as the database superuser.
  v_jwt_role := current_setting('request.jwt.claims', true)::jsonb ->> 'role';
  IF v_jwt_role = 'service_role' OR session_user = 'postgres' THEN
    RETURN NEW;
  END IF;

  -- For everyone else, require the caller to be a super_admin in
  -- public.users. auth.uid() returns the Supabase auth user UUID; we
  -- match it against users.auth_id (the FK to auth.users).
  SELECT role INTO v_caller_role
  FROM public.users
  WHERE auth_id = auth.uid()
  LIMIT 1;

  IF v_caller_role IS NULL OR v_caller_role <> 'super_admin' THEN
    RAISE EXCEPTION
      'E-1: role change from % to % is not permitted (caller role=%).',
      OLD.role, NEW.role, COALESCE(v_caller_role, '<unauthenticated>')
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$func$;

COMMENT ON FUNCTION public.enforce_users_role_change() IS
  'E-1 (STRIDE): rejects users.role UPDATEs unless the caller is service_role '
  'or a super_admin. Defense-in-depth alongside RLS and the '
  'users_role_clinic_id_valid CHECK from migration 00069.';

DROP TRIGGER IF EXISTS users_enforce_role_change ON public.users;

CREATE TRIGGER users_enforce_role_change
  BEFORE UPDATE OF role ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_users_role_change();

COMMENT ON TRIGGER users_enforce_role_change ON public.users IS
  'E-1 (STRIDE) — see enforce_users_role_change().';

COMMIT;
