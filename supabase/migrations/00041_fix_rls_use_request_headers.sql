-- ============================================================
-- Migration 00041: Fix RLS policies — use request headers
--
-- The tenant-scoped RLS policies added in migration 00039 rely on
-- the PostgreSQL session variable `app.current_clinic_id` set via
-- the `set_tenant_context` RPC.  However, each Supabase PostgREST
-- API call (.rpc(), .from().select(), etc.) is a separate HTTP
-- request mapped to a separate database transaction.  Because
-- `set_config(..., true)` is transaction-local, the variable set
-- by the RPC is gone before the next query runs.
--
-- Fix: PostgREST exposes every HTTP request header as a
-- PostgreSQL runtime setting in the `request.header.*` namespace.
-- The application now sends `x-clinic-id: <uuid>` on every
-- request via the Supabase client's `global.headers` option.
-- RLS policies read this header with:
--
--   current_setting('request.header.x-clinic-id', true)
--
-- This is per-request (not per-transaction), so every query in
-- the same HTTP request sees the correct tenant context.
--
-- For backward compatibility the policies also fall back to
-- `app.current_clinic_id` (for SECURITY DEFINER functions that
-- set it within the same transaction).
--
-- Helper function: get_request_clinic_id() encapsulates the
-- lookup logic so individual policies stay readable.
-- ============================================================

-- ============================================================
-- HELPER: get_request_clinic_id()
--
-- Returns the clinic UUID from (in priority order):
--   1. The x-clinic-id request header (per-request, set by app)
--   2. The app.current_clinic_id session variable (per-txn fallback)
-- Returns NULL if neither is set.
-- ============================================================

CREATE OR REPLACE FUNCTION get_request_clinic_id()
RETURNS UUID AS $$
DECLARE
  header_val TEXT;
  session_val TEXT;
BEGIN
  -- 1. Try the request header (set by the Supabase client via global.headers)
  header_val := current_setting('request.header.x-clinic-id', true);
  IF header_val IS NOT NULL AND header_val <> '' THEN
    RETURN header_val::UUID;
  END IF;

  -- 2. Fall back to the session variable (set by set_tenant_context RPC)
  session_val := current_setting('app.current_clinic_id', true);
  IF session_val IS NOT NULL AND session_val <> '' THEN
    RETURN session_val::UUID;
  END IF;

  RETURN NULL;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_request_clinic_id() TO authenticated;
GRANT EXECUTE ON FUNCTION get_request_clinic_id() TO anon;


-- ============================================================
-- Update RLS policies to use get_request_clinic_id()
--
-- Pattern for anonymous access:
--   auth.uid() IS NULL AND clinic_id = get_request_clinic_id()
--
-- Authenticated users still use get_user_clinic_id() (unchanged).
-- ============================================================

-- -------------------------------------------------------
-- APPOINTMENTS
-- -------------------------------------------------------
DROP POLICY IF EXISTS "appointments_select_public" ON appointments;
CREATE POLICY "appointments_select_public" ON appointments
  FOR SELECT USING (
    clinic_id = get_user_clinic_id()
    OR (
      auth.uid() IS NULL
      AND clinic_id = get_request_clinic_id()
    )
  );

-- -------------------------------------------------------
-- REVIEWS
-- -------------------------------------------------------
DROP POLICY IF EXISTS "reviews_select_public" ON reviews;
CREATE POLICY "reviews_select_public" ON reviews
  FOR SELECT USING (
    clinic_id = get_user_clinic_id()
    OR (
      auth.uid() IS NULL
      AND clinic_id = get_request_clinic_id()
    )
  );

-- -------------------------------------------------------
-- BEFORE_AFTER_PHOTOS
-- -------------------------------------------------------
DROP POLICY IF EXISTS "before_after_photos_select_public" ON before_after_photos;
CREATE POLICY "before_after_photos_select_public" ON before_after_photos
  FOR SELECT USING (
    clinic_id = get_user_clinic_id()
    OR (
      auth.uid() IS NULL
      AND clinic_id = get_request_clinic_id()
    )
  );

-- -------------------------------------------------------
-- USERS (public doctors)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "users_select_public_doctors" ON users;
CREATE POLICY "users_select_public_doctors" ON users
  FOR SELECT USING (
    role = 'doctor'
    AND (
      clinic_id = get_user_clinic_id()
      OR (
        auth.uid() IS NULL
        AND clinic_id = get_request_clinic_id()
      )
    )
  );

-- -------------------------------------------------------
-- PRODUCTS
-- -------------------------------------------------------
DROP POLICY IF EXISTS "products_select_public" ON products;
CREATE POLICY "products_select_public" ON products
  FOR SELECT USING (
    clinic_id = get_user_clinic_id()
    OR (
      auth.uid() IS NULL
      AND clinic_id = get_request_clinic_id()
    )
  );

-- -------------------------------------------------------
-- SERVICES
-- -------------------------------------------------------
DROP POLICY IF EXISTS "services_select_public" ON services;
CREATE POLICY "services_select_public" ON services
  FOR SELECT USING (
    clinic_id = get_user_clinic_id()
    OR (
      auth.uid() IS NULL
      AND clinic_id = get_request_clinic_id()
    )
  );

-- -------------------------------------------------------
-- TIME_SLOTS
-- -------------------------------------------------------
DROP POLICY IF EXISTS "time_slots_select_public" ON time_slots;
CREATE POLICY "time_slots_select_public" ON time_slots
  FOR SELECT USING (
    clinic_id = get_user_clinic_id()
    OR (
      auth.uid() IS NULL
      AND clinic_id = get_request_clinic_id()
    )
  );

-- -------------------------------------------------------
-- ON_DUTY_SCHEDULE
-- -------------------------------------------------------
DROP POLICY IF EXISTS "on_duty_schedule_select_public" ON on_duty_schedule;
CREATE POLICY "on_duty_schedule_select_public" ON on_duty_schedule
  FOR SELECT USING (
    clinic_id = get_user_clinic_id()
    OR (
      auth.uid() IS NULL
      AND clinic_id = get_request_clinic_id()
    )
  );
