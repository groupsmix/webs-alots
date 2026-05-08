-- Migration: 00086_worm_audit_r2_sink.sql
-- F-A188: WORM (Write-Once, Read-Many) audit log sync to R2.
--
-- Problem: The `activity_logs` table in Postgres is mutable — a
-- super_admin with direct DB access can UPDATE or DELETE audit rows.
-- Moroccan Law 09-08, Ar. 24 and healthcare audit standards require
-- that audit records be immutable and tamper-evident.
--
-- Solution:
--   1. Add a Postgres trigger that writes a copy of every activity_logs
--      insert to a dedicated `audit_archive_queue` table.
--   2. A cron job (see src/lib/cron/audit-archive.ts) drains this queue
--      to Cloudflare R2 with object lock enabled (WORM).
--   3. The R2 bucket retains objects for 7 years (see docs/r2-lifecycle.md).
--   4. Make activity_logs rows immutable after insert via trigger.
--
-- NOTE: Deleting or updating activity_logs rows is now BLOCKED for all
-- roles (including super_admin at the DB level). The only way to retract
-- an erroneous audit entry is to insert a correction row.

-- ── 1. Archive queue table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_archive_queue (
  id           BIGSERIAL PRIMARY KEY,
  source_id    UUID         NOT NULL,  -- activity_logs.id
  clinic_id    UUID         NOT NULL,
  action       TEXT         NOT NULL,
  payload      JSONB        NOT NULL,  -- full row as JSONB
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  archived_at  TIMESTAMPTZ  NULL,      -- set when written to R2
  r2_key       TEXT         NULL       -- R2 object key after archiving
);

CREATE INDEX IF NOT EXISTS idx_audit_archive_queue_unarchived
  ON audit_archive_queue (created_at)
  WHERE archived_at IS NULL;

ALTER TABLE audit_archive_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_archive_queue_service_role_only" ON audit_archive_queue;
CREATE POLICY "audit_archive_queue_service_role_only"
  ON audit_archive_queue
  FOR ALL
  USING (
    current_setting('request.jwt.claim.role', true) = 'service_role'
  );

-- ── 2. Trigger: queue every activity_logs insert for archiving ────────
CREATE OR REPLACE FUNCTION _queue_audit_for_archive()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_archive_queue (source_id, clinic_id, action, payload)
  VALUES (
    NEW.id,
    NEW.clinic_id,
    NEW.action,
    row_to_json(NEW)::JSONB
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_logs_archive ON activity_logs;
CREATE TRIGGER trg_activity_logs_archive
  AFTER INSERT ON activity_logs
  FOR EACH ROW EXECUTE FUNCTION _queue_audit_for_archive();

-- ── 3. Make activity_logs immutable (no UPDATE/DELETE) ────────────────
-- Block UPDATE and DELETE on activity_logs for all roles except a
-- dedicated migration/recovery role (service_role).
-- Note: This uses a trigger rather than GRANT/REVOKE so it applies
-- even to the postgres superuser and direct psql connections.
CREATE OR REPLACE FUNCTION _block_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION
    'activity_logs is immutable. Insert a correction row instead of %ing.',
    TG_OP
  USING ERRCODE = '55000'; -- object_not_in_prerequisite_state
  RETURN NULL;
END;
$$;

-- Only apply if not already present (idempotent)
DROP TRIGGER IF EXISTS trg_activity_logs_immutable_update ON activity_logs;
CREATE TRIGGER trg_activity_logs_immutable_update
  BEFORE UPDATE ON activity_logs
  FOR EACH ROW EXECUTE FUNCTION _block_audit_mutation();

DROP TRIGGER IF EXISTS trg_activity_logs_immutable_delete ON activity_logs;
CREATE TRIGGER trg_activity_logs_immutable_delete
  BEFORE DELETE ON activity_logs
  FOR EACH ROW EXECUTE FUNCTION _block_audit_mutation();

-- ── 4. Grants ─────────────────────────────────────────────────────────
GRANT SELECT ON audit_archive_queue TO service_role;
GRANT INSERT, UPDATE ON audit_archive_queue TO service_role;
GRANT USAGE, SELECT ON SEQUENCE audit_archive_queue_id_seq TO service_role;

-- Explicit deny on mutating activity_logs (belt-and-suspenders)
-- The triggers above enforce this at the row level; REVOKE at the
-- privilege level adds a second layer.
REVOKE UPDATE, DELETE ON activity_logs FROM authenticated;
REVOKE UPDATE, DELETE ON activity_logs FROM anon;
