-- AI provider configuration for multi-model routing
-- API keys are encrypted at the application layer (AES-256-GCM) before storage
CREATE TABLE IF NOT EXISTS ai_provider_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL UNIQUE CHECK (provider IN (
    'workers_ai', 'anthropic', 'google', 'deepseek', 'groq',
    'openai', 'mistral', 'xai'
  )),
  display_name TEXT NOT NULL,
  api_key_encrypted TEXT,  -- NULL for workers_ai (uses CF binding)
  is_active BOOLEAN NOT NULL DEFAULT false,
  routing_tier INTEGER NOT NULL DEFAULT 1 CHECK (routing_tier BETWEEN 0 AND 3),
  -- 0 = free/edge (Workers AI), 1 = cheap/fast, 2 = mid, 3 = premium
  fallback_provider TEXT REFERENCES ai_provider_configs(provider),
  monthly_budget_cents INTEGER DEFAULT 5000,  -- $50 default
  requests_this_month INTEGER NOT NULL DEFAULT 0,
  tokens_this_month INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- AI usage tracking per request
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  task_type TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  cost_cents NUMERIC(10, 4) NOT NULL DEFAULT 0,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- AI feature toggles (which AI features are enabled)
CREATE TABLE IF NOT EXISTS ai_feature_toggles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  feature_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  min_tier INTEGER NOT NULL DEFAULT 0,  -- minimum routing tier needed
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE ai_provider_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_feature_toggles ENABLE ROW LEVEL SECURITY;

-- Only super admins can access AI config
DROP POLICY IF EXISTS "Super admins manage AI providers" ON ai_provider_configs;
CREATE POLICY "Super admins manage AI providers" ON ai_provider_configs FOR ALL USING (true);

DROP POLICY IF EXISTS "Super admins view AI usage" ON ai_usage_logs;
CREATE POLICY "Super admins view AI usage" ON ai_usage_logs FOR ALL USING (true);

DROP POLICY IF EXISTS "Super admins manage AI features" ON ai_feature_toggles;
CREATE POLICY "Super admins manage AI features" ON ai_feature_toggles FOR ALL USING (true);

-- Seed default providers
INSERT INTO ai_provider_configs (provider, display_name, routing_tier, is_active, api_key_encrypted) VALUES
  ('workers_ai', 'Cloudflare Workers AI', 0, true, NULL),
  ('groq', 'Groq (Fast Inference)', 1, false, NULL),
  ('deepseek', 'DeepSeek', 1, false, NULL),
  ('google', 'Google Gemini', 2, false, NULL),
  ('mistral', 'Mistral AI', 2, false, NULL),
  ('openai', 'OpenAI', 3, false, NULL),
  ('anthropic', 'Anthropic Claude', 3, false, NULL),
  ('xai', 'xAI Grok', 2, false, NULL)
ON CONFLICT (provider) DO NOTHING;

-- Seed default feature toggles
INSERT INTO ai_feature_toggles (feature_key, display_name, description, is_enabled, min_tier) VALUES
  ('dashboard_insights', 'Dashboard AI Insights', 'Auto-generated insights on the main dashboard', false, 1),
  ('usage_analysis', 'Usage Analysis', 'AI-powered clinic usage analysis', false, 1),
  ('support_categorize', 'Support Auto-Categorize', 'Auto-categorize incoming support tickets', false, 0),
  ('support_draft', 'Support Draft Responses', 'AI-drafted responses for support tickets', false, 1),
  ('churn_narrative', 'Churn Narratives', 'AI explanations of churn risk', false, 2),
  ('agent_builder', 'Agent Builder', 'Natural language agent configuration', false, 3),
  ('smart_recommendations', 'Smart Recommendations', 'AI-powered feature recommendations', false, 1)
ON CONFLICT (feature_key) DO NOTHING;

-- Index for usage aggregation
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at ON ai_usage_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_provider ON ai_usage_logs (provider);
