-- Per-tenant resource usage tracking for quota enforcement and billing.
-- Each row records one metered event (WhatsApp send, R2 upload, AI request, etc.)

CREATE TABLE IF NOT EXISTS tenant_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL,
  resource_type VARCHAR(32) NOT NULL, -- 'whatsapp', 'r2_storage', 'ai_tokens', 'sms'
  unit_count NUMERIC(14, 4) NOT NULL DEFAULT 1, -- messages, bytes, tokens, etc.
  cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0, -- estimated cost in USD
  metadata JSONB, -- optional context (route, model, file_key, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_tenant_usage_clinic FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE
);

-- Per-clinic monthly roll-up queries
CREATE INDEX idx_tenant_usage_clinic_date
  ON tenant_usage_log(clinic_id, created_at DESC);

-- Per-resource-type aggregation
CREATE INDEX idx_tenant_usage_type_date
  ON tenant_usage_log(resource_type, created_at DESC);

-- Composite for "how much of resource X did clinic Y use this month"
CREATE INDEX idx_tenant_usage_clinic_type
  ON tenant_usage_log(clinic_id, resource_type, created_at DESC);

-- RLS: clinics can read their own usage data
ALTER TABLE tenant_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_usage_log_clinic_read ON tenant_usage_log
  FOR SELECT
  USING (clinic_id = current_setting('app.current_clinic_id')::uuid);

-- Service role can insert usage events
CREATE POLICY tenant_usage_log_insert ON tenant_usage_log
  FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE tenant_usage_log IS 'Per-tenant resource usage tracking for quota enforcement and billing.';
COMMENT ON COLUMN tenant_usage_log.resource_type IS 'Resource category: whatsapp, r2_storage, ai_tokens, sms';
COMMENT ON COLUMN tenant_usage_log.unit_count IS 'Usage units: message count, bytes, token count, etc.';
COMMENT ON COLUMN tenant_usage_log.cost_usd IS 'Estimated cost in USD for this usage event.';
