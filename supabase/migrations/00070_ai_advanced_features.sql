-- AI Advanced Features Tables
-- Migration: 00070_ai_advanced_features.sql
-- Description: Learning system, campaigns, notifications, and analytics tables

-- ========================================
-- AI Learning Outcomes Table
-- ========================================
CREATE TABLE IF NOT EXISTS ai_learning_outcomes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  action_id UUID NOT NULL REFERENCES ai_actions(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  success BOOLEAN NOT NULL,
  revenue_impact INTEGER DEFAULT 0,
  time_saved INTEGER DEFAULT 0,
  customer_satisfaction DECIMAL(3,2),
  context JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT ai_learning_outcomes_business_id_fkey FOREIGN KEY (business_id) REFERENCES clinics(id) ON DELETE CASCADE,
  CONSTRAINT ai_learning_outcomes_action_id_fkey FOREIGN KEY (action_id) REFERENCES ai_actions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_learning_outcomes_business_id ON ai_learning_outcomes(business_id);
CREATE INDEX IF NOT EXISTS idx_ai_learning_outcomes_action_type ON ai_learning_outcomes(action_type);
CREATE INDEX IF NOT EXISTS idx_ai_learning_outcomes_created_at ON ai_learning_outcomes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_learning_outcomes_success ON ai_learning_outcomes(business_id, success);

-- RLS Policies
ALTER TABLE ai_learning_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_learning_outcomes_tenant_isolation ON ai_learning_outcomes
  FOR ALL
  USING (business_id = current_setting('request.jwt.claims', true)::json->>'clinic_id'::text::uuid);

-- ========================================
-- AI Learnings Table
-- ========================================
CREATE TABLE IF NOT EXISTS ai_learnings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  learning JSONB NOT NULL,
  evidence JSONB NOT NULL,
  impact JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT ai_learnings_business_id_fkey FOREIGN KEY (business_id) REFERENCES clinics(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_learnings_business_id ON ai_learnings(business_id);
CREATE INDEX IF NOT EXISTS idx_ai_learnings_created_at ON ai_learnings(created_at DESC);

-- RLS Policies
ALTER TABLE ai_learnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_learnings_tenant_isolation ON ai_learnings
  FOR ALL
  USING (business_id = current_setting('request.jwt.claims', true)::json->>'clinic_id'::text::uuid);

-- ========================================
-- AI Campaigns Table
-- ========================================
CREATE TABLE IF NOT EXISTS ai_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'reengagement',
    'upsell',
    'retention',
    'acquisition',
    'promotion',
    'ab_test'
  )),
  target JSONB NOT NULL,
  message JSONB,
  schedule JSONB NOT NULL,
  goals JSONB,
  variants JSONB,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',
    'scheduled',
    'running',
    'paused',
    'completed',
    'cancelled'
  )),
  results JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL,
  started_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  CONSTRAINT ai_campaigns_business_id_fkey FOREIGN KEY (business_id) REFERENCES clinics(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_campaigns_business_id ON ai_campaigns(business_id);
CREATE INDEX IF NOT EXISTS idx_ai_campaigns_status ON ai_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_ai_campaigns_type ON ai_campaigns(type);
CREATE INDEX IF NOT EXISTS idx_ai_campaigns_created_at ON ai_campaigns(created_at DESC);

-- RLS Policies
ALTER TABLE ai_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_campaigns_tenant_isolation ON ai_campaigns
  FOR ALL
  USING (business_id = current_setting('request.jwt.claims', true)::json->>'clinic_id'::text::uuid);

-- ========================================
-- Campaign Enrollments Table
-- ========================================
CREATE TABLE IF NOT EXISTS campaign_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES ai_campaigns(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  variant_id TEXT DEFAULT 'default',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active',
    'completed',
    'opted_out',
    'failed'
  )),
  current_step INTEGER DEFAULT 0,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  CONSTRAINT campaign_enrollments_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES ai_campaigns(id) ON DELETE CASCADE,
  CONSTRAINT campaign_enrollments_business_id_fkey FOREIGN KEY (business_id) REFERENCES clinics(id) ON DELETE CASCADE,
  CONSTRAINT campaign_enrollments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT campaign_enrollments_unique UNIQUE (campaign_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_enrollments_campaign_id ON campaign_enrollments(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_enrollments_business_id ON campaign_enrollments(business_id);
CREATE INDEX IF NOT EXISTS idx_campaign_enrollments_customer_id ON campaign_enrollments(customer_id);
CREATE INDEX IF NOT EXISTS idx_campaign_enrollments_status ON campaign_enrollments(status);

-- RLS Policies
ALTER TABLE campaign_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY campaign_enrollments_tenant_isolation ON campaign_enrollments
  FOR ALL
  USING (business_id = current_setting('request.jwt.claims', true)::json->>'clinic_id'::text::uuid);

-- ========================================
-- AI Notifications Table
-- ========================================
CREATE TABLE IF NOT EXISTS ai_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'action_approval',
    'daily_summary',
    'insight',
    'performance_alert',
    'anomaly'
  )),
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  
  CONSTRAINT ai_notifications_business_id_fkey FOREIGN KEY (business_id) REFERENCES clinics(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_notifications_business_id ON ai_notifications(business_id);
CREATE INDEX IF NOT EXISTS idx_ai_notifications_type ON ai_notifications(type);
CREATE INDEX IF NOT EXISTS idx_ai_notifications_priority ON ai_notifications(priority);
CREATE INDEX IF NOT EXISTS idx_ai_notifications_read ON ai_notifications(business_id, read) WHERE NOT read;
CREATE INDEX IF NOT EXISTS idx_ai_notifications_created_at ON ai_notifications(created_at DESC);

-- RLS Policies
ALTER TABLE ai_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_notifications_tenant_isolation ON ai_notifications
  FOR ALL
  USING (business_id = current_setting('request.jwt.claims', true)::json->>'clinic_id'::text::uuid);

-- ========================================
-- AI Analytics Cache Table (for performance)
-- ========================================
CREATE TABLE IF NOT EXISTS ai_analytics_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL,
  metric_data JSONB NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  
  CONSTRAINT ai_analytics_cache_business_id_fkey FOREIGN KEY (business_id) REFERENCES clinics(id) ON DELETE CASCADE,
  CONSTRAINT ai_analytics_cache_unique UNIQUE (business_id, metric_type)
);

CREATE INDEX IF NOT EXISTS idx_ai_analytics_cache_business_id ON ai_analytics_cache(business_id);
CREATE INDEX IF NOT EXISTS idx_ai_analytics_cache_expires_at ON ai_analytics_cache(expires_at);

-- RLS Policies
ALTER TABLE ai_analytics_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_analytics_cache_tenant_isolation ON ai_analytics_cache
  FOR ALL
  USING (business_id = current_setting('request.jwt.claims', true)::json->>'clinic_id'::text::uuid);

-- ========================================
-- Cleanup Function for Expired Cache
-- ========================================
CREATE OR REPLACE FUNCTION cleanup_expired_ai_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM ai_analytics_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- Comments for Documentation
-- ========================================
COMMENT ON TABLE ai_learning_outcomes IS 'Tracks outcomes of AI actions for learning and improvement';
COMMENT ON TABLE ai_learnings IS 'Stores patterns and insights learned by the AI system';
COMMENT ON TABLE ai_campaigns IS 'Marketing campaigns created and managed by AI';
COMMENT ON TABLE campaign_enrollments IS 'Tracks customer enrollment in campaigns';
COMMENT ON TABLE ai_notifications IS 'Notifications sent to admins about AI activity';
COMMENT ON TABLE ai_analytics_cache IS 'Cached analytics data for performance optimization';
