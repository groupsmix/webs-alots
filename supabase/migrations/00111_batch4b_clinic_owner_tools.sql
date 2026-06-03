-- Batch 4B: Clinic Owner Tools
-- 1. Revenue per doctor (uses existing appointments/payments tables — no new tables)
-- 2. Expense tracking: clinic_expenses table + expense_categories
-- 3. Patient acquisition cost: marketing_campaigns + patient_acquisition_channels
-- 4. Insurance claim management: insurance_claims table

-- ── Expense Categories ──

CREATE TABLE IF NOT EXISTS expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'operational' CHECK (type IN ('rent', 'supplies', 'salaries', 'equipment', 'marketing', 'utilities', 'insurance', 'maintenance', 'operational', 'other')),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expense_categories_clinic_id ON expense_categories(clinic_id);

ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'expense_categories_tenant_isolation') THEN
    CREATE POLICY expense_categories_tenant_isolation ON expense_categories
      FOR ALL
      USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
      WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
  END IF;
END $$;

-- ── Clinic Expenses ──

CREATE TABLE IF NOT EXISTS clinic_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  category_id UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'MAD',
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurring_interval TEXT CHECK (recurring_interval IN ('monthly', 'quarterly', 'yearly')),
  receipt_url TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinic_expenses_clinic_id ON clinic_expenses(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_expenses_category_id ON clinic_expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_clinic_expenses_date ON clinic_expenses(expense_date);

ALTER TABLE clinic_expenses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'clinic_expenses_tenant_isolation') THEN
    CREATE POLICY clinic_expenses_tenant_isolation ON clinic_expenses
      FOR ALL
      USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
      WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
  END IF;
END $$;

-- ── Marketing Campaigns ──

CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'google', 'facebook', 'instagram', 'referral', 'seo', 'offline', 'other')),
  budget INTEGER NOT NULL DEFAULT 0 CHECK (budget >= 0),
  spend INTEGER NOT NULL DEFAULT 0 CHECK (spend >= 0),
  currency TEXT NOT NULL DEFAULT 'MAD',
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_clinic_id ON marketing_campaigns(clinic_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_channel ON marketing_campaigns(channel);

ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'marketing_campaigns_tenant_isolation') THEN
    CREATE POLICY marketing_campaigns_tenant_isolation ON marketing_campaigns
      FOR ALL
      USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
      WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
  END IF;
END $$;

-- ── Patient Acquisition Channels (tracks how each patient found the clinic) ──

CREATE TABLE IF NOT EXISTS patient_acquisition_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES users(id),
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'google', 'facebook', 'instagram', 'referral', 'walk_in', 'website', 'other')),
  campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
  referral_source TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_acq_clinic_id ON patient_acquisition_channels(clinic_id);
CREATE INDEX IF NOT EXISTS idx_patient_acq_patient_id ON patient_acquisition_channels(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_acq_channel ON patient_acquisition_channels(channel);
CREATE UNIQUE INDEX IF NOT EXISTS idx_patient_acq_unique ON patient_acquisition_channels(clinic_id, patient_id);

ALTER TABLE patient_acquisition_channels ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'patient_acq_channels_tenant_isolation') THEN
    CREATE POLICY patient_acq_channels_tenant_isolation ON patient_acquisition_channels
      FOR ALL
      USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
      WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
  END IF;
END $$;

-- ── Insurance Claims ──

CREATE TABLE IF NOT EXISTS insurance_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES users(id),
  doctor_id UUID REFERENCES users(id),
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  insurance_type TEXT NOT NULL CHECK (insurance_type IN ('CNSS', 'CNOPS', 'AMO', 'RAMED', 'private')),
  policy_number TEXT,
  claim_number TEXT,
  amount_claimed INTEGER NOT NULL CHECK (amount_claimed >= 0),
  amount_approved INTEGER CHECK (amount_approved >= 0),
  currency TEXT NOT NULL DEFAULT 'MAD',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'pending', 'approved', 'partially_approved', 'rejected', 'appealed')),
  submitted_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  diagnosis_code TEXT,
  treatment_description TEXT,
  documents JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insurance_claims_clinic_id ON insurance_claims(clinic_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_patient_id ON insurance_claims(patient_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_status ON insurance_claims(status);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_type ON insurance_claims(insurance_type);

ALTER TABLE insurance_claims ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'insurance_claims_tenant_isolation') THEN
    CREATE POLICY insurance_claims_tenant_isolation ON insurance_claims
      FOR ALL
      USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
      WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
  END IF;
END $$;
