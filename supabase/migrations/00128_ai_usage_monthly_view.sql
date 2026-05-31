-- F-AI-10: Per-clinic monthly AI token usage view.
-- Used by AI routes to enforce clinic-level monthly caps (110% of plan limit).
-- References existing ai_cost_log table (migration 00127).

CREATE OR REPLACE VIEW ai_usage_monthly AS
SELECT
  clinic_id,
  SUM(input_tokens + output_tokens) AS total_tokens,
  SUM(estimated_cost_usd) AS total_cost_usd,
  COUNT(*) AS request_count,
  DATE_TRUNC('month', created_at) AS month
FROM ai_cost_log
GROUP BY clinic_id, DATE_TRUNC('month', created_at);

COMMENT ON VIEW ai_usage_monthly IS 'F-AI-10: Monthly AI usage aggregation per clinic for budget cap enforcement.';
