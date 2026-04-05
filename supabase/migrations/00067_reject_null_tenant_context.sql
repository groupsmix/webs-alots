-- ============================================================
-- Migration 00067: Reject NULL tenant context in RLS policies
--
-- HIGH-02 FIX: Update RLS policies to explicitly reject requests
-- where the tenant context header is NULL or empty. This prevents
-- attackers from bypassing tenant isolation by sending requests
-- with no x-clinic-id header or an empty value.
--
-- The previous migration (00031) allowed NULL context for
-- unauthenticated access but required app.current_clinic_id to be
-- set. This migration adds an additional guard: if the request
-- header x-clinic-id is present but NULL/empty, reject immediately.
-- ============================================================

-- Helper function to validate tenant context from request header
CREATE OR REPLACE FUNCTION validate_tenant_context()
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  header_value text;
  clinic_uuid uuid;
BEGIN
  -- Read the x-clinic-id header set by the application layer
  header_value := current_setting('request.header.x-clinic-id', true);
  
  -- If header is present but empty/NULL, reject the request
  IF header_value IS NOT NULL AND header_value = '' THEN
    RAISE EXCEPTION 'Invalid tenant context: empty clinic_id header';
  END IF;
  
  -- If header is present, validate it's a proper UUID
  IF header_value IS NOT NULL THEN
    BEGIN
      clinic_uuid := header_value::uuid;
      RETURN clinic_uuid;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Invalid tenant context: malformed clinic_id UUID';
    END;
  END IF;
  
  -- No header present — return NULL (will be handled by RLS policies)
  RETURN NULL;
END;
$$;

-- Update chatbot_config policy to reject NULL context
DROP POLICY IF EXISTS "chatbot_config_select_clinic" ON chatbot_config;
CREATE POLICY "chatbot_config_select_clinic" ON chatbot_config
  FOR SELECT USING (
    clinic_id = get_user_clinic_id()
    OR (
      auth.uid() IS NULL
      AND clinic_id = COALESCE(
        validate_tenant_context(),
        NULLIF(current_setting('app.current_clinic_id', true), '')::uuid
      )
      AND clinic_id IS NOT NULL
    )
  );

-- Update chatbot_faqs policy to reject NULL context
DROP POLICY IF EXISTS "chatbot_faqs_select_clinic" ON chatbot_faqs;
CREATE POLICY "chatbot_faqs_select_clinic" ON chatbot_faqs
  FOR SELECT USING (
    is_active = TRUE
    AND (
      clinic_id = get_user_clinic_id()
      OR (
        auth.uid() IS NULL
        AND clinic_id = COALESCE(
          validate_tenant_context(),
          NULLIF(current_setting('app.current_clinic_id', true), '')::uuid
        )
        AND clinic_id IS NOT NULL
      )
    )
  );

-- Update collection_points policy to reject NULL context
DROP POLICY IF EXISTS "public_collection_points_read" ON collection_points;
CREATE POLICY "public_collection_points_read" ON collection_points
  FOR SELECT USING (
    clinic_id = get_user_clinic_id()
    OR (
      auth.uid() IS NULL
      AND clinic_id = COALESCE(
        validate_tenant_context(),
        NULLIF(current_setting('app.current_clinic_id', true), '')::uuid
      )
      AND clinic_id IS NOT NULL
    )
  );

-- Update lab_tests policy to reject NULL context
DROP POLICY IF EXISTS "public_lab_tests_read" ON lab_tests;
CREATE POLICY "public_lab_tests_read" ON lab_tests
  FOR SELECT USING (
    is_active = TRUE
    AND (
      clinic_id = get_user_clinic_id()
      OR (
        auth.uid() IS NULL
        AND clinic_id = COALESCE(
          validate_tenant_context(),
          NULLIF(current_setting('app.current_clinic_id', true), '')::uuid
        )
        AND clinic_id IS NOT NULL
      )
    )
  );

-- Update blog_posts policy to reject NULL context
DROP POLICY IF EXISTS "blog_posts_select_published" ON blog_posts;
CREATE POLICY "blog_posts_select_published" ON blog_posts
  FOR SELECT USING (
    is_published = TRUE
    AND (
      clinic_id = get_user_clinic_id()
      OR (
        auth.uid() IS NULL
        AND clinic_id = COALESCE(
          validate_tenant_context(),
          NULLIF(current_setting('app.current_clinic_id', true), '')::uuid
        )
        AND clinic_id IS NOT NULL
      )
    )
  );

-- Add comment for documentation
COMMENT ON FUNCTION validate_tenant_context() IS 
  'HIGH-02 FIX: Validates tenant context from request header and rejects NULL/empty values to prevent RLS bypass';
