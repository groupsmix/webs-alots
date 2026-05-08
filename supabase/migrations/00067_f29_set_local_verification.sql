-- F-29: Verify set_tenant_context uses SET LOCAL (transaction-scoped).
--
-- The existing set_tenant_context function already uses:
--   set_config('app.current_clinic_id', p_clinic_id::TEXT, true)
-- The third parameter `true` = is_local, meaning the setting is
-- automatically reset at end of transaction. This is correct for
-- pgBouncer/Supavisor in transaction pooling mode.
--
-- This migration re-creates the function to add explicit documentation
-- and the search_path hardening from F-15.

CREATE OR REPLACE FUNCTION set_tenant_context(p_clinic_id UUID)
RETURNS VOID AS $$
BEGIN
  -- F-29: The `true` parameter makes this SET LOCAL (transaction-scoped).
  -- This prevents GUC leakage across pooled connections in pgBouncer/Supavisor.
  PERFORM set_config('app.current_clinic_id', p_clinic_id::TEXT, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public, pg_temp;

-- Re-grant permissions
GRANT EXECUTE ON FUNCTION set_tenant_context(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION set_tenant_context(UUID) TO anon;
