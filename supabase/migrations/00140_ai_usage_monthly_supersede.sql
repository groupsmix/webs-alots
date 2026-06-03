-- Migration: Supersede ai_usage_monthly with billing_events-backed materialized view
-- Description:
--   00128_ai_usage_monthly_view.sql (#920) created a regular VIEW that aggregates
--   ai_cost_log in USD. This PR's budget-cap feature (F-Bill-10) writes ai_*
--   billing_events in MAD and reads them via a *materialized* view so cap checks
--   stay cheap on the hot path. Replace the old view in-place so both paths agree.
--
--   Safe to apply: no other migration references ai_usage_monthly, and the only
--   reader (src/lib/ai/config.ts::checkClinicAIBudget) selects total_cost_mad.

-- 1. Drop the existing regular view (created in 00128_ai_usage_monthly_view.sql)
DROP VIEW IF EXISTS ai_usage_monthly;

-- 2. Create the materialized view backed by billing_events (MAD denominated)
CREATE MATERIALIZED VIEW IF NOT EXISTS ai_usage_monthly AS
SELECT
  clinic_id,
  DATE_TRUNC('month', created_at) AS month,
  COUNT(*) AS request_count,
  SUM((metadata->>'prompt_tokens')::integer + (metadata->>'completion_tokens')::integer) AS total_tokens,
  SUM(amount) AS total_cost_mad
FROM billing_events
WHERE type LIKE 'ai_%'
GROUP BY clinic_id, DATE_TRUNC('month', created_at);

-- Unique index required for REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_usage_monthly_clinic_month
  ON ai_usage_monthly(clinic_id, month);

-- 3. Refresh function (called by pg_cron or app-side scheduler)
CREATE OR REPLACE FUNCTION refresh_ai_usage_monthly()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY ai_usage_monthly;
END;
$$;

-- Note: register a pg_cron job out-of-band, e.g.
--   SELECT cron.schedule('0 * * * *', $$SELECT refresh_ai_usage_monthly()$$);
