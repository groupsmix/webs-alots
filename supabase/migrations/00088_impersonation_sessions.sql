-- =============================================================================
-- Migration 00085: Create impersonation_sessions table
--
-- AUDIT FINDING #6 (P2 Medium): The impersonation reason is currently stored
-- only in an httpOnly cookie. This prevents:
--   - Server-side session invalidation (can't kill compromised sessions)
--   - Audit queries ("who is currently impersonating clinic X?")
--   - Concurrent session limits
--
-- This migration creates a server-side impersonation_sessions table.
-- The cookie will store only the session UUID; the reason, expiry, and
-- lifecycle are managed server-side.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS impersonation_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     UUID NOT NULL,
  clinic_id    UUID NOT NULL,
  reason       TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  ended_at     TIMESTAMPTZ,
  ended_reason TEXT
);

COMMENT ON TABLE impersonation_sessions IS 'Server-side tracking of super_admin impersonation sessions (audit finding #6)';

CREATE INDEX IF NOT EXISTS idx_impersonation_active
  ON impersonation_sessions (actor_id, ended_at) WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_impersonation_clinic
  ON impersonation_sessions (clinic_id, ended_at) WHERE ended_at IS NULL;

-- RLS: Only super_admins can read/write impersonation sessions
ALTER TABLE impersonation_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'sa_impersonation_all' AND tablename = 'impersonation_sessions'
  ) THEN
    CREATE POLICY "sa_impersonation_all" ON impersonation_sessions FOR ALL
      USING (is_super_admin())
      WITH CHECK (is_super_admin());
  END IF;
END $$;

REVOKE ALL ON impersonation_sessions FROM anon, authenticated;
GRANT ALL ON impersonation_sessions TO authenticated;

COMMIT;
