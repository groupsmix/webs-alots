-- Migration: 00077_security_audit_a126_a170.sql
-- Security audit remediation for findings A126-A170
--
-- A154: login_events table for suspicious-login detection
-- A155: chargebacks table for chargeback tracking/reconciliation
-- A160: sanctions_screenings table for sanctions screening audit trail

-- ============================================================
-- A154: Login events for suspicious-login detection
-- ============================================================

CREATE TABLE IF NOT EXISTS login_events (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL,
  ip_address    TEXT NOT NULL DEFAULT 'unknown',
  ua_fingerprint TEXT,
  clinic_id     UUID REFERENCES clinics(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE login_events IS 'A154: Tracks login events for suspicious-login detection. New IP+UA combos trigger email alerts.';

-- Index for efficient lookups by user + recency
CREATE INDEX IF NOT EXISTS idx_login_events_user_created
  ON login_events (user_id, created_at DESC);

-- Index for tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_login_events_clinic_id
  ON login_events (clinic_id) WHERE clinic_id IS NOT NULL;

-- Auto-purge old login events (keep 90 days)
-- This can be done via a cron job calling DELETE WHERE created_at < now() - interval '90 days'

-- RLS for login_events
ALTER TABLE login_events ENABLE ROW LEVEL SECURITY;

-- Only service role can insert/read login events (no direct user access)
CREATE POLICY login_events_service_only ON login_events
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ============================================================
-- A155: Chargebacks table for dispute tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS chargebacks (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id         UUID NOT NULL REFERENCES clinics(id),
  payment_id        UUID NOT NULL REFERENCES payments(id),
  gateway           TEXT NOT NULL CHECK (gateway IN ('cmi', 'stripe')),
  gateway_dispute_id TEXT,
  amount            NUMERIC(12,2) NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'MAD',
  reason_code       TEXT,
  reason_text       TEXT,
  status            TEXT NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open', 'under_review', 'won', 'lost', 'accepted')),
  evidence_due_by   TIMESTAMPTZ,
  opened_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE chargebacks IS 'A155: Tracks payment chargebacks/disputes for reconciliation. Links to payments table.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chargebacks_clinic_id ON chargebacks (clinic_id);
CREATE INDEX IF NOT EXISTS idx_chargebacks_payment_id ON chargebacks (payment_id);
CREATE INDEX IF NOT EXISTS idx_chargebacks_status ON chargebacks (status) WHERE status IN ('open', 'under_review');

-- RLS for chargebacks
ALTER TABLE chargebacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY chargebacks_tenant_isolation ON chargebacks
  FOR ALL
  USING (
    clinic_id::text = coalesce(
      current_setting('app.clinic_id', true),
      (current_setting('request.headers', true)::json->>'x-clinic-id')
    )
  )
  WITH CHECK (
    clinic_id::text = coalesce(
      current_setting('app.clinic_id', true),
      (current_setting('request.headers', true)::json->>'x-clinic-id')
    )
  );

-- ============================================================
-- A160: Sanctions screenings audit trail
-- ============================================================

CREATE TABLE IF NOT EXISTS sanctions_screenings (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  screening_id    TEXT NOT NULL UNIQUE,
  reference_id    TEXT NOT NULL,
  entity_type     TEXT NOT NULL CHECK (entity_type IN ('individual', 'organization')),
  entity_name     TEXT NOT NULL,
  country         TEXT,
  context         TEXT NOT NULL CHECK (context IN ('clinic_onboarding', 'patient_create', 'periodic_rescreen')),
  status          TEXT NOT NULL CHECK (status IN ('clear', 'match', 'potential_match', 'error', 'skipped')),
  match_count     INTEGER NOT NULL DEFAULT 0,
  matches         JSONB DEFAULT '[]'::jsonb,
  provider_used   BOOLEAN NOT NULL DEFAULT false,
  screened_at     TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE sanctions_screenings IS 'A160: Audit trail for sanctions screening results (OFAC, EU, UK HMT, UN).';

-- Index for lookups by reference
CREATE INDEX IF NOT EXISTS idx_sanctions_screenings_reference_id
  ON sanctions_screenings (reference_id);

-- Index for finding matches needing review
CREATE INDEX IF NOT EXISTS idx_sanctions_screenings_status
  ON sanctions_screenings (status) WHERE status IN ('match', 'potential_match');

-- RLS for sanctions_screenings (admin-only via service role)
ALTER TABLE sanctions_screenings ENABLE ROW LEVEL SECURITY;

CREATE POLICY sanctions_screenings_service_only ON sanctions_screenings
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ============================================================
-- A155: Add card_last4 column to payments for velocity checks
-- ============================================================

ALTER TABLE payments ADD COLUMN IF NOT EXISTS card_last4 TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS card_bin TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS avs_result TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS cvv_result TEXT;

CREATE INDEX IF NOT EXISTS idx_payments_card_last4
  ON payments (card_last4) WHERE card_last4 IS NOT NULL;
