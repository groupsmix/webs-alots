-- AI infrastructure hardening — addresses audit findings from PR #844:
--   1. Atomic counters for monthly stats (race-condition fix)
--   2. Persistent rate-limit state (in-memory state lost in serverless)
--   3. Separate input/output token tracking (broken cost estimation)
--   4. Tighter RLS — restrict to super_admin role at DB level
--   5. Tracks last cost so admin UI can show real spend, not guessed

-- ── New columns on ai_provider_configs ──

ALTER TABLE ai_provider_configs
  ADD COLUMN IF NOT EXISTS input_tokens_this_month   BIGINT  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS output_tokens_this_month  BIGINT  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_this_month_cents     NUMERIC(12, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rate_limited_until        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stats_reset_at            TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', now());

-- Backfill: copy legacy tokens_this_month into output bucket (best effort)
UPDATE ai_provider_configs
  SET output_tokens_this_month = tokens_this_month
  WHERE output_tokens_this_month = 0 AND tokens_this_month > 0;

-- ── ai_usage_logs: track who called and from which feature ──

ALTER TABLE ai_usage_logs
  ADD COLUMN IF NOT EXISTS user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS feature_key TEXT;

CREATE INDEX IF NOT EXISTS idx_ai_usage_feature_key
  ON ai_usage_logs(feature_key) WHERE feature_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_usage_user_id
  ON ai_usage_logs(user_id) WHERE user_id IS NOT NULL;

-- ── Atomic usage increment RPC ──
-- Replaces the read-modify-write pattern in /api/ai/route.ts logUsage().
-- Also auto-resets monthly counters when crossing into a new month.

CREATE OR REPLACE FUNCTION increment_ai_usage(
  p_provider      TEXT,
  p_input_tokens  BIGINT,
  p_output_tokens BIGINT,
  p_cost_cents    NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Auto-reset monthly counters when crossing into a new month
  UPDATE ai_provider_configs
  SET
    requests_this_month       = 0,
    input_tokens_this_month   = 0,
    output_tokens_this_month  = 0,
    tokens_this_month         = 0,
    cost_this_month_cents     = 0,
    stats_reset_at            = date_trunc('month', now())
  WHERE provider = p_provider
    AND date_trunc('month', stats_reset_at) < date_trunc('month', now());

  -- Atomic increment in a single statement
  UPDATE ai_provider_configs
  SET
    requests_this_month       = requests_this_month + 1,
    input_tokens_this_month   = input_tokens_this_month + p_input_tokens,
    output_tokens_this_month  = output_tokens_this_month + p_output_tokens,
    tokens_this_month         = tokens_this_month + p_input_tokens + p_output_tokens,
    cost_this_month_cents     = cost_this_month_cents + p_cost_cents,
    last_used_at              = now(),
    updated_at                = now()
  WHERE provider = p_provider;
END;
$$;

COMMENT ON FUNCTION increment_ai_usage IS
  'Atomically increment per-provider usage counters. Safe under concurrent requests. Auto-resets at month boundary.';

-- ── Rate limit state RPC ──

CREATE OR REPLACE FUNCTION mark_provider_rate_limited(
  p_provider      TEXT,
  p_until         TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE ai_provider_configs
  SET rate_limited_until = p_until,
      updated_at         = now()
  WHERE provider = p_provider;
END;
$$;

COMMENT ON FUNCTION mark_provider_rate_limited IS
  'Persist rate-limit cooldown across serverless invocations.';

-- ── Tighter RLS ──
-- Original policies were USING (true) which only relies on the app layer.
-- Now check the role from the user JWT directly at the DB level (defense-in-depth).

DROP POLICY IF EXISTS "Super admins manage AI providers" ON ai_provider_configs;
CREATE POLICY "Super admins manage AI providers" ON ai_provider_configs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Super admins view AI usage" ON ai_usage_logs;
CREATE POLICY "Super admins view AI usage" ON ai_usage_logs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Super admins manage AI features" ON ai_feature_toggles;
CREATE POLICY "Super admins manage AI features" ON ai_feature_toggles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'super_admin'
    )
  );

-- ── Grants ──
-- The service role (used by createUntypedAdminClient) bypasses RLS, so it can
-- always call these functions. The anon/authenticated roles cannot.

REVOKE ALL ON FUNCTION increment_ai_usage(TEXT, BIGINT, BIGINT, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_ai_usage(TEXT, BIGINT, BIGINT, NUMERIC) TO service_role;

REVOKE ALL ON FUNCTION mark_provider_rate_limited(TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION mark_provider_rate_limited(TEXT, TIMESTAMPTZ) TO service_role;
