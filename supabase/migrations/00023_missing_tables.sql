-- ============================================================
-- Migration 00023: Create Missing Tables
--
-- Adds 5 tables that are referenced in code (database.ts types,
-- backup.ts, lab-public.ts, invoice-generator.ts) but were never
-- created via migration:
--   1. invoices
--   2. invoice_items
--   3. collection_points
--   4. lab_tests
--   5. medical_records
-- ============================================================

-- ============================================================
-- 1. INVOICES — clinic patient invoices (Moroccan-compliant)
-- ============================================================

CREATE TABLE IF NOT EXISTS invoices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  invoice_number  TEXT NOT NULL,
  amount          NUMERIC NOT NULL DEFAULT 0,
  tax             NUMERIC NOT NULL DEFAULT 0,
  total           NUMERIC NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled', 'refunded')),
  due_date        DATE,
  paid_at         TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_clinic ON invoices(clinic_id);
CREATE INDEX IF NOT EXISTS idx_invoices_patient ON invoices(patient_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);

-- ============================================================
-- 2. INVOICE_ITEMS — line items for each invoice
-- ============================================================

CREATE TABLE IF NOT EXISTS invoice_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description     TEXT NOT NULL,
  quantity        NUMERIC NOT NULL DEFAULT 1,
  unit_price      NUMERIC NOT NULL DEFAULT 0,
  total           NUMERIC NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);

-- ============================================================
-- 3. COLLECTION_POINTS — lab sample collection locations
-- ============================================================

CREATE TABLE IF NOT EXISTS collection_points (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id             UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  address               TEXT,
  city                  TEXT,
  phone                 TEXT,
  hours                 JSONB DEFAULT '[]',
  is_main_lab           BOOLEAN DEFAULT FALSE,
  has_parking           BOOLEAN DEFAULT FALSE,
  wheelchair_accessible BOOLEAN DEFAULT FALSE,
  lat                   DOUBLE PRECISION,
  lng                   DOUBLE PRECISION,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collection_points_clinic ON collection_points(clinic_id);

-- ============================================================
-- 4. LAB_TESTS — test catalog for lab clinics (public site)
-- ============================================================

CREATE TABLE IF NOT EXISTS lab_tests (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id                UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name                     TEXT NOT NULL,
  category                 TEXT NOT NULL DEFAULT 'general',
  description              TEXT,
  preparation_instructions TEXT,
  turnaround_time          TEXT,
  price                    NUMERIC,
  requires_fasting         BOOLEAN DEFAULT FALSE,
  sample_type              TEXT,
  is_active                BOOLEAN DEFAULT TRUE,
  created_at               TIMESTAMPTZ DEFAULT now(),
  updated_at               TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lab_tests_clinic ON lab_tests(clinic_id);
CREATE INDEX IF NOT EXISTS idx_lab_tests_category ON lab_tests(category);
CREATE INDEX IF NOT EXISTS idx_lab_tests_active ON lab_tests(clinic_id, is_active) WHERE is_active = TRUE;

-- ============================================================
-- 5. MEDICAL_RECORDS — generic medical record store
-- ============================================================

CREATE TABLE IF NOT EXISTS medical_records (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID REFERENCES users(id),
  record_type     TEXT NOT NULL,
  content         JSONB DEFAULT '{}',
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_medical_records_clinic ON medical_records(clinic_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_patient ON medical_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_doctor ON medical_records(doctor_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_type ON medical_records(record_type);

-- ============================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;

-- Super admin: full access on all tables
CREATE POLICY "sa_invoices_all" ON invoices
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "sa_invoice_items_all" ON invoice_items
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "sa_collection_points_all" ON collection_points
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "sa_lab_tests_all" ON lab_tests
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "sa_medical_records_all" ON medical_records
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Clinic staff: access their own clinic's data
CREATE POLICY "staff_invoices_all" ON invoices
  FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());

CREATE POLICY "staff_invoice_items_all" ON invoice_items
  FOR ALL
  USING (invoice_id IN (SELECT id FROM invoices WHERE clinic_id = get_user_clinic_id()) AND is_clinic_staff())
  WITH CHECK (invoice_id IN (SELECT id FROM invoices WHERE clinic_id = get_user_clinic_id()) AND is_clinic_staff());

CREATE POLICY "staff_collection_points_all" ON collection_points
  FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());

CREATE POLICY "staff_lab_tests_all" ON lab_tests
  FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());

CREATE POLICY "staff_medical_records_all" ON medical_records
  FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());

-- Patients: read their own invoices and medical records
CREATE POLICY "patient_invoices_read" ON invoices
  FOR SELECT
  USING (patient_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "patient_medical_records_read" ON medical_records
  FOR SELECT
  USING (patient_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

-- Public read for collection_points and lab_tests (public website needs these)
CREATE POLICY "public_collection_points_read" ON collection_points
  FOR SELECT USING (TRUE);

CREATE POLICY "public_lab_tests_read" ON lab_tests
  FOR SELECT USING (is_active = TRUE);
