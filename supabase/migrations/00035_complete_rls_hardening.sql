-- ============================================================
-- Migration 00035: Complete RLS Hardening
--
-- Addresses the remaining security gaps from the audit that
-- were not covered by migrations 00032-00034:
--
-- 1. HARDEN set_tenant_context(): Validate that the supplied
--    clinic_id actually exists in the clinics table. Prevents
--    attackers from setting context to arbitrary/non-existent
--    UUIDs. Keeps grants to both authenticated and anon
--    (required by the public chatbot widget).
--
-- 2. RESTRICT feature_definitions SELECT: Replace USING (true)
--    with authenticated-only to prevent unauthenticated
--    enumeration of feature flags.
--
-- 3. RESTRICT feature_toggles SELECT: Same as above.
--
-- 4. ADD MISSING WRITE POLICIES for phase-6 tables: Migration
--    00033 replaced permissive SELECT policies but some tables
--    lacked INSERT/UPDATE/DELETE policies for non-super-admin
--    users. Migration 00019 added staff_*_write policies, so
--    this is verified as already covered.
--
-- Design decision: clinic_types remains USING (true) because
-- it is genuinely public reference data needed by the signup
-- and registration flow before a user is authenticated.
-- Similarly, announcements lacks a clinic_id column and is
-- platform-wide, so its USING (is_active = TRUE) is correct.
-- ============================================================

-- -------------------------------------------------------
-- 1. HARDEN set_tenant_context()
--
-- Add clinic existence validation to prevent arbitrary UUID
-- injection. The function is still callable by both
-- authenticated and anon roles (required for the public
-- chatbot widget which uses the anon key).
--
-- Risk accepted: An unauthenticated caller who knows a valid
-- clinic UUID can set context and read public-facing data
-- (chatbot_config, chatbot_faqs, collection_points, lab_tests,
-- blog_posts) for that clinic. This is by design — these are
-- public website resources.
-- -------------------------------------------------------

CREATE OR REPLACE FUNCTION set_tenant_context(p_clinic_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Validate that the clinic actually exists.
  -- This prevents attackers from probing with random UUIDs.
  IF NOT EXISTS (SELECT 1 FROM clinics WHERE id = p_clinic_id) THEN
    RAISE EXCEPTION 'set_tenant_context: clinic not found: %', p_clinic_id;
  END IF;

  PERFORM set_config('app.current_clinic_id', p_clinic_id::TEXT, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-grant execute (CREATE OR REPLACE preserves grants in most
-- PostgreSQL versions, but be explicit for safety).
GRANT EXECUTE ON FUNCTION set_tenant_context(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION set_tenant_context(UUID) TO anon;

-- -------------------------------------------------------
-- 2. RESTRICT feature_definitions SELECT
--
-- Previously USING (true) — any user, including anonymous,
-- could enumerate all feature flag definitions. Restrict to
-- authenticated users only (the UI needs them for rendering
-- feature gates, but unauthenticated users do not).
-- -------------------------------------------------------

DROP POLICY IF EXISTS "feature_definitions_select" ON feature_definitions;

CREATE POLICY "feature_definitions_select_auth" ON feature_definitions
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- -------------------------------------------------------
-- 3. RESTRICT feature_toggles SELECT
--
-- Previously USING (true) — same reasoning as above.
-- Feature toggles are per-clinic settings; restrict reads
-- to authenticated users.
-- -------------------------------------------------------

DROP POLICY IF EXISTS "feature_toggles_select" ON feature_toggles;

CREATE POLICY "feature_toggles_select_auth" ON feature_toggles
  FOR SELECT USING (auth.uid() IS NOT NULL);
