-- Migration: Make Audit Logs Immutable (WORM)
-- Description: Ensures that audit_logs cannot be updated or deleted by any role except postgres (system admin).

-- 1. Create the trigger function that raises an exception on UPDATE/DELETE
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable and cannot be modified or deleted.';
END;
$$ LANGUAGE plpgsql;

-- 2. Attach the trigger to the audit_logs table
DROP TRIGGER IF EXISTS trg_prevent_audit_log_mod ON audit_logs;
CREATE TRIGGER trg_prevent_audit_log_mod
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_modification();

-- 3. Revoke UPDATE and DELETE permissions from all roles (including service_role)
REVOKE UPDATE, DELETE ON audit_logs FROM authenticated, anon, service_role;

-- 4. Add index to optimize query performance for audit exports
CREATE INDEX IF NOT EXISTS idx_audit_logs_clinic_created_at 
ON audit_logs(clinic_id, created_at);

-- Add a comment explaining the immutable nature
COMMENT ON TABLE audit_logs IS 'Immutable audit logs. Triggers prevent updates and deletions to maintain WORM compliance.';
