-- ============================================================
-- GDPR / Loi 09-08 Compliance Tables
--
-- 1. consent_logs — audit trail for all consent events
-- 2. users.deletion_requested_at — soft-delete with 30-day grace
-- ============================================================

-- ── Add soft-delete column to users ──
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz DEFAULT NULL;

-- ── Consent log table ──
CREATE TABLE IF NOT EXISTS consent_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  consent_type text NOT NULL,
  granted boolean NOT NULL,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for querying consent history per user
CREATE INDEX IF NOT EXISTS idx_consent_logs_user_id ON consent_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_consent_logs_type ON consent_logs(consent_type);

-- RLS on consent_logs
ALTER TABLE consent_logs ENABLE ROW LEVEL SECURITY;

-- Users can read their own consent logs
CREATE POLICY consent_logs_select_own ON consent_logs
  FOR SELECT USING (
    user_id IN (
      SELECT id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Anyone can insert consent logs (cookie consent happens pre-login)
CREATE POLICY consent_logs_insert ON consent_logs
  FOR INSERT WITH CHECK (true);

-- Index for finding accounts pending deletion (used by purge cron)
CREATE INDEX IF NOT EXISTS idx_users_deletion_requested
  ON users(deletion_requested_at)
  WHERE deletion_requested_at IS NOT NULL;

-- ── Comment for documentation ──
COMMENT ON TABLE consent_logs IS 'GDPR/Loi 09-08 consent audit trail. Records all consent events with timestamps and IP addresses.';
COMMENT ON COLUMN users.deletion_requested_at IS 'GDPR right to erasure. When set, account will be permanently deleted after 30-day grace period.';
