-- A62-G1: AI Cost Tracking Table
-- Tracks cost of each AI API request for budget monitoring and clinic billing.

CREATE TABLE IF NOT EXISTS ai_cost_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL,
  route VARCHAR(256) NOT NULL, -- /api/v1/ai/patient-summary
  model VARCHAR(50) NOT NULL, -- gpt-4, gpt-3.5-turbo, claude-3-sonnet, etc.
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0, -- in USD, e.g., 0.015432
  duration_ms INT, -- request latency for performance tracking
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT fk_clinic FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE
);

-- Index for per-clinic cost queries (monthly billing, budget alerts)
CREATE INDEX idx_ai_cost_clinic_date 
  ON ai_cost_log(clinic_id, created_at DESC);

-- Index for cost analysis by route
CREATE INDEX idx_ai_cost_route_date 
  ON ai_cost_log(route, created_at DESC);

-- Index for recent cost queries (avoiding full table scans on getAICostLast30Days)
CREATE INDEX idx_ai_cost_recent 
  ON ai_cost_log(created_at DESC) 
  WHERE created_at > NOW() - INTERVAL '90 days';

-- Enable RLS: clinics can only read their own cost data
ALTER TABLE ai_cost_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_cost_log_clinic_read ON ai_cost_log
  FOR SELECT
  USING (clinic_id = current_setting('app.current_clinic_id')::uuid);

-- Service role (cron, migrations) can insert cost logs
CREATE POLICY ai_cost_log_insert ON ai_cost_log
  FOR INSERT
  WITH CHECK (true); -- Service role bypass

-- Comments for documentation
COMMENT ON TABLE ai_cost_log IS 'A62-G1: AI API cost tracking for budget monitoring and clinic billing.';
COMMENT ON COLUMN ai_cost_log.estimated_cost_usd IS 'Estimated cost in USD = (input_tokens * model.input_price) + (output_tokens * model.output_price).';
