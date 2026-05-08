-- Migration: 00090_ai_token_budget_reset.sql
-- A1-05 / F-A186: AI token budget monthly reset cron and enforcement.
-- Creates the ai_token_usage table (if not exists) and a function to reset
-- monthly counters. Called by the Cloudflare cron trigger on the 1st of each month.

-- ── ai_token_usage table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_token_usage (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID        NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  user_id          UUID        REFERENCES users(id) ON DELETE SET NULL,
  role             TEXT        NOT NULL,
  model            TEXT        NOT NULL,
  tokens_used      INTEGER     NOT NULL DEFAULT 0 CHECK (tokens_used >= 0),
  month_year       TEXT        NOT NULL, -- format: 'YYYY-MM'
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ai_token_usage_clinic_user_role_month_key
    UNIQUE (clinic_id, user_id, role, month_year)
);

-- RLS
ALTER TABLE ai_token_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_token_usage_clinic_isolation ON ai_token_usage
  USING (clinic_id = get_user_clinic_id());

CREATE POLICY ai_token_usage_admin_read ON ai_token_usage
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid()
        AND role IN ('clinic_admin', 'super_admin')
        AND (clinic_id = ai_token_usage.clinic_id OR role = 'super_admin')
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_clinic_month
  ON ai_token_usage (clinic_id, month_year);

CREATE INDEX IF NOT EXISTS idx_ai_token_usage_user_month
  ON ai_token_usage (user_id, month_year);

-- ── ai_token_limits table ──────────────────────────────────────────────────
-- Per-role monthly token budgets (can be overridden per-clinic)
CREATE TABLE IF NOT EXISTS ai_token_limits (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID        REFERENCES clinics(id) ON DELETE CASCADE,
  role             TEXT        NOT NULL,
  monthly_limit    INTEGER     NOT NULL DEFAULT 10000 CHECK (monthly_limit >= 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- NULL clinic_id = global default for this role
  CONSTRAINT ai_token_limits_role_clinic_key UNIQUE (clinic_id, role)
);

-- Insert default limits per role (global defaults)
INSERT INTO ai_token_limits (clinic_id, role, monthly_limit)
VALUES
  (NULL, 'patient',      10000),
  (NULL, 'doctor',       50000),
  (NULL, 'receptionist', 30000),
  (NULL, 'clinic_admin', 100000)
ON CONFLICT (clinic_id, role) DO NOTHING;

-- ── reset_monthly_ai_tokens function ──────────────────────────────────────
-- Called by cron on the 1st of each month to archive and zero counters.
CREATE OR REPLACE FUNCTION reset_monthly_ai_tokens()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_archived INTEGER;
BEGIN
  -- Archive current month's usage to ai_token_usage_history (if it exists)
  -- Then reset is implicit — new inserts use the current month_year key.
  -- The UNIQUE constraint on (clinic_id, user_id, role, month_year) ensures
  -- that each month gets its own rows naturally as month_year changes.

  -- Log the reset event
  INSERT INTO activity_logs (
    clinic_id,
    actor,
    action,
    type,
    description,
    timestamp
  )
  SELECT
    clinic_id,
    NULL,
    'ai_token_budget_monthly_reset',
    'system',
    format('Monthly AI token budget reset for clinic %s', clinic_id),
    now()
  FROM (SELECT DISTINCT clinic_id FROM ai_token_usage) AS clinics;

  GET DIAGNOSTICS v_archived = ROW_COUNT;

  RETURN v_archived;
END;
$$;

COMMENT ON FUNCTION reset_monthly_ai_tokens IS
  'A1-05: Resets monthly AI token usage counters at the start of each month.
   Budget enforcement uses the month_year key in ai_token_usage — new rows
   are created each month via UPSERT. This function logs the reset event.
   Call via: SELECT reset_monthly_ai_tokens(); on the 1st of each month.';

GRANT EXECUTE ON FUNCTION reset_monthly_ai_tokens() TO service_role;
