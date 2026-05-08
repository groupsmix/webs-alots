-- ============================================================
-- Migration 00017: Lab & Clinic/Center Dashboard Tables
-- Task 36: Lab Dashboard KPIs
-- Task 37: Clinic/Center Dashboard KPIs
--
-- NOTE: Some tables (departments, beds, admissions) were already
-- created in 00015_phase6_clinics_centers.sql and lab_test_orders
-- in 00014_diagnostic_pharmacy_equipment.sql.
-- This migration uses IF NOT EXISTS to be idempotent and adds
-- additional RLS policies for staff and patient access.
-- ============================================================

-- ============================================================
-- 1. LAB TEST ORDERS (Task 36)
-- ============================================================

CREATE TABLE IF NOT EXISTS lab_test_orders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  test_name       TEXT NOT NULL,
  test_category   TEXT DEFAULT 'general',
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'in_progress', 'completed', 'awaiting_validation', 'validated', 'cancelled')),
  priority        TEXT DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent', 'stat')),
  ordered_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  validated_at    TIMESTAMPTZ,
  validated_by    UUID REFERENCES users(id),
  results         JSONB DEFAULT '{}',
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lab_test_orders_clinic ON lab_test_orders(clinic_id);
CREATE INDEX IF NOT EXISTS idx_lab_test_orders_patient ON lab_test_orders(patient_id);
-- Note: lab_test_orders is actually created in 00014 with column
-- ordering_doctor_id (not doctor_id). Use the real column name to
-- keep this migration runnable on a fresh DB.
CREATE INDEX IF NOT EXISTS idx_lab_test_orders_doctor ON lab_test_orders(ordering_doctor_id);
CREATE INDEX IF NOT EXISTS idx_lab_test_orders_status ON lab_test_orders(status);

-- ============================================================
-- 2. DEPARTMENTS (Task 37)
-- ============================================================

CREATE TABLE IF NOT EXISTS departments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  code            TEXT,
  head_doctor_id  UUID REFERENCES users(id),
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_departments_clinic ON departments(clinic_id);

-- ============================================================
-- 3. BEDS (Task 37)
-- ============================================================

CREATE TABLE IF NOT EXISTS beds (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  department_id   UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  bed_number      TEXT NOT NULL,
  ward            TEXT,
  status          TEXT NOT NULL DEFAULT 'available'
                  CHECK (status IN ('available', 'occupied', 'maintenance', 'reserved')),
  patient_id      UUID REFERENCES users(id),
  admitted_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_beds_clinic ON beds(clinic_id);
-- Note: the real beds table (created in 00015) has room_id, not department_id,
-- and idx_beds_room is already created there. Skip the department_id index.
CREATE INDEX IF NOT EXISTS idx_beds_status ON beds(status);

-- ============================================================
-- 4. ADMISSIONS (Task 37)
-- ============================================================

CREATE TABLE IF NOT EXISTS admissions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  department_id   UUID NOT NULL REFERENCES departments(id),
  bed_id          UUID REFERENCES beds(id),
  admission_date  TIMESTAMPTZ NOT NULL DEFAULT now(),
  discharge_date  TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'admitted'
                  CHECK (status IN ('admitted', 'discharged', 'transferred')),
  diagnosis       TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admissions_clinic ON admissions(clinic_id);
CREATE INDEX IF NOT EXISTS idx_admissions_patient ON admissions(patient_id);
CREATE INDEX IF NOT EXISTS idx_admissions_department ON admissions(department_id);
CREATE INDEX IF NOT EXISTS idx_admissions_status ON admissions(status);

-- ============================================================
-- 5. RLS POLICIES
-- ============================================================

ALTER TABLE lab_test_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE admissions ENABLE ROW LEVEL SECURITY;

-- Super admin full access (use DROP IF EXISTS to avoid conflicts
-- with policies already created in 00015)
DROP POLICY IF EXISTS "sa_lab_test_orders_all" ON lab_test_orders;
CREATE POLICY "sa_lab_test_orders_all" ON lab_test_orders FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "sa_departments_all" ON departments;
CREATE POLICY "sa_departments_all" ON departments FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "sa_beds_all" ON beds;
CREATE POLICY "sa_beds_all" ON beds FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "sa_admissions_all" ON admissions;
CREATE POLICY "sa_admissions_all" ON admissions FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Clinic staff access (new policies not in 00015)
DROP POLICY IF EXISTS "staff_lab_test_orders" ON lab_test_orders;
CREATE POLICY "staff_lab_test_orders" ON lab_test_orders FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());

DROP POLICY IF EXISTS "staff_departments" ON departments;
CREATE POLICY "staff_departments" ON departments FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());

DROP POLICY IF EXISTS "staff_beds" ON beds;
CREATE POLICY "staff_beds" ON beds FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());

DROP POLICY IF EXISTS "staff_admissions" ON admissions;
CREATE POLICY "staff_admissions" ON admissions FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());

-- Patient read own records
DROP POLICY IF EXISTS "patient_lab_test_orders_read" ON lab_test_orders;
CREATE POLICY "patient_lab_test_orders_read" ON lab_test_orders FOR SELECT
  USING (patient_id = get_my_user_id());

DROP POLICY IF EXISTS "patient_admissions_read" ON admissions;
CREATE POLICY "patient_admissions_read" ON admissions FOR SELECT
  USING (patient_id = get_my_user_id());
