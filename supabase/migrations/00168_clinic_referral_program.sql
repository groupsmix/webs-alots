-- Clinic acquisition referral program
-- Distinct from the medical doctor-to-patient referrals table (referrals)

CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  discount_pct INTEGER NOT NULL DEFAULT 10 CHECK (discount_pct BETWEEN 0 AND 100),
  discount_months INTEGER NOT NULL DEFAULT 2,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  times_used INTEGER NOT NULL DEFAULT 0,
  max_uses INTEGER, -- NULL = unlimited
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referral_codes_clinic ON referral_codes(clinic_id);

CREATE TABLE IF NOT EXISTS referral_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_id UUID NOT NULL REFERENCES referral_codes(id) ON DELETE CASCADE,
  referrer_clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  referee_clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('signup','first_payment','reward_triggered')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_referral_events_code ON referral_events(referral_code_id);
CREATE INDEX IF NOT EXISTS idx_referral_events_referrer ON referral_events(referrer_clinic_id);

CREATE TABLE IF NOT EXISTS referral_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_event_id UUID REFERENCES referral_events(id) ON DELETE SET NULL,
  beneficiary_clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  amount_centimes INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MAD',
  payout_type TEXT NOT NULL CHECK (payout_type IN ('account_credit','discount','cash_transfer')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','applied','rejected')),
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_referral_credits_clinic ON referral_credits(beneficiary_clinic_id);
CREATE INDEX IF NOT EXISTS idx_referral_credits_status ON referral_credits(status) WHERE status = 'pending';

ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_credits ENABLE ROW LEVEL SECURITY;

-- Clinic admins read their own referral data
DO $$ BEGIN
  CREATE POLICY "referral_codes_clinic_select" ON referral_codes FOR SELECT
    USING (clinic_id = get_request_clinic_id() AND auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "referral_events_clinic_select" ON referral_events FOR SELECT
    USING (referrer_clinic_id = get_request_clinic_id() AND auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "referral_credits_clinic_select" ON referral_credits FOR SELECT
    USING (beneficiary_clinic_id = get_request_clinic_id() AND auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
