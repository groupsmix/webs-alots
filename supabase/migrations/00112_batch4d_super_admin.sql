-- Migration: 00112_batch4d_super_admin.sql
-- Batch 4D: Super Admin features — clinic onboarding provisioning, churn prediction, revenue forecasting

-- ============================================================
-- 1. Clinic onboarding provisioning tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS clinic_onboarding_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  step_key TEXT NOT NULL,
  step_label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'skipped')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(clinic_id, step_key)
);

ALTER TABLE clinic_onboarding_steps ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'clinic_onboarding_steps' AND policyname = 'clinic_onboarding_steps_rls'
  ) THEN
    CREATE POLICY clinic_onboarding_steps_rls ON clinic_onboarding_steps
      FOR ALL
      USING (clinic_id = current_setting('app.clinic_id', true)::uuid)
      WITH CHECK (clinic_id = current_setting('app.clinic_id', true)::uuid);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_clinic_onboarding_steps_clinic_id ON clinic_onboarding_steps(clinic_id);

-- WhatsApp number assignment tracking
CREATE TABLE IF NOT EXISTS clinic_whatsapp_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  waba_id TEXT,
  phone_number_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'released')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at TIMESTAMPTZ,
  UNIQUE(clinic_id)
);

ALTER TABLE clinic_whatsapp_numbers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'clinic_whatsapp_numbers' AND policyname = 'clinic_whatsapp_numbers_rls'
  ) THEN
    CREATE POLICY clinic_whatsapp_numbers_rls ON clinic_whatsapp_numbers
      FOR ALL
      USING (clinic_id = current_setting('app.clinic_id', true)::uuid)
      WITH CHECK (clinic_id = current_setting('app.clinic_id', true)::uuid);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_clinic_whatsapp_numbers_clinic_id ON clinic_whatsapp_numbers(clinic_id);

-- Payment gateway configuration per clinic
CREATE TABLE IF NOT EXISTS clinic_payment_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  gateway TEXT NOT NULL CHECK (gateway IN ('cmi', 'stripe', 'cash')),
  is_active BOOLEAN NOT NULL DEFAULT false,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(clinic_id, gateway)
);

ALTER TABLE clinic_payment_configs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'clinic_payment_configs' AND policyname = 'clinic_payment_configs_rls'
  ) THEN
    CREATE POLICY clinic_payment_configs_rls ON clinic_payment_configs
      FOR ALL
      USING (clinic_id = current_setting('app.clinic_id', true)::uuid)
      WITH CHECK (clinic_id = current_setting('app.clinic_id', true)::uuid);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_clinic_payment_configs_clinic_id ON clinic_payment_configs(clinic_id);

-- ============================================================
-- 2. Churn prediction
-- ============================================================

CREATE TABLE IF NOT EXISTS clinic_churn_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  score NUMERIC(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  factors JSONB NOT NULL DEFAULT '[]'::jsonb,
  login_frequency_30d INTEGER DEFAULT 0,
  appointment_volume_30d INTEGER DEFAULT 0,
  appointment_volume_prev_30d INTEGER DEFAULT 0,
  support_tickets_30d INTEGER DEFAULT 0,
  days_since_last_login INTEGER,
  revenue_30d NUMERIC(12,2) DEFAULT 0,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE clinic_churn_scores ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'clinic_churn_scores' AND policyname = 'clinic_churn_scores_rls'
  ) THEN
    CREATE POLICY clinic_churn_scores_rls ON clinic_churn_scores
      FOR ALL
      USING (clinic_id = current_setting('app.clinic_id', true)::uuid)
      WITH CHECK (clinic_id = current_setting('app.clinic_id', true)::uuid);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_clinic_churn_scores_clinic_id ON clinic_churn_scores(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_churn_scores_calculated_at ON clinic_churn_scores(calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_clinic_churn_scores_risk_level ON clinic_churn_scores(risk_level);

-- ============================================================
-- 3. Revenue forecasting
-- ============================================================

CREATE TABLE IF NOT EXISTS revenue_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month TEXT NOT NULL,
  mrr NUMERIC(12,2) NOT NULL DEFAULT 0,
  arr NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_clinics INTEGER NOT NULL DEFAULT 0,
  paid_clinics INTEGER NOT NULL DEFAULT 0,
  churned_clinics INTEGER NOT NULL DEFAULT 0,
  new_clinics INTEGER NOT NULL DEFAULT 0,
  expansion_revenue NUMERIC(12,2) DEFAULT 0,
  contraction_revenue NUMERIC(12,2) DEFAULT 0,
  plan_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(month)
);

ALTER TABLE revenue_snapshots ENABLE ROW LEVEL SECURITY;

-- Revenue snapshots are platform-wide (no clinic_id) — only super_admin via service role
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'revenue_snapshots' AND policyname = 'revenue_snapshots_super_admin'
  ) THEN
    CREATE POLICY revenue_snapshots_super_admin ON revenue_snapshots
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_revenue_snapshots_month ON revenue_snapshots(month DESC);

CREATE TABLE IF NOT EXISTS revenue_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_month TEXT NOT NULL,
  predicted_mrr NUMERIC(12,2) NOT NULL,
  predicted_arr NUMERIC(14,2) NOT NULL,
  confidence_low NUMERIC(12,2),
  confidence_high NUMERIC(12,2),
  assumptions JSONB DEFAULT '{}'::jsonb,
  model_version TEXT DEFAULT 'v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(forecast_month, model_version)
);

ALTER TABLE revenue_forecasts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'revenue_forecasts' AND policyname = 'revenue_forecasts_super_admin'
  ) THEN
    CREATE POLICY revenue_forecasts_super_admin ON revenue_forecasts
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_revenue_forecasts_month ON revenue_forecasts(forecast_month DESC);
