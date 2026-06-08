-- Migration 00167: subscription_history, trial columns, usage_snapshots
-- Adds full audit trail of plan changes, trial lifecycle columns on clinics,
-- and daily usage snapshot table for the usage-alerts cron job.

-- subscription_history: full audit trail of every plan change
CREATE TABLE IF NOT EXISTS subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'trial_started','trial_extended','trial_expired','plan_upgraded',
    'plan_downgraded','plan_cancelled','plan_reactivated','payment_succeeded',
    'payment_failed','billing_cycle_renewed'
  )),
  from_plan_slug TEXT,
  to_plan_slug TEXT NOT NULL,
  billing_period TEXT CHECK (billing_period IN ('monthly','yearly')),
  amount_centimes INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'MAD',
  notes TEXT,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_history_clinic
  ON subscription_history(clinic_id, created_at DESC);

ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "sub_history_clinic_access" ON subscription_history FOR SELECT
    USING (clinic_id = get_request_clinic_id() AND auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add trial lifecycle columns to clinics table
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- usage_snapshots: daily aggregate per clinic
CREATE TABLE IF NOT EXISTS usage_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  appointments_count INTEGER NOT NULL DEFAULT 0,
  whatsapp_sent INTEGER NOT NULL DEFAULT 0,
  ai_calls INTEGER NOT NULL DEFAULT 0,
  storage_bytes BIGINT NOT NULL DEFAULT 0,
  active_doctors INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(clinic_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_usage_snapshots_clinic
  ON usage_snapshots(clinic_id, snapshot_date DESC);

ALTER TABLE usage_snapshots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "usage_snapshots_clinic_select" ON usage_snapshots FOR SELECT
    USING (clinic_id = get_request_clinic_id() AND auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
