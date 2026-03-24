-- ============================================================
-- Migration 00030: Tenant Context Hardening
--
-- Adds a PostgreSQL function to set `app.current_clinic_id` as
-- a session variable from the application layer. This provides
-- defense-in-depth alongside existing RLS policies that use
-- `get_user_clinic_id()`.
--
-- The application calls this function via Supabase RPC after
-- creating a client, ensuring every connection has an explicit
-- tenant context that RLS can verify independently of the
-- authenticated user's profile.
-- ============================================================

-- 1. Create the set_tenant_context function
--    Called by the application layer to set the session variable
--    before any tenant-scoped database operations.
CREATE OR REPLACE FUNCTION set_tenant_context(p_clinic_id UUID)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_clinic_id', p_clinic_id::TEXT, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users and the anon role
-- (anon is used by cron jobs and webhooks that don't have a user session)
GRANT EXECUTE ON FUNCTION set_tenant_context(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION set_tenant_context(UUID) TO anon;

-- 2. Create a helper function to read the current tenant context
--    Returns NULL if no context has been set (safe default).
CREATE OR REPLACE FUNCTION get_tenant_context()
RETURNS UUID AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_clinic_id', true), '')::UUID;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_tenant_context() TO authenticated;
GRANT EXECUTE ON FUNCTION get_tenant_context() TO anon;
