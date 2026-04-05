-- AI Revenue Agent Tables
-- Migration: 00069_ai_revenue_agent.sql
-- Description: Create tables for AI Revenue Agent functionality

-- ========================================
-- AI Decisions Table
-- ========================================
CREATE TABLE IF NOT EXISTS ai_decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  decision TEXT NOT NULL,
  reasoning TEXT NOT NULL,
  confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  alternatives JSONB DEFAULT '[]'::jsonb,
  expected_impact JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Indexes
  CONSTRAINT ai_decisions_business_id_fkey FOREIGN KEY (business_id) REFERENCES clinics(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_decisions_business_id ON ai_decisions(business_id);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_created_at ON ai_decisions(created_at DESC);

-- RLS Policies
ALTER TABLE ai_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_decisions_tenant_isolation ON ai_decisions
  FOR ALL
  USING (business_id = current_setting('request.jwt.claims', true)::json->>'clinic_id'::text::uuid);

-- ========================================
-- AI Actions Table
-- ========================================
CREATE TABLE IF NOT EXISTS ai_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'send_message',
    'create_appointment',
    'update_appointment',
    'cancel_appointment',
    'reschedule_appointment',
    'adjust_pricing',
    'create_promotion',
    'send_review_request',
    'create_upsell_offer',
    'update_availability',
    'generate_report',
    'analyze_data',
    'predict_no_show',
    'identify_opportunity'
  )),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'approved',
    'executing',
    'completed',
    'failed',
    'rolled_back'
  )),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  action JSONB NOT NULL,
  reasoning TEXT NOT NULL,
  expected_outcome JSONB DEFAULT '{}'::jsonb,
  actual_outcome JSONB,
  rollback_plan JSONB,
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL DEFAULT 'ai_agent',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Constraints
  CONSTRAINT ai_actions_business_id_fkey FOREIGN KEY (business_id) REFERENCES clinics(id) ON DELETE CASCADE,
  CONSTRAINT ai_actions_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_actions_business_id ON ai_actions(business_id);
CREATE INDEX IF NOT EXISTS idx_ai_actions_status ON ai_actions(status);
CREATE INDEX IF NOT EXISTS idx_ai_actions_type ON ai_actions(type);
CREATE INDEX IF NOT EXISTS idx_ai_actions_risk_level ON ai_actions(risk_level);
CREATE INDEX IF NOT EXISTS idx_ai_actions_created_at ON ai_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_actions_pending_approval ON ai_actions(business_id, status) WHERE status = 'pending';

-- RLS Policies
ALTER TABLE ai_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_actions_tenant_isolation ON ai_actions
  FOR ALL
  USING (business_id = current_setting('request.jwt.claims', true)::json->>'clinic_id'::text::uuid);

-- ========================================
-- AI Insights Table
-- ========================================
CREATE TABLE IF NOT EXISTS ai_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'opportunity',
    'risk',
    'trend',
    'anomaly',
    'recommendation'
  )),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  impact TEXT NOT NULL CHECK (impact IN ('low', 'medium', 'high', 'critical')),
  revenue_impact INTEGER, -- in cents
  recommendations TEXT[] DEFAULT ARRAY[]::TEXT[],
  data JSONB DEFAULT '{}'::jsonb,
  acted_upon BOOLEAN NOT NULL DEFAULT false,
  action_taken TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT ai_insights_business_id_fkey FOREIGN KEY (business_id) REFERENCES clinics(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_business_id ON ai_insights(business_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_type ON ai_insights(type);
CREATE INDEX IF NOT EXISTS idx_ai_insights_impact ON ai_insights(impact);
CREATE INDEX IF NOT EXISTS idx_ai_insights_created_at ON ai_insights(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_insights_acted_upon ON ai_insights(business_id, acted_upon) WHERE NOT acted_upon;

-- RLS Policies
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_insights_tenant_isolation ON ai_insights
  FOR ALL
  USING (business_id = current_setting('request.jwt.claims', true)::json->>'clinic_id'::text::uuid);

-- ========================================
-- AI Message Log Table
-- ========================================
CREATE TABLE IF NOT EXISTS ai_message_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_id UUID REFERENCES ai_actions(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'sms', 'email')),
  message TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'delivered', 'failed', 'read')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  error_message TEXT,
  
  -- Constraints
  CONSTRAINT ai_message_log_action_id_fkey FOREIGN KEY (action_id) REFERENCES ai_actions(id) ON DELETE CASCADE,
  CONSTRAINT ai_message_log_business_id_fkey FOREIGN KEY (business_id) REFERENCES clinics(id) ON DELETE CASCADE,
  CONSTRAINT ai_message_log_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_message_log_business_id ON ai_message_log(business_id);
CREATE INDEX IF NOT EXISTS idx_ai_message_log_action_id ON ai_message_log(action_id);
CREATE INDEX IF NOT EXISTS idx_ai_message_log_customer_id ON ai_message_log(customer_id);
CREATE INDEX IF NOT EXISTS idx_ai_message_log_sent_at ON ai_message_log(sent_at DESC);

-- RLS Policies
ALTER TABLE ai_message_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_message_log_tenant_isolation ON ai_message_log
  FOR ALL
  USING (business_id = current_setting('request.jwt.claims', true)::json->>'clinic_id'::text::uuid);

-- ========================================
-- Add AI Config to Clinics Table
-- ========================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'clinics' AND column_name = 'ai_config'
  ) THEN
    ALTER TABLE clinics ADD COLUMN ai_config JSONB DEFAULT NULL;
  END IF;
END $$;

-- ========================================
-- Update Timestamp Trigger
-- ========================================
CREATE OR REPLACE FUNCTION update_ai_actions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_ai_actions_updated_at ON ai_actions;
CREATE TRIGGER trigger_update_ai_actions_updated_at
  BEFORE UPDATE ON ai_actions
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_actions_updated_at();

-- ========================================
-- Comments for Documentation
-- ========================================
COMMENT ON TABLE ai_decisions IS 'AI-generated business decisions and strategies';
COMMENT ON TABLE ai_actions IS 'Actions taken by the AI Revenue Agent';
COMMENT ON TABLE ai_insights IS 'Business insights and recommendations from AI analysis';
COMMENT ON TABLE ai_message_log IS 'Log of messages sent by AI to customers';
COMMENT ON COLUMN clinics.ai_config IS 'AI Revenue Agent configuration (autonomy, capabilities, goals)';
