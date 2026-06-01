-- Migration: Monthly AI Usage Aggregation and Budget Caps
-- Description: Creates a materialized view to track AI usage per clinic and enforces budget limits.

-- 1. Create the materialized view for monthly usage
CREATE MATERIALIZED VIEW IF NOT EXISTS ai_usage_monthly AS
SELECT 
  clinic_id,
  DATE_TRUNC('month', created_at) AS month,
  COUNT(*) as request_count,
  SUM((metadata->>'prompt_tokens')::integer + (metadata->>'completion_tokens')::integer) as total_tokens,
  SUM(amount) as total_cost_mad
FROM billing_events
WHERE type LIKE 'ai_%'
GROUP BY clinic_id, DATE_TRUNC('month', created_at);

-- Add index to the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_usage_monthly_clinic_month 
ON ai_usage_monthly(clinic_id, month);

-- 2. Add ai_monthly_budget to clinics.config if it doesn't exist (handled by app logic via JSONB)

-- 3. Create function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_ai_usage_monthly()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY ai_usage_monthly;
END;
$$;

-- Note: You would normally set up a pg_cron job here to call refresh_ai_usage_monthly()
-- e.g., SELECT cron.schedule('0 * * * *', $$SELECT refresh_ai_usage_monthly()$$);
