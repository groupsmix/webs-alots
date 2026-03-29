-- ============================================================
-- Enhanced Audit Logging for Healthcare Compliance
--
-- Adds IP address, user agent, and structured metadata columns
-- to the activity_logs table for security-sensitive event tracking.
--
-- Required by: GDPR/Loi 09-08, healthcare audit trail requirements
-- ============================================================

-- ── Add new columns to activity_logs ──
ALTER TABLE activity_logs
  ADD COLUMN IF NOT EXISTS ip_address text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS user_agent text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT NULL;

-- Index for querying audit events by type (auth, security, etc.)
CREATE INDEX IF NOT EXISTS idx_activity_logs_type ON activity_logs(type);

-- Index for querying audit events by actor
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor ON activity_logs(actor)
  WHERE actor IS NOT NULL;

-- Index for querying audit events by timestamp range
CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs(timestamp DESC)
  WHERE timestamp IS NOT NULL;

-- ── Comments for documentation ──
COMMENT ON COLUMN activity_logs.ip_address IS 'Client IP address for auth/security events (from cf-connecting-ip header)';
COMMENT ON COLUMN activity_logs.user_agent IS 'Client user agent string for auth/security events';
COMMENT ON COLUMN activity_logs.metadata IS 'Structured metadata as JSONB for rich audit trail queries';
