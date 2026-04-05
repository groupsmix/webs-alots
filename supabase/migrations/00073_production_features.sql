-- Migration: Production Features
-- Adds tables for scheduler, idempotency, webhooks, and feature flags

-- ========== Scheduled Actions ==========

CREATE TABLE IF NOT EXISTS ai_scheduled_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL REFERENCES ai_actions(id) ON DELETE CASCADE,
  business_id UUID NOT NULL,
  execute_at TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Africa/Casablanca',
  status TEXT NOT NULL CHECK (status IN ('pending', 'executed', 'cancelled', 'failed')),
  executed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_actions_business ON ai_scheduled_actions(business_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_actions_execute_at ON ai_scheduled_actions(execute_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_scheduled_actions_status ON ai_scheduled_actions(status);

-- RLS for scheduled actions
ALTER TABLE ai_scheduled_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY scheduled_actions_tenant_isolation ON ai_scheduled_actions
  USING (business_id::text = current_setting('request.jwt.claims', true)::json->>'clinic_id');

-- ========== Idempotency Keys ==========

CREATE TABLE IF NOT EXISTS ai_idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  business_id UUID NOT NULL,
  action_id UUID NOT NULL REFERENCES ai_actions(id) ON DELETE CASCADE,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE(business_id, key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_business_key ON ai_idempotency_keys(business_id, key);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at ON ai_idempotency_keys(expires_at);

-- RLS for idempotency keys
ALTER TABLE ai_idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY idempotency_keys_tenant_isolation ON ai_idempotency_keys
  USING (business_id::text = current_setting('request.jwt.claims', true)::json->>'clinic_id');

-- ========== Webhook Subscriptions ==========

CREATE TABLE IF NOT EXISTS ai_webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL,
  secret TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_business ON ai_webhook_subscriptions(business_id);
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_enabled ON ai_webhook_subscriptions(enabled) WHERE enabled = true;

-- RLS for webhook subscriptions
ALTER TABLE ai_webhook_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY webhook_subscriptions_tenant_isolation ON ai_webhook_subscriptions
  USING (business_id::text = current_setting('request.jwt.claims', true)::json->>'clinic_id');

-- ========== Webhook Logs ==========

CREATE TABLE IF NOT EXISTS ai_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES ai_webhook_subscriptions(id) ON DELETE CASCADE,
  business_id UUID NOT NULL,
  event TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_subscription ON ai_webhook_logs(subscription_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_business ON ai_webhook_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON ai_webhook_logs(created_at);

-- RLS for webhook logs
ALTER TABLE ai_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY webhook_logs_tenant_isolation ON ai_webhook_logs
  USING (business_id::text = current_setting('request.jwt.claims', true)::json->>'clinic_id');

-- ========== Feature Flags ==========

CREATE TABLE IF NOT EXISTS ai_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  rollout_percentage INTEGER NOT NULL DEFAULT 100 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  enabled_for_businesses UUID[],
  disabled_for_businesses UUID[],
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_name ON ai_feature_flags(name);
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON ai_feature_flags(enabled);

-- Feature flags are global, no RLS needed

-- ========== Add disabled_reason to config ==========

ALTER TABLE ai_agent_config 
ADD COLUMN IF NOT EXISTS disabled_reason TEXT;

-- ========== Add rate_limits to config ==========

ALTER TABLE ai_agent_config 
ADD COLUMN IF NOT EXISTS rate_limits JSONB DEFAULT '{
  "max_actions_per_hour": 100,
  "max_actions_per_day": 500,
  "max_messages_per_customer_per_day": 3,
  "max_whatsapp_per_hour": 50,
  "max_sms_per_hour": 100,
  "max_email_per_hour": 200
}'::jsonb;

-- ========== Cleanup Functions ==========

-- Function to cleanup expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM ai_idempotency_keys
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old scheduled actions
CREATE OR REPLACE FUNCTION cleanup_old_scheduled_actions(days_old INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM ai_scheduled_actions
  WHERE status IN ('executed', 'cancelled', 'failed')
  AND created_at < NOW() - (days_old || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ========== Insert Default Feature Flags ==========

INSERT INTO ai_feature_flags (name, enabled, rollout_percentage, description)
VALUES 
  ('auto-pricing', true, 100, 'Automatic pricing adjustments'),
  ('auto-promotions', true, 100, 'Automatic promotion creation'),
  ('auto-messaging', true, 100, 'Automatic customer messaging'),
  ('auto-booking', true, 50, 'Automatic appointment booking (gradual rollout)'),
  ('ab-testing', true, 100, 'A/B testing for campaigns')
ON CONFLICT (name) DO NOTHING;

-- ========== Comments ==========

COMMENT ON TABLE ai_scheduled_actions IS 'Scheduled AI actions for later execution';
COMMENT ON TABLE ai_idempotency_keys IS 'Idempotency keys to prevent duplicate action execution';
COMMENT ON TABLE ai_webhook_subscriptions IS 'Webhook subscriptions for external integrations';
COMMENT ON TABLE ai_webhook_logs IS 'Webhook delivery logs';
COMMENT ON TABLE ai_feature_flags IS 'Feature flags for gradual rollout';
