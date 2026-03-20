-- ============================================================
-- Migration 00011: Phase 6 — Clinics & Centers
-- Tables for Polyclinic, Aesthetic Clinic, IVF Center,
-- Dialysis Center, and Dental Lab.
-- ============================================================

-- ============================================================
-- 1. POLYCLINIC TABLES
-- ============================================================

-- Departments within a polyclinic
CREATE TABLE departments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  name_ar         TEXT,
  head_doctor_id  UUID REFERENCES users(id),
  description     TEXT,
  floor           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_departments_clinic ON departments(clinic_id);

-- Doctor-department assignments (many-to-many)
CREATE TABLE doctor_departments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department_id   UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(doctor_id, department_id)
);

CREATE INDEX idx_doctor_departments_dept ON doctor_departments(department_id);
CREATE INDEX idx_doctor_departments_doctor ON doctor_departments(doctor_id);

-- Rooms within a polyclinic
CREATE TABLE rooms (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  department_id   UUID REFERENCES departments(id) ON DELETE SET NULL,
  room_number     TEXT NOT NULL,
  room_type       TEXT NOT NULL CHECK (room_type IN ('ward', 'private', 'icu', 'operating', 'consultation', 'other')),
  floor           TEXT,
  total_beds      INT NOT NULL DEFAULT 1,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_rooms_clinic ON rooms(clinic_id);
CREATE INDEX idx_rooms_department ON rooms(department_id);

-- Beds within rooms
CREATE TABLE beds (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  room_id         UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  bed_number      TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance', 'reserved')),
  current_patient_id UUID REFERENCES users(id),
  notes           TEXT,
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(room_id, bed_number)
);

CREATE INDEX idx_beds_room ON beds(room_id);
CREATE INDEX idx_beds_status ON beds(status);

-- Admissions (bed occupancy tracking)
CREATE TABLE admissions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  bed_id          UUID NOT NULL REFERENCES beds(id),
  department_id   UUID REFERENCES departments(id),
  admitting_doctor_id UUID REFERENCES users(id),
  admission_date  TIMESTAMPTZ NOT NULL DEFAULT now(),
  discharge_date  TIMESTAMPTZ,
  diagnosis       TEXT,
  status          TEXT NOT NULL DEFAULT 'admitted' CHECK (status IN ('admitted', 'discharged', 'transferred')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_admissions_clinic ON admissions(clinic_id);
CREATE INDEX idx_admissions_patient ON admissions(patient_id);
CREATE INDEX idx_admissions_status ON admissions(status);

-- ============================================================
-- 2. AESTHETIC / COSMETIC CLINIC TABLES
-- ============================================================

-- Consent forms for before/after photos
CREATE TABLE photo_consent_forms (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  consent_type    TEXT NOT NULL DEFAULT 'before_after' CHECK (consent_type IN ('before_after', 'marketing', 'medical_record')),
  signed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  signature_url   TEXT,
  consent_text    TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_consent_forms_clinic ON photo_consent_forms(clinic_id);
CREATE INDEX idx_consent_forms_patient ON photo_consent_forms(patient_id);

-- Treatment packages (bundles of services)
CREATE TABLE treatment_packages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  services        JSONB NOT NULL DEFAULT '[]',
  total_sessions  INT NOT NULL DEFAULT 1,
  price           NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_treatment_packages_clinic ON treatment_packages(clinic_id);

-- Patient package subscriptions (tracking sessions used)
CREATE TABLE patient_packages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  package_id      UUID NOT NULL REFERENCES treatment_packages(id),
  sessions_used   INT NOT NULL DEFAULT 0,
  sessions_total  INT NOT NULL,
  start_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date     DATE,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired', 'cancelled')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_patient_packages_clinic ON patient_packages(clinic_id);
CREATE INDEX idx_patient_packages_patient ON patient_packages(patient_id);

-- Consultation photos with annotations
CREATE TABLE consultation_photos (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID REFERENCES users(id),
  photo_url       TEXT NOT NULL,
  thumbnail_url   TEXT,
  annotations     JSONB DEFAULT '[]',
  body_area       TEXT,
  notes           TEXT,
  taken_at        TIMESTAMPTZ DEFAULT now(),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_consultation_photos_clinic ON consultation_photos(clinic_id);
CREATE INDEX idx_consultation_photos_patient ON consultation_photos(patient_id);

-- ============================================================
-- 3. IVF / FERTILITY CENTER TABLES
-- ============================================================

-- IVF treatment cycles
CREATE TABLE ivf_cycles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID REFERENCES users(id),
  partner_id      UUID REFERENCES users(id),
  cycle_number    INT NOT NULL DEFAULT 1,
  cycle_type      TEXT NOT NULL CHECK (cycle_type IN ('ivf', 'icsi', 'iui', 'fet', 'egg_freezing', 'other')),
  status          TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'stimulation', 'retrieval', 'fertilization', 'transfer', 'tww', 'completed', 'cancelled')),
  start_date      DATE,
  end_date        DATE,
  protocol_id     UUID,
  stimulation_start DATE,
  retrieval_date  DATE,
  transfer_date   DATE,
  eggs_retrieved  INT,
  eggs_fertilized INT,
  embryos_transferred INT,
  embryos_frozen  INT,
  outcome         TEXT CHECK (outcome IN ('positive', 'negative', 'biochemical', 'miscarriage', 'ongoing', 'pending', NULL)),
  beta_hcg_value  NUMERIC(10,2),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ivf_cycles_clinic ON ivf_cycles(clinic_id);
CREATE INDEX idx_ivf_cycles_patient ON ivf_cycles(patient_id);
CREATE INDEX idx_ivf_cycles_status ON ivf_cycles(status);

-- IVF protocol templates
CREATE TABLE ivf_protocols (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  protocol_type   TEXT NOT NULL CHECK (protocol_type IN ('long', 'short', 'antagonist', 'natural', 'mini_ivf', 'custom')),
  medications     JSONB NOT NULL DEFAULT '[]',
  steps           JSONB NOT NULL DEFAULT '[]',
  duration_days   INT,
  is_template     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ivf_protocols_clinic ON ivf_protocols(clinic_id);

-- IVF cycle timeline events
CREATE TABLE ivf_timeline_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cycle_id        UUID NOT NULL REFERENCES ivf_cycles(id) ON DELETE CASCADE,
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL CHECK (event_type IN ('medication_start', 'scan', 'blood_test', 'trigger', 'retrieval', 'fertilization_report', 'transfer', 'beta_test', 'follow_up', 'other')),
  event_date      TIMESTAMPTZ NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  results         JSONB,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ivf_timeline_cycle ON ivf_timeline_events(cycle_id);

-- ============================================================
-- 4. DIALYSIS CENTER TABLES
-- ============================================================

-- Dialysis machines
CREATE TABLE dialysis_machines (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  machine_name    TEXT NOT NULL,
  machine_model   TEXT,
  serial_number   TEXT,
  status          TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'maintenance', 'out_of_service')),
  last_maintenance TIMESTAMPTZ,
  next_maintenance TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_dialysis_machines_clinic ON dialysis_machines(clinic_id);
CREATE INDEX idx_dialysis_machines_status ON dialysis_machines(status);

-- Dialysis sessions
CREATE TABLE dialysis_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID REFERENCES users(id),
  machine_id      UUID REFERENCES dialysis_machines(id),
  session_date    DATE NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME,
  duration_minutes INT DEFAULT 240,
  status          TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show')),
  is_recurring    BOOLEAN NOT NULL DEFAULT FALSE,
  recurrence_pattern TEXT CHECK (recurrence_pattern IN ('mon_wed_fri', 'tue_thu_sat', 'custom', NULL)),
  recurrence_group_id UUID,
  pre_weight      NUMERIC(5,2),
  post_weight     NUMERIC(5,2),
  pre_bp_systolic INT,
  pre_bp_diastolic INT,
  post_bp_systolic INT,
  post_bp_diastolic INT,
  pre_pulse       INT,
  post_pulse      INT,
  pre_temperature NUMERIC(4,1),
  post_temperature NUMERIC(4,1),
  uf_goal         NUMERIC(6,2),
  uf_actual       NUMERIC(6,2),
  dialysate_flow  INT,
  blood_flow      INT,
  access_type     TEXT CHECK (access_type IN ('fistula', 'graft', 'catheter', NULL)),
  complications   TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_dialysis_sessions_clinic ON dialysis_sessions(clinic_id);
CREATE INDEX idx_dialysis_sessions_patient ON dialysis_sessions(patient_id);
CREATE INDEX idx_dialysis_sessions_date ON dialysis_sessions(session_date);
CREATE INDEX idx_dialysis_sessions_machine ON dialysis_sessions(machine_id);

-- ============================================================
-- 5. DENTAL LAB TABLES
-- ============================================================

-- Prosthetic orders from dentists
CREATE TABLE prosthetic_orders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  dentist_id      UUID REFERENCES users(id),
  dentist_name    TEXT,
  dentist_clinic  TEXT,
  patient_name    TEXT,
  order_type      TEXT NOT NULL CHECK (order_type IN ('crown', 'bridge', 'denture', 'implant_abutment', 'veneer', 'inlay_onlay', 'orthodontic', 'other')),
  material        TEXT,
  shade           TEXT,
  tooth_numbers   INT[],
  description     TEXT,
  special_instructions TEXT,
  status          TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'in_progress', 'quality_check', 'ready', 'delivered', 'returned')),
  priority        TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent', 'rush')),
  received_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date        DATE,
  completed_date  DATE,
  delivered_date  DATE,
  price           NUMERIC(10,2),
  is_paid         BOOLEAN NOT NULL DEFAULT FALSE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_prosthetic_orders_clinic ON prosthetic_orders(clinic_id);
CREATE INDEX idx_prosthetic_orders_status ON prosthetic_orders(status);
CREATE INDEX idx_prosthetic_orders_dentist ON prosthetic_orders(dentist_id);

-- Lab materials inventory
CREATE TABLE lab_materials (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  category        TEXT NOT NULL,
  quantity        NUMERIC(10,2) NOT NULL DEFAULT 0,
  unit            TEXT NOT NULL DEFAULT 'pcs',
  min_threshold   NUMERIC(10,2) NOT NULL DEFAULT 5,
  unit_cost       NUMERIC(10,2),
  supplier        TEXT,
  lot_number      TEXT,
  expiry_date     DATE,
  last_restocked  TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lab_materials_clinic ON lab_materials(clinic_id);
CREATE INDEX idx_lab_materials_category ON lab_materials(category);

-- Lab delivery tracking
CREATE TABLE lab_deliveries (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  order_id        UUID NOT NULL REFERENCES prosthetic_orders(id) ON DELETE CASCADE,
  delivery_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  delivered_by    TEXT,
  received_by     TEXT,
  condition       TEXT DEFAULT 'good' CHECK (condition IN ('good', 'damaged', 'incomplete')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lab_deliveries_clinic ON lab_deliveries(clinic_id);
CREATE INDEX idx_lab_deliveries_order ON lab_deliveries(order_id);

-- Lab invoices
CREATE TABLE lab_invoices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  invoice_number  TEXT NOT NULL,
  dentist_id      UUID REFERENCES users(id),
  dentist_name    TEXT,
  items           JSONB NOT NULL DEFAULT '[]',
  subtotal        NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(10,2) DEFAULT 0,
  total           NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'MAD',
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  issued_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date        DATE,
  paid_date       DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lab_invoices_clinic ON lab_invoices(clinic_id);
CREATE INDEX idx_lab_invoices_status ON lab_invoices(status);

-- ============================================================
-- 6. ADD NEW CLINIC TYPES (IVF & Dental Lab)
-- ============================================================

INSERT INTO clinic_types (type_key, name_fr, name_ar, category, icon, sort_order, features_config) VALUES
('ivf_center',    'Centre de Fertilité / FIV',  'مركز الخصوبة وأطفال الأنابيب', 'clinics_centers', 'HeartHandshake', 38, '{"appointments":true,"prescriptions":true,"consultations":true,"lab_results":true,"imaging":true,"stock":true,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":true,"ivf_cycles":true}'),
('dental_lab',    'Laboratoire Dentaire',        'مختبر أسنان',                   'clinics_centers', 'FlaskConical',   39, '{"appointments":false,"prescriptions":false,"consultations":false,"lab_results":false,"imaging":false,"stock":true,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false,"prosthetic_orders":true,"lab_materials":true}');

-- ============================================================
-- 7. ENABLE RLS ON ALL NEW TABLES
-- ============================================================

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE admissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_consent_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultation_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ivf_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ivf_protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE ivf_timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE dialysis_machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE dialysis_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prosthetic_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_invoices ENABLE ROW LEVEL SECURITY;

-- RLS: clinic-scoped read for authenticated users
CREATE POLICY "departments_select" ON departments FOR SELECT USING (true);
CREATE POLICY "doctor_departments_select" ON doctor_departments FOR SELECT USING (true);
CREATE POLICY "rooms_select" ON rooms FOR SELECT USING (true);
CREATE POLICY "beds_select" ON beds FOR SELECT USING (true);
CREATE POLICY "admissions_select" ON admissions FOR SELECT USING (true);
CREATE POLICY "photo_consent_forms_select" ON photo_consent_forms FOR SELECT USING (true);
CREATE POLICY "treatment_packages_select" ON treatment_packages FOR SELECT USING (true);
CREATE POLICY "patient_packages_select" ON patient_packages FOR SELECT USING (true);
CREATE POLICY "consultation_photos_select" ON consultation_photos FOR SELECT USING (true);
CREATE POLICY "ivf_cycles_select" ON ivf_cycles FOR SELECT USING (true);
CREATE POLICY "ivf_protocols_select" ON ivf_protocols FOR SELECT USING (true);
CREATE POLICY "ivf_timeline_events_select" ON ivf_timeline_events FOR SELECT USING (true);
CREATE POLICY "dialysis_machines_select" ON dialysis_machines FOR SELECT USING (true);
CREATE POLICY "dialysis_sessions_select" ON dialysis_sessions FOR SELECT USING (true);
CREATE POLICY "prosthetic_orders_select" ON prosthetic_orders FOR SELECT USING (true);
CREATE POLICY "lab_materials_select" ON lab_materials FOR SELECT USING (true);
CREATE POLICY "lab_deliveries_select" ON lab_deliveries FOR SELECT USING (true);
CREATE POLICY "lab_invoices_select" ON lab_invoices FOR SELECT USING (true);

-- RLS: super admin full access
CREATE POLICY "sa_departments_all" ON departments FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "sa_doctor_departments_all" ON doctor_departments FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "sa_rooms_all" ON rooms FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "sa_beds_all" ON beds FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "sa_admissions_all" ON admissions FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "sa_consent_forms_all" ON photo_consent_forms FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "sa_treatment_packages_all" ON treatment_packages FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "sa_patient_packages_all" ON patient_packages FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "sa_consultation_photos_all" ON consultation_photos FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "sa_ivf_cycles_all" ON ivf_cycles FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "sa_ivf_protocols_all" ON ivf_protocols FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "sa_ivf_timeline_all" ON ivf_timeline_events FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "sa_dialysis_machines_all" ON dialysis_machines FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "sa_dialysis_sessions_all" ON dialysis_sessions FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "sa_prosthetic_orders_all" ON prosthetic_orders FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "sa_lab_materials_all" ON lab_materials FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "sa_lab_deliveries_all" ON lab_deliveries FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "sa_lab_invoices_all" ON lab_invoices FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
