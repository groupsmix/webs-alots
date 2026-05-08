-- ============================================================
-- Migration 00039: Phase 1 Production Security Fixes
--
-- Closes live security holes identified in the production audit.
--
-- 1. DELETE seed users with well-known default passwords
-- 2. FIX public RLS leaks on: appointments, prescription_requests,
--    reviews, stock, before_after_photos, users (public doctors)
--
-- The public SELECT policies created in migration 00037 used
-- USING (true) which exposed ALL rows across ALL tenants to
-- anonymous visitors. This migration replaces them with
-- tenant-scoped policies using the app.current_clinic_id
-- session variable (set by middleware via set_tenant_context()).
-- ============================================================


-- ============================================================
-- PART 1: DELETE SEED USERS
--
-- Migration 00019 created seed users with a well-known default
-- password (see supabase/seed.sql). These MUST NOT exist in production.
-- Deleting from auth.users cascades to auth.identities.
-- Deleting from public.users removes the application profile.
-- ============================================================

-- The on_auth_user_created trigger fires AFTER INSERT only (see 00002),
-- so DELETE statements below do not fire it. Some environments (e.g. the
-- supabase CLI local stack) run migrations as a role that does not own
-- auth.users, so DISABLE TRIGGER would fail with SQLSTATE 42501. Wrap any
-- ownership-required DDL in a DO block that swallows that specific error.
DO $$
BEGIN
  EXECUTE 'ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping DISABLE TRIGGER on auth.users (insufficient privilege)';
END
$$;

-- Delete seed entries from auth.users (IDs start with a0000000-)
DELETE FROM auth.users WHERE id IN (
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000004',
  'a0000000-0000-0000-0000-000000000010',
  'a0000000-0000-0000-0000-000000000011',
  'a0000000-0000-0000-0000-000000000012',
  'a0000000-0000-0000-0000-000000000013',
  'a0000000-0000-0000-0000-000000000014'
);

-- Delete seed entries from auth.identities (in case CASCADE didn't fire)
DELETE FROM auth.identities WHERE user_id IN (
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000004',
  'a0000000-0000-0000-0000-000000000010',
  'a0000000-0000-0000-0000-000000000011',
  'a0000000-0000-0000-0000-000000000012',
  'a0000000-0000-0000-0000-000000000013',
  'a0000000-0000-0000-0000-000000000014'
);

-- Re-enable the trigger (mirror the DO block guard above)
DO $$
BEGIN
  EXECUTE 'ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping ENABLE TRIGGER on auth.users (insufficient privilege)';
END
$$;


-- ============================================================
-- PART 2: FIX PUBLIC RLS LEAKS
--
-- Replace the USING (true) policies from migration 00037 with
-- tenant-scoped policies. Anonymous access is scoped to the
-- clinic whose context was set by the middleware via
-- set_tenant_context() RPC (migration 00030).
--
-- Pattern: authenticated users see their own clinic's data,
-- anonymous users see data for app.current_clinic_id only.
-- ============================================================

-- -------------------------------------------------------
-- APPOINTMENTS: scope public reads to current tenant
-- -------------------------------------------------------
DROP POLICY IF EXISTS "appointments_select_public" ON appointments;
CREATE POLICY "appointments_select_public" ON appointments
  FOR SELECT USING (
    clinic_id = get_user_clinic_id()
    OR (
      auth.uid() IS NULL
      AND clinic_id = NULLIF(current_setting('app.current_clinic_id', true), '')::uuid
    )
  );

-- -------------------------------------------------------
-- PRESCRIPTION_REQUESTS: remove public read entirely
-- Patients should only see their own via authenticated policies.
-- There is no legitimate reason for anonymous access.
-- -------------------------------------------------------
DROP POLICY IF EXISTS "prescription_requests_select_public" ON prescription_requests;

-- -------------------------------------------------------
-- REVIEWS: scope public reads to current tenant
-- -------------------------------------------------------
DROP POLICY IF EXISTS "reviews_select_public" ON reviews;
CREATE POLICY "reviews_select_public" ON reviews
  FOR SELECT USING (
    clinic_id = get_user_clinic_id()
    OR (
      auth.uid() IS NULL
      AND clinic_id = NULLIF(current_setting('app.current_clinic_id', true), '')::uuid
    )
  );

-- -------------------------------------------------------
-- STOCK: remove public read entirely
-- Stock levels are internal data; the public pharmacy page
-- should use the products table (which has its own policy).
-- -------------------------------------------------------
DROP POLICY IF EXISTS "stock_select_public" ON stock;

-- -------------------------------------------------------
-- BEFORE_AFTER_PHOTOS: scope public reads to current tenant
-- -------------------------------------------------------
DROP POLICY IF EXISTS "before_after_photos_select_public" ON before_after_photos;
CREATE POLICY "before_after_photos_select_public" ON before_after_photos
  FOR SELECT USING (
    clinic_id = get_user_clinic_id()
    OR (
      auth.uid() IS NULL
      AND clinic_id = NULLIF(current_setting('app.current_clinic_id', true), '')::uuid
    )
  );

-- -------------------------------------------------------
-- USERS (public doctors): scope to current tenant
-- Only doctors are visible, and only within the current clinic.
-- -------------------------------------------------------
DROP POLICY IF EXISTS "users_select_public_doctors" ON users;
CREATE POLICY "users_select_public_doctors" ON users
  FOR SELECT USING (
    role = 'doctor'
    AND (
      clinic_id = get_user_clinic_id()
      OR (
        auth.uid() IS NULL
        AND clinic_id = NULLIF(current_setting('app.current_clinic_id', true), '')::uuid
      )
    )
  );

-- -------------------------------------------------------
-- PRODUCTS: scope public reads to current tenant
-- (Also added in 00037 with USING (true))
-- -------------------------------------------------------
DROP POLICY IF EXISTS "products_select_public" ON products;
CREATE POLICY "products_select_public" ON products
  FOR SELECT USING (
    clinic_id = get_user_clinic_id()
    OR (
      auth.uid() IS NULL
      AND clinic_id = NULLIF(current_setting('app.current_clinic_id', true), '')::uuid
    )
  );

-- -------------------------------------------------------
-- SERVICES: scope public reads to current tenant
-- (Also added in 00037 with USING (true))
-- -------------------------------------------------------
DROP POLICY IF EXISTS "services_select_public" ON services;
CREATE POLICY "services_select_public" ON services
  FOR SELECT USING (
    clinic_id = get_user_clinic_id()
    OR (
      auth.uid() IS NULL
      AND clinic_id = NULLIF(current_setting('app.current_clinic_id', true), '')::uuid
    )
  );

-- -------------------------------------------------------
-- TIME_SLOTS: scope public reads to current tenant
-- (Also added in 00037 with USING (true))
-- -------------------------------------------------------
DROP POLICY IF EXISTS "time_slots_select_public" ON time_slots;
CREATE POLICY "time_slots_select_public" ON time_slots
  FOR SELECT USING (
    clinic_id = get_user_clinic_id()
    OR (
      auth.uid() IS NULL
      AND clinic_id = NULLIF(current_setting('app.current_clinic_id', true), '')::uuid
    )
  );

-- -------------------------------------------------------
-- BLOG_POSTS: scope public reads to current tenant
-- (Also added in 00037 with USING (true), but already
-- fixed in 00031 — drop the 00037 version if it exists)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "blog_posts_select_public" ON blog_posts;

-- -------------------------------------------------------
-- ON_DUTY_SCHEDULE: scope public reads to current tenant
-- (Also added in 00037 with USING (true))
-- -------------------------------------------------------
DROP POLICY IF EXISTS "on_duty_schedule_select_public" ON on_duty_schedule;
CREATE POLICY "on_duty_schedule_select_public" ON on_duty_schedule
  FOR SELECT USING (
    clinic_id = get_user_clinic_id()
    OR (
      auth.uid() IS NULL
      AND clinic_id = NULLIF(current_setting('app.current_clinic_id', true), '')::uuid
    )
  );
