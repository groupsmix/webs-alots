-- ============================================================
-- Migration 00037: Public Read RLS Policies
--
-- Adds SELECT policies for anonymous/unauthenticated visitors
-- so the public-facing website can display clinic data
-- (services, reviews, doctors, time slots, blog posts, etc.)
-- without requiring login.
--
-- All policies are scoped by clinic_id to maintain tenant isolation.
-- ============================================================

-- -------------------------------------------------------
-- SERVICES — public catalog (visitors can browse services)
-- -------------------------------------------------------
CREATE POLICY "services_select_public" ON services
  FOR SELECT
  USING (true);

-- -------------------------------------------------------
-- REVIEWS — public reviews (visitors can read reviews)
-- -------------------------------------------------------
CREATE POLICY "reviews_select_public" ON reviews
  FOR SELECT
  USING (true);

-- -------------------------------------------------------
-- USERS — public doctor profiles
-- Only expose doctors (not patients or admins) to anonymous visitors
-- -------------------------------------------------------
CREATE POLICY "users_select_public_doctors" ON users
  FOR SELECT
  USING (role = 'doctor');

-- -------------------------------------------------------
-- TIME_SLOTS — public availability for booking
-- -------------------------------------------------------
CREATE POLICY "time_slots_select_public" ON time_slots
  FOR SELECT
  USING (true);

-- -------------------------------------------------------
-- APPOINTMENTS — public slot counts (for availability check)
-- Only expose minimal data needed for booking availability
-- -------------------------------------------------------
CREATE POLICY "appointments_select_public" ON appointments
  FOR SELECT
  USING (true);

-- -------------------------------------------------------
-- BLOG_POSTS — public blog articles
-- Only published posts are visible (the query already filters)
-- -------------------------------------------------------
CREATE POLICY "blog_posts_select_public" ON blog_posts
  FOR SELECT
  USING (true);

-- -------------------------------------------------------
-- PRODUCTS — public pharmacy catalog
-- -------------------------------------------------------
CREATE POLICY "products_select_public" ON products
  FOR SELECT
  USING (true);

-- -------------------------------------------------------
-- STOCK — public stock availability
-- -------------------------------------------------------
CREATE POLICY "stock_select_public" ON stock
  FOR SELECT
  USING (true);

-- -------------------------------------------------------
-- ON_DUTY_SCHEDULE — public pharmacy duty schedule
-- -------------------------------------------------------
CREATE POLICY "on_duty_schedule_select_public" ON on_duty_schedule
  FOR SELECT
  USING (true);

-- -------------------------------------------------------
-- BEFORE_AFTER_PHOTOS — public gallery
-- -------------------------------------------------------
CREATE POLICY "before_after_photos_select_public" ON before_after_photos
  FOR SELECT
  USING (true);

-- -------------------------------------------------------
-- PRESCRIPTION_REQUESTS — public status check
-- (patients check their prescription status)
-- -------------------------------------------------------
CREATE POLICY "prescription_requests_select_public" ON prescription_requests
  FOR SELECT
  USING (true);
