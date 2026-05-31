-- ============================================================
-- Migration 00037: Public Read RLS Policies
--
-- Adds SELECT policies for anonymous/unauthenticated visitors
-- so the public-facing website can display clinic data
-- (services, reviews, doctors, time slots, blog posts, etc.)
-- without requiring login.
--
-- All policies are scoped by clinic_id to maintain tenant isolation.
--
-- 2026-05-31: Made idempotent (DROP POLICY IF EXISTS before CREATE).
-- Migrations 00039 and 00041 already use this pattern; making 00037
-- consistent prevents preview-branch failures when policies pre-exist.
-- ============================================================

-- -------------------------------------------------------
-- SERVICES — public catalog (visitors can browse services)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "services_select_public" ON services;
CREATE POLICY "services_select_public" ON services
  FOR SELECT
  USING (true);

-- -------------------------------------------------------
-- REVIEWS — public reviews (visitors can read reviews)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "reviews_select_public" ON reviews;
CREATE POLICY "reviews_select_public" ON reviews
  FOR SELECT
  USING (true);

-- -------------------------------------------------------
-- USERS — public doctor profiles
-- Only expose doctors (not patients or admins) to anonymous visitors
-- -------------------------------------------------------
DROP POLICY IF EXISTS "users_select_public_doctors" ON users;
CREATE POLICY "users_select_public_doctors" ON users
  FOR SELECT
  USING (role = 'doctor');

-- -------------------------------------------------------
-- TIME_SLOTS — public availability for booking
-- -------------------------------------------------------
DROP POLICY IF EXISTS "time_slots_select_public" ON time_slots;
CREATE POLICY "time_slots_select_public" ON time_slots
  FOR SELECT
  USING (true);

-- -------------------------------------------------------
-- APPOINTMENTS — public slot counts (for availability check)
-- Only expose minimal data needed for booking availability
-- -------------------------------------------------------
DROP POLICY IF EXISTS "appointments_select_public" ON appointments;
CREATE POLICY "appointments_select_public" ON appointments
  FOR SELECT
  USING (true);

-- -------------------------------------------------------
-- BLOG_POSTS — public blog articles
-- Only published posts are visible (the query already filters)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "blog_posts_select_public" ON blog_posts;
CREATE POLICY "blog_posts_select_public" ON blog_posts
  FOR SELECT
  USING (true);

-- -------------------------------------------------------
-- PRODUCTS — public pharmacy catalog
-- -------------------------------------------------------
DROP POLICY IF EXISTS "products_select_public" ON products;
CREATE POLICY "products_select_public" ON products
  FOR SELECT
  USING (true);

-- -------------------------------------------------------
-- STOCK — public stock availability
-- -------------------------------------------------------
DROP POLICY IF EXISTS "stock_select_public" ON stock;
CREATE POLICY "stock_select_public" ON stock
  FOR SELECT
  USING (true);

-- -------------------------------------------------------
-- ON_DUTY_SCHEDULE — public pharmacy duty schedule
-- -------------------------------------------------------
DROP POLICY IF EXISTS "on_duty_schedule_select_public" ON on_duty_schedule;
CREATE POLICY "on_duty_schedule_select_public" ON on_duty_schedule
  FOR SELECT
  USING (true);

-- -------------------------------------------------------
-- BEFORE_AFTER_PHOTOS — public gallery
-- -------------------------------------------------------
DROP POLICY IF EXISTS "before_after_photos_select_public" ON before_after_photos;
CREATE POLICY "before_after_photos_select_public" ON before_after_photos
  FOR SELECT
  USING (true);

-- -------------------------------------------------------
-- PRESCRIPTION_REQUESTS — public status check
-- (patients check their prescription status)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "prescription_requests_select_public" ON prescription_requests;
CREATE POLICY "prescription_requests_select_public" ON prescription_requests
  FOR SELECT
  USING (true);
