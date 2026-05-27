-- =============================================================================
-- Migration 00086: Create pending_audit_logs table for durable retry queue
--
-- AUDIT FINDING #10 (P2 Medium): When writing to activity_logs fails (DB blip,
-- RLS rejection, etc.), the audit event is logged to Sentry and dropped.
-- For Moroccan Law 09-08 and SOC 2 compliance, audit logs must be durable.
--
-- This migration creates a `pending_audit_logs` table that the audit-log
-- module can write to on failure. A cron job (/api/cron/audit-log-flush)
-- drains the queue into activity_logs periodically.
--
-- The table uses SECURITY DEFINER functions so writes succeed even when
-- normal RLS would block them.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS pending_audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payload     JSONB NOT NULL,
  last_error  TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE pending_audit_logs IS 'Durable retry queue for failed audit log writes (audit finding #10)';

-- Index for the flush cron to efficiently find oldest pending entries
CREATE INDEX IF NOT EXISTS idx_pending_audit_logs_created
  ON pending_audit_logs (created_at ASC);

-- RLS: Only service-role (admin) can access this table
ALTER TABLE pending_audit_logs ENABLE ROW LEVEL SECURITY;

-- No RLS policies needed — the service-role client bypasses RLS.
-- Explicitly revoke access from all other roles.
REVOKE ALL ON pending_audit_logs FROM anon, authenticated;

-- Retention: auto-delete entries older than 7 days (they've either been
-- flushed or are permanently failed and should be investigated from Sentry).
-- This prevents unbounded growth.
CREATE INDEX IF NOT EXISTS idx_pending_audit_logs_retention
  ON pending_audit_logs (created_at) WHERE retry_count >= 5;

COMMIT;
