-- Tier 1 Billing AI: Invoice tracking, payment plans, reminders, financial summary
-- Tables: invoices, invoice_line_items, payment_plans, payment_plan_installments, payment_reminders

-- ── Invoices ──

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES users(id),
  appointment_id UUID REFERENCES appointments(id),
  invoice_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled', 'refunded')),
  subtotal_centimes INTEGER NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  tax_amount_centimes INTEGER NOT NULL DEFAULT 0,
  discount_centimes INTEGER NOT NULL DEFAULT 0,
  total_centimes INTEGER NOT NULL DEFAULT 0,
  amount_paid_centimes INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'MAD',
  payment_method TEXT CHECK (payment_method IN ('cash', 'card', 'cmi', 'insurance', 'bank_transfer', NULL)),
  insurance_type TEXT CHECK (insurance_type IN ('CNSS', 'CNOPS', 'AMO', 'RAMED', NULL)),
  insurance_ref TEXT,
  notes TEXT,
  due_date DATE,
  paid_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_clinic_id ON invoices(clinic_id);
CREATE INDEX IF NOT EXISTS idx_invoices_patient_id ON invoices(patient_id);
CREATE INDEX IF NOT EXISTS idx_invoices_appointment_id ON invoices(appointment_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(clinic_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(clinic_id, due_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_number_clinic ON invoices(clinic_id, invoice_number);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'invoices_tenant_isolation') THEN
    CREATE POLICY invoices_tenant_isolation ON invoices
      FOR ALL
      USING (clinic_id = get_user_clinic_id())
      WITH CHECK (clinic_id = get_user_clinic_id());
  END IF;
END $$;

-- ── Invoice Line Items ──

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_centimes INTEGER NOT NULL,
  total_centimes INTEGER NOT NULL,
  service_id UUID REFERENCES services(id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_clinic_id ON invoice_line_items(clinic_id);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice_id ON invoice_line_items(invoice_id);

ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'invoice_line_items_tenant_isolation') THEN
    CREATE POLICY invoice_line_items_tenant_isolation ON invoice_line_items
      FOR ALL
      USING (clinic_id = get_user_clinic_id())
      WITH CHECK (clinic_id = get_user_clinic_id());
  END IF;
END $$;

-- ── Payment Plans ──

CREATE TABLE IF NOT EXISTS payment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES users(id),
  total_centimes INTEGER NOT NULL,
  num_installments INTEGER NOT NULL CHECK (num_installments >= 2),
  frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('weekly', 'biweekly', 'monthly')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'defaulted', 'cancelled')),
  start_date DATE NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_plans_clinic_id ON payment_plans(clinic_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_invoice_id ON payment_plans(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_patient_id ON payment_plans(patient_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_status ON payment_plans(clinic_id, status);

ALTER TABLE payment_plans ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'payment_plans_tenant_isolation') THEN
    CREATE POLICY payment_plans_tenant_isolation ON payment_plans
      FOR ALL
      USING (clinic_id = get_user_clinic_id())
      WITH CHECK (clinic_id = get_user_clinic_id());
  END IF;
END $$;

-- ── Payment Plan Installments ──

CREATE TABLE IF NOT EXISTS payment_plan_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES payment_plans(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  amount_centimes INTEGER NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  paid_at TIMESTAMPTZ,
  payment_method TEXT CHECK (payment_method IN ('cash', 'card', 'cmi', 'insurance', 'bank_transfer', NULL)),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pp_installments_clinic_id ON payment_plan_installments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_pp_installments_plan_id ON payment_plan_installments(plan_id);
CREATE INDEX IF NOT EXISTS idx_pp_installments_due_date ON payment_plan_installments(clinic_id, due_date);
CREATE INDEX IF NOT EXISTS idx_pp_installments_status ON payment_plan_installments(clinic_id, status);

ALTER TABLE payment_plan_installments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pp_installments_tenant_isolation') THEN
    CREATE POLICY pp_installments_tenant_isolation ON payment_plan_installments
      FOR ALL
      USING (clinic_id = get_user_clinic_id())
      WITH CHECK (clinic_id = get_user_clinic_id());
  END IF;
END $$;

-- ── Payment Reminders ──

CREATE TABLE IF NOT EXISTS payment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  installment_id UUID REFERENCES payment_plan_installments(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES users(id),
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('overdue_3d', 'overdue_7d', 'overdue_14d', 'installment_upcoming', 'installment_overdue')),
  channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'sms', 'email')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_reminders_clinic_id ON payment_reminders(clinic_id);
CREATE INDEX IF NOT EXISTS idx_payment_reminders_invoice_id ON payment_reminders(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_reminders_installment_id ON payment_reminders(installment_id);
CREATE INDEX IF NOT EXISTS idx_payment_reminders_status ON payment_reminders(clinic_id, status);

ALTER TABLE payment_reminders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'payment_reminders_tenant_isolation') THEN
    CREATE POLICY payment_reminders_tenant_isolation ON payment_reminders
      FOR ALL
      USING (clinic_id = get_user_clinic_id())
      WITH CHECK (clinic_id = get_user_clinic_id());
  END IF;
END $$;
