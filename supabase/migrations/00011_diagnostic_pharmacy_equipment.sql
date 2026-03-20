-- ============================================================
-- Migration 00011: Phase 4 & 5
-- Diagnostic Centers (Analysis Lab, Radiology)
-- Pharmacy & Retail (Parapharmacy, Medical Equipment)
-- ============================================================

-- ============================================================
-- 1. ANALYSIS LAB TABLES
-- ============================================================

-- Lab test catalog (available tests a lab can perform)
CREATE TABLE lab_test_catalog (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  name_ar         TEXT,
  code            TEXT,
  category        TEXT NOT NULL DEFAULT 'general',
  sample_type     TEXT DEFAULT 'blood',
  description     TEXT,
  price           NUMERIC(10,2),
  currency        TEXT DEFAULT 'MAD',
  turnaround_hours INT DEFAULT 24,
  reference_ranges JSONB DEFAULT '[]',
  is_active       BOOLEAN DEFAULT TRUE,
  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lab_test_catalog_clinic ON lab_test_catalog(clinic_id);

-- Lab test orders
CREATE TABLE lab_test_orders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  ordering_doctor_id UUID REFERENCES users(id),
  assigned_technician_id UUID REFERENCES users(id),
  order_number    TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'sample_collected', 'in_progress', 'completed', 'validated', 'cancelled'
  )),
  priority        TEXT DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent', 'stat')),
  clinical_notes  TEXT,
  fasting_required BOOLEAN DEFAULT FALSE,
  sample_collected_at TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  validated_at    TIMESTAMPTZ,
  validated_by    UUID REFERENCES users(id),
  pdf_url         TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lab_test_orders_clinic ON lab_test_orders(clinic_id);
CREATE INDEX idx_lab_test_orders_patient ON lab_test_orders(patient_id);
CREATE INDEX idx_lab_test_orders_status ON lab_test_orders(status);

-- Individual test items within an order
CREATE TABLE lab_test_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID NOT NULL REFERENCES lab_test_orders(id) ON DELETE CASCADE,
  test_id         UUID NOT NULL REFERENCES lab_test_catalog(id),
  test_name       TEXT NOT NULL,
  status          TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'in_progress', 'completed'
  )),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lab_test_items_order ON lab_test_items(order_id);

-- Lab test results (one per test item, with structured result data)
CREATE TABLE lab_test_results (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID NOT NULL REFERENCES lab_test_orders(id) ON DELETE CASCADE,
  test_item_id    UUID NOT NULL REFERENCES lab_test_items(id) ON DELETE CASCADE,
  parameter_name  TEXT NOT NULL,
  value           TEXT,
  unit            TEXT,
  reference_min   NUMERIC(10,4),
  reference_max   NUMERIC(10,4),
  flag            TEXT CHECK (flag IN ('normal', 'high', 'low', 'critical_high', 'critical_low', NULL)),
  notes           TEXT,
  entered_by      UUID REFERENCES users(id),
  entered_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lab_test_results_order ON lab_test_results(order_id);
CREATE INDEX idx_lab_test_results_item ON lab_test_results(test_item_id);

-- ============================================================
-- 2. RADIOLOGY & MEDICAL IMAGING TABLES
-- ============================================================

-- Radiology orders / studies
CREATE TABLE radiology_orders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  ordering_doctor_id UUID REFERENCES users(id),
  radiologist_id  UUID REFERENCES users(id),
  order_number    TEXT NOT NULL,
  modality        TEXT NOT NULL CHECK (modality IN (
    'xray', 'ct', 'mri', 'ultrasound', 'mammography', 'pet', 'fluoroscopy', 'other'
  )),
  body_part       TEXT,
  clinical_indication TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'scheduled', 'in_progress', 'images_ready', 'reported', 'validated', 'cancelled'
  )),
  priority        TEXT DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent', 'stat')),
  scheduled_at    TIMESTAMPTZ,
  performed_at    TIMESTAMPTZ,
  reported_at     TIMESTAMPTZ,
  report_text     TEXT,
  report_template_id UUID,
  findings        TEXT,
  impression      TEXT,
  pdf_url         TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_radiology_orders_clinic ON radiology_orders(clinic_id);
CREATE INDEX idx_radiology_orders_patient ON radiology_orders(patient_id);
CREATE INDEX idx_radiology_orders_status ON radiology_orders(status);

-- Radiology images (stored on R2/cloud)
CREATE TABLE radiology_images (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID NOT NULL REFERENCES radiology_orders(id) ON DELETE CASCADE,
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  file_url        TEXT NOT NULL,
  file_name       TEXT,
  file_size       BIGINT,
  content_type    TEXT,
  modality        TEXT,
  is_dicom        BOOLEAN DEFAULT FALSE,
  dicom_metadata  JSONB DEFAULT '{}',
  thumbnail_url   TEXT,
  description     TEXT,
  uploaded_by     UUID REFERENCES users(id),
  uploaded_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_radiology_images_order ON radiology_images(order_id);
CREATE INDEX idx_radiology_images_clinic ON radiology_images(clinic_id);

-- Radiology report templates
CREATE TABLE radiology_report_templates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  modality        TEXT,
  body_part       TEXT,
  template_text   TEXT NOT NULL,
  fields          JSONB DEFAULT '[]',
  is_default      BOOLEAN DEFAULT FALSE,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_radiology_templates_clinic ON radiology_report_templates(clinic_id);

-- ============================================================
-- 3. PARAPHARMACY EXTENSIONS
-- ============================================================

-- Add parapharmacy-specific columns to products table
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_parapharmacy BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS brand TEXT,
  ADD COLUMN IF NOT EXISTS subcategory TEXT,
  ADD COLUMN IF NOT EXISTS ingredients TEXT,
  ADD COLUMN IF NOT EXISTS usage_instructions TEXT,
  ADD COLUMN IF NOT EXISTS skin_type TEXT,
  ADD COLUMN IF NOT EXISTS age_group TEXT;

-- Parapharmacy categories reference
CREATE TABLE parapharmacy_categories (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  name_ar         TEXT,
  slug            TEXT NOT NULL,
  icon            TEXT,
  parent_id       UUID REFERENCES parapharmacy_categories(id),
  sort_order      INT DEFAULT 0,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_parapharmacy_categories_clinic ON parapharmacy_categories(clinic_id);

-- ============================================================
-- 4. MEDICAL EQUIPMENT STORE TABLES
-- ============================================================

-- Equipment inventory (items with serial numbers)
CREATE TABLE equipment_inventory (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  category        TEXT NOT NULL DEFAULT 'general',
  serial_number   TEXT,
  model           TEXT,
  manufacturer    TEXT,
  purchase_date   DATE,
  purchase_price  NUMERIC(10,2),
  currency        TEXT DEFAULT 'MAD',
  condition       TEXT DEFAULT 'good' CHECK (condition IN (
    'new', 'good', 'fair', 'needs_repair', 'decommissioned'
  )),
  is_available    BOOLEAN DEFAULT TRUE,
  is_rentable     BOOLEAN DEFAULT TRUE,
  rental_price_daily NUMERIC(10,2),
  rental_price_weekly NUMERIC(10,2),
  rental_price_monthly NUMERIC(10,2),
  image_url       TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_equipment_inventory_clinic ON equipment_inventory(clinic_id);
CREATE INDEX idx_equipment_inventory_category ON equipment_inventory(category);

-- Equipment rentals
CREATE TABLE equipment_rentals (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  equipment_id    UUID NOT NULL REFERENCES equipment_inventory(id) ON DELETE CASCADE,
  client_name     TEXT NOT NULL,
  client_phone    TEXT,
  client_id_number TEXT,
  rental_start    DATE NOT NULL,
  rental_end      DATE,
  actual_return   DATE,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'reserved', 'active', 'returned', 'overdue', 'cancelled'
  )),
  condition_out   TEXT DEFAULT 'good',
  condition_in    TEXT,
  deposit_amount  NUMERIC(10,2),
  rental_amount   NUMERIC(10,2),
  currency        TEXT DEFAULT 'MAD',
  payment_status  TEXT DEFAULT 'pending' CHECK (payment_status IN (
    'pending', 'partial', 'paid', 'refunded'
  )),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_equipment_rentals_clinic ON equipment_rentals(clinic_id);
CREATE INDEX idx_equipment_rentals_equipment ON equipment_rentals(equipment_id);
CREATE INDEX idx_equipment_rentals_status ON equipment_rentals(status);

-- Equipment maintenance logs
CREATE TABLE equipment_maintenance (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  equipment_id    UUID NOT NULL REFERENCES equipment_inventory(id) ON DELETE CASCADE,
  type            TEXT NOT NULL DEFAULT 'routine' CHECK (type IN (
    'routine', 'repair', 'calibration', 'inspection', 'cleaning'
  )),
  description     TEXT,
  performed_by    TEXT,
  performed_at    DATE NOT NULL DEFAULT CURRENT_DATE,
  next_due        DATE,
  cost            NUMERIC(10,2),
  currency        TEXT DEFAULT 'MAD',
  status          TEXT DEFAULT 'completed' CHECK (status IN (
    'scheduled', 'in_progress', 'completed', 'cancelled'
  )),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_equipment_maintenance_clinic ON equipment_maintenance(clinic_id);
CREATE INDEX idx_equipment_maintenance_equipment ON equipment_maintenance(equipment_id);

-- ============================================================
-- 5. UPDATE CLINIC TYPES for new categories
-- ============================================================

-- Add diagnostic center types
INSERT INTO clinic_types (type_key, name_fr, name_ar, category, icon, features_config, sort_order, is_active)
VALUES
  ('analysis_lab', 'Laboratoire d''analyses', 'مختبر تحاليل', 'diagnostic', 'flask-conical', '{"lab_tests": true, "lab_results": true, "appointments": true}', 30, true),
  ('radiology_center', 'Centre de radiologie', 'مركز أشعة', 'diagnostic', 'scan', '{"imaging": true, "radiology_reports": true, "appointments": true}', 31, true),
  ('parapharmacy', 'Parapharmacie', 'باراصيدلية', 'pharmacy_retail', 'sparkles', '{"sales": true, "stock": true}', 40, true),
  ('medical_equipment', 'Matériel médical', 'معدات طبية', 'pharmacy_retail', 'wrench', '{"equipment_rentals": true, "equipment_maintenance": true, "stock": true}', 41, true)
ON CONFLICT DO NOTHING;
