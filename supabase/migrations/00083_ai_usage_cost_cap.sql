-- AI-002: Per-clinic AI token usage tracking for cost capping.
--
-- Tracks monthly token consumption per clinic so the application can
-- reject AI requests once a clinic exceeds its plan's token budget.
-- The unique constraint on (clinic_id, month) ensures one row per
-- clinic per month; the app uses UPSERT to increment counters.

CREATE TABLE IF NOT EXISTS ai_usage (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id   uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  month       date NOT NULL,  -- first day of the month (e.g., '2026-05-01')
  tokens_in   bigint NOT NULL DEFAULT 0,
  tokens_out  bigint NOT NULL DEFAULT 0,
  request_count integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_ai_usage_clinic_month UNIQUE (clinic_id, month)
);

-- RLS: tenant isolation — each clinic sees only its own usage
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_usage_tenant_isolation ON ai_usage
  USING (clinic_id = current_setting('app.clinic_id', true)::uuid);

-- Index for dashboard queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_clinic_month
  ON ai_usage(clinic_id, month DESC);

COMMENT ON TABLE ai_usage IS 'AI-002: Monthly AI token usage per clinic for cost capping';
