-- Batch 3B: Monetization & Business features
-- 1. Multi-clinic analytics (uses existing tables - no new tables needed)
-- 2. White-label support: custom_domains table
-- 3. Referral system: referrals table
-- 4. Lab results integration: lab_results table

-- ── Custom Domains (White-label support) ──

CREATE TABLE IF NOT EXISTS custom_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  domain TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'failed', 'removing')),
  cloudflare_custom_hostname_id TEXT,
  ssl_status TEXT DEFAULT 'pending',
  verification_txt TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_domains_clinic_id ON custom_domains(clinic_id);
CREATE INDEX IF NOT EXISTS idx_custom_domains_domain ON custom_domains(domain);

ALTER TABLE custom_domains ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'custom_domains_tenant_isolation') THEN
    CREATE POLICY custom_domains_tenant_isolation ON custom_domains
      FOR ALL
      USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
      WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
  END IF;
END $$;

-- ── Referrals (Doctor-to-doctor) ──

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  referring_doctor_id UUID NOT NULL REFERENCES users(id),
  referred_to_doctor_id UUID NOT NULL REFERENCES users(id),
  patient_id UUID NOT NULL REFERENCES users(id),
  reason TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'completed')),
  whatsapp_notified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referrals_clinic_id ON referrals(clinic_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referring_doctor ON referrals(referring_doctor_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_to ON referrals(referred_to_doctor_id);
CREATE INDEX IF NOT EXISTS idx_referrals_patient ON referrals(patient_id);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'referrals_tenant_isolation') THEN
    CREATE POLICY referrals_tenant_isolation ON referrals
      FOR ALL
      USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
      WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
  END IF;
END $$;

-- ── Lab Results ──

CREATE TABLE IF NOT EXISTS lab_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES users(id),
  doctor_id UUID REFERENCES users(id),
  order_id UUID,
  title TEXT NOT NULL,
  file_key TEXT,
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'shared')),
  whatsapp_notified BOOLEAN DEFAULT false,
  shared_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lab_results_clinic_id ON lab_results(clinic_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_patient ON lab_results(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_doctor ON lab_results(doctor_id);

ALTER TABLE lab_results ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'lab_results_tenant_isolation') THEN
    CREATE POLICY lab_results_tenant_isolation ON lab_results
      FOR ALL
      USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
      WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
  END IF;
END $$;
