-- ============================================================
-- Migration 00031: Fix unauthenticated cross-tenant RLS leaks
--
-- PROBLEM: Five RLS policies use `OR auth.uid() IS NULL` which
-- allows unauthenticated requests (using the public anon key)
-- to read ALL rows across ALL tenants. The intent was to allow
-- public website widgets (chatbot, blog, lab tests) to read
-- data for the current clinic, but the policies didn't scope
-- unauthenticated access to a specific clinic.
--
-- FIX: For unauthenticated access, require that the application
-- layer has set `app.current_clinic_id` via the
-- `set_tenant_context()` RPC (migration 00030). This ensures
-- unauthenticated reads are scoped to the specific clinic
-- whose context was established by the Next.js middleware.
--
-- Affected tables:
--   - chatbot_config
--   - chatbot_faqs
--   - collection_points
--   - lab_tests
--   - blog_posts
-- ============================================================

-- -------------------------------------------------------
-- chatbot_config: scope unauthenticated reads to current tenant
-- -------------------------------------------------------

DROP POLICY IF EXISTS "chatbot_config_select_clinic" ON chatbot_config;
CREATE POLICY "chatbot_config_select_clinic" ON chatbot_config
  FOR SELECT USING (
    clinic_id = get_user_clinic_id()
    OR (
      auth.uid() IS NULL
      AND clinic_id = NULLIF(current_setting('app.current_clinic_id', true), '')::uuid
    )
  );

-- -------------------------------------------------------
-- chatbot_faqs: scope unauthenticated reads to current tenant
-- -------------------------------------------------------

DROP POLICY IF EXISTS "chatbot_faqs_select_clinic" ON chatbot_faqs;
CREATE POLICY "chatbot_faqs_select_clinic" ON chatbot_faqs
  FOR SELECT USING (
    is_active = TRUE
    AND (
      clinic_id = get_user_clinic_id()
      OR (
        auth.uid() IS NULL
        AND clinic_id = NULLIF(current_setting('app.current_clinic_id', true), '')::uuid
      )
    )
  );

-- -------------------------------------------------------
-- collection_points: scope unauthenticated reads to current tenant
-- -------------------------------------------------------

DROP POLICY IF EXISTS "public_collection_points_read" ON collection_points;
CREATE POLICY "public_collection_points_read" ON collection_points
  FOR SELECT USING (
    clinic_id = get_user_clinic_id()
    OR (
      auth.uid() IS NULL
      AND clinic_id = NULLIF(current_setting('app.current_clinic_id', true), '')::uuid
    )
  );

-- -------------------------------------------------------
-- lab_tests: scope unauthenticated reads to current tenant
-- -------------------------------------------------------

DROP POLICY IF EXISTS "public_lab_tests_read" ON lab_tests;
CREATE POLICY "public_lab_tests_read" ON lab_tests
  FOR SELECT USING (
    is_active = TRUE
    AND (
      clinic_id = get_user_clinic_id()
      OR (
        auth.uid() IS NULL
        AND clinic_id = NULLIF(current_setting('app.current_clinic_id', true), '')::uuid
      )
    )
  );

-- -------------------------------------------------------
-- blog_posts: scope unauthenticated reads to current tenant
-- -------------------------------------------------------

DROP POLICY IF EXISTS "blog_posts_select_published" ON blog_posts;
CREATE POLICY "blog_posts_select_published" ON blog_posts
  FOR SELECT USING (
    is_published = TRUE
    AND (
      clinic_id = get_user_clinic_id()
      OR (
        auth.uid() IS NULL
        AND clinic_id = NULLIF(current_setting('app.current_clinic_id', true), '')::uuid
      )
    )
  );
