-- ============================================================
-- Migration 00042: Fix get_request_clinic_id() — read from
-- request.headers JSON instead of individual header GUCs
--
-- Supabase PostgREST exposes all HTTP request headers as a
-- single JSON object in the `request.headers` GUC variable,
-- NOT as individual `request.header.<name>` settings.
--
-- Migration 00041 assumed `current_setting('request.header.x-clinic-id', true)`
-- would return the header value, but this always returned NULL because
-- the individual header GUCs are not set in Supabase's PostgREST.
--
-- Fix: Parse the `request.headers` JSON to extract `x-clinic-id`.
-- Keeps the individual GUC lookup as a fallback for forward compatibility.
-- ============================================================

CREATE OR REPLACE FUNCTION get_request_clinic_id()
RETURNS UUID AS $$
DECLARE
  headers_json jsonb;
  header_val TEXT;
  session_val TEXT;
BEGIN
  -- 1. Try request.headers JSON (Supabase PostgREST exposes all headers here)
  BEGIN
    headers_json := current_setting('request.headers', true)::jsonb;
    IF headers_json IS NOT NULL THEN
      header_val := headers_json ->> 'x-clinic-id';
      IF header_val IS NOT NULL AND header_val <> '' THEN
        RETURN header_val::UUID;
      END IF;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;

  -- 2. Try the individual header GUC (legacy PostgREST behavior)
  header_val := current_setting('request.header.x-clinic-id', true);
  IF header_val IS NOT NULL AND header_val <> '' THEN
    RETURN header_val::UUID;
  END IF;

  -- 3. Fall back to the session variable (set by set_tenant_context RPC)
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
