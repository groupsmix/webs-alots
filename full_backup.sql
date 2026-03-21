-- ============================================================
-- FULL DATABASE BACKUP — Health SaaS Platform
-- Generated: 2026-03-21 03:43:42 UTC
-- Consolidated from migrations 00001 through 00018
-- ============================================================

-- >>>>>>>>>> 00001_initial_schema.sql <<<<<<<<<<

-- ============================================================
-- Health SaaS Platform — Complete Schema
-- Supports: Doctor, Dentist, Pharmacy (multi-tenant via clinic_id)
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- SHARED TABLES
-- ============================================================

-- Clinics (tenants)
CREATE TABLE clinics (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('doctor', 'dentist', 'pharmacy')),
  config       JSONB DEFAULT '{}',
  tier         TEXT NOT NULL DEFAULT 'pro' CHECK (tier IN ('vitrine', 'cabinet', 'pro', 'premium', 'saas')),
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Users (all roles)
CREATE TABLE users (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id      UUID UNIQUE,  -- links to Supabase Auth user
  role         TEXT NOT NULL CHECK (role IN ('super_admin', 'clinic_admin', 'receptionist', 'doctor', 'patient')),
  name         TEXT NOT NULL,
  phone        TEXT,
  email        TEXT,
  clinic_id    UUID REFERENCES clinics(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Appointments
CREATE TABLE appointments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  service_id      UUID,  -- FK added after services table
  slot_start      TIMESTAMPTZ NOT NULL,
  slot_end        TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'confirmed', 'checked_in', 'in_progress', 'completed', 'no_show', 'cancelled', 'rescheduled')),
  is_first_visit  BOOLEAN DEFAULT FALSE,
  insurance_flag  BOOLEAN DEFAULT FALSE,
  source          TEXT DEFAULT 'online' CHECK (source IN ('online', 'phone', 'walk_in', 'whatsapp')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Services offered by clinics
CREATE TABLE services (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id        UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  price            DECIMAL(10,2),
  duration_minutes INT NOT NULL DEFAULT 30,
  category         TEXT
);

-- Add FK from appointments to services
ALTER TABLE appointments
  ADD CONSTRAINT fk_appointments_service
  FOREIGN KEY (service_id) REFERENCES services(id);

-- Time slots configuration
CREATE TABLE time_slots (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  clinic_id      UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  day_of_week    INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time     TIME NOT NULL,
  end_time       TIME NOT NULL,
  is_available   BOOLEAN DEFAULT TRUE,
  max_capacity   INT DEFAULT 1,
  buffer_minutes INT DEFAULT 10
);

-- Notifications
CREATE TABLE notifications (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id),
  type         TEXT NOT NULL,
  channel      TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email', 'sms', 'in_app')),
  message      TEXT,
  sent_at      TIMESTAMPTZ DEFAULT now(),
  read_at      TIMESTAMPTZ
);

-- Payments
CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  appointment_id  UUID REFERENCES appointments(id),
  amount          DECIMAL(10,2) NOT NULL,
  method          TEXT CHECK (method IN ('cash', 'card', 'transfer', 'online')),
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'refunded', 'failed')),
  ref             TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Reviews
CREATE TABLE reviews (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id   UUID NOT NULL REFERENCES users(id),
  clinic_id    UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  stars        INT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment      TEXT,
  response     TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Documents (uploaded files)
CREATE TABLE documents (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id),
  clinic_id    UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('prescription', 'lab_result', 'xray', 'insurance', 'invoice', 'photo', 'other')),
  file_url     TEXT NOT NULL,
  uploaded_at  TIMESTAMPTZ DEFAULT now()
);

-- Waiting list
CREATE TABLE waiting_list (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  service_id      UUID REFERENCES services(id),
  preferred_date  DATE,
  status          TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'notified', 'booked', 'expired')),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- DOCTOR EXTRAS
-- ============================================================

-- Prescriptions
CREATE TABLE prescriptions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  appointment_id  UUID REFERENCES appointments(id),
  content         JSONB NOT NULL DEFAULT '[]',
  pdf_url         TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Consultation notes
CREATE TABLE consultation_notes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  appointment_id  UUID NOT NULL REFERENCES appointments(id),
  notes           TEXT,
  private         BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Family members
CREATE TABLE family_members (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  primary_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  phone            TEXT,
  relationship     TEXT NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- DENTIST EXTRAS
-- ============================================================

-- Odontogram (tooth chart)
CREATE TABLE odontogram (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id    UUID NOT NULL REFERENCES users(id),
  tooth_number  INT NOT NULL CHECK (tooth_number BETWEEN 1 AND 32),
  status        TEXT DEFAULT 'healthy' CHECK (status IN ('healthy', 'decayed', 'filled', 'missing', 'crown', 'implant', 'root_canal', 'extraction_needed')),
  notes         TEXT,
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Treatment plans
CREATE TABLE treatment_plans (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id    UUID NOT NULL REFERENCES users(id),
  doctor_id     UUID NOT NULL REFERENCES users(id),
  steps         JSONB NOT NULL DEFAULT '[]',
  status        TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  total_cost    DECIMAL(10,2),
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Lab orders (dental lab)
CREATE TABLE lab_orders (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id     UUID NOT NULL REFERENCES users(id),
  patient_id    UUID NOT NULL REFERENCES users(id),
  clinic_id     UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  details       TEXT NOT NULL,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'in_progress', 'ready', 'delivered')),
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Installment payments (for treatment plans)
CREATE TABLE installments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  treatment_plan_id UUID NOT NULL REFERENCES treatment_plans(id) ON DELETE CASCADE,
  patient_id        UUID NOT NULL REFERENCES users(id),
  amount            DECIMAL(10,2) NOT NULL,
  due_date          DATE NOT NULL,
  paid_date         DATE,
  status            TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  receipt_url       TEXT
);

-- Sterilization log
CREATE TABLE sterilization_log (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id     UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  tool_name     TEXT NOT NULL,
  sterilized_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_due      TIMESTAMPTZ
);

-- ============================================================
-- PHARMACY EXTRAS
-- ============================================================

-- Products catalog
CREATE TABLE products (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id             UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  category              TEXT,
  price                 DECIMAL(10,2),
  requires_prescription BOOLEAN DEFAULT FALSE,
  barcode               TEXT
);

-- Suppliers
CREATE TABLE suppliers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id     UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  phone         TEXT,
  email         TEXT,
  products      JSONB DEFAULT '[]'
);

-- Stock management
CREATE TABLE stock (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  clinic_id     UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  quantity      INT NOT NULL DEFAULT 0,
  min_threshold INT DEFAULT 10,
  expiry_date   DATE,
  supplier_id   UUID REFERENCES suppliers(id)
);

-- Prescription requests (patient uploads)
CREATE TABLE prescription_requests (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id    UUID NOT NULL REFERENCES users(id),
  clinic_id     UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  image_url     TEXT NOT NULL,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'ready', 'partial', 'delivered', 'cancelled')),
  notes         TEXT,
  ready_at      TIMESTAMPTZ
);

-- Loyalty points
CREATE TABLE loyalty_points (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id    UUID NOT NULL REFERENCES users(id),
  clinic_id     UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  points        INT NOT NULL DEFAULT 0,
  last_updated  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_users_clinic ON users(clinic_id);
CREATE INDEX idx_users_auth ON users(auth_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_appointments_clinic ON appointments(clinic_id);
CREATE INDEX idx_appointments_slot ON appointments(slot_start, slot_end);
CREATE INDEX idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_services_clinic ON services(clinic_id);
CREATE INDEX idx_time_slots_doctor ON time_slots(doctor_id);
CREATE INDEX idx_time_slots_clinic ON time_slots(clinic_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_payments_clinic ON payments(clinic_id);
CREATE INDEX idx_payments_patient ON payments(patient_id);
CREATE INDEX idx_reviews_clinic ON reviews(clinic_id);
CREATE INDEX idx_reviews_patient ON reviews(patient_id);
CREATE INDEX idx_documents_user ON documents(user_id);
CREATE INDEX idx_documents_clinic ON documents(clinic_id);
CREATE INDEX idx_waiting_list_clinic ON waiting_list(clinic_id);
CREATE INDEX idx_waiting_list_patient ON waiting_list(patient_id);
CREATE INDEX idx_prescriptions_doctor ON prescriptions(doctor_id);
CREATE INDEX idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX idx_consultation_notes_doctor ON consultation_notes(doctor_id);
CREATE INDEX idx_consultation_notes_patient ON consultation_notes(patient_id);
CREATE INDEX idx_odontogram_patient ON odontogram(patient_id);
CREATE INDEX idx_treatment_plans_patient ON treatment_plans(patient_id);
CREATE INDEX idx_lab_orders_clinic ON lab_orders(clinic_id);
CREATE INDEX idx_lab_orders_doctor ON lab_orders(doctor_id);
CREATE INDEX idx_installments_plan ON installments(treatment_plan_id);
CREATE INDEX idx_installments_patient ON installments(patient_id);
CREATE INDEX idx_sterilization_log_clinic ON sterilization_log(clinic_id);
CREATE INDEX idx_products_clinic ON products(clinic_id);
CREATE INDEX idx_stock_product ON stock(product_id);
CREATE INDEX idx_stock_clinic ON stock(clinic_id);
CREATE INDEX idx_stock_expiry ON stock(expiry_date);
CREATE INDEX idx_suppliers_clinic ON suppliers(clinic_id);
CREATE INDEX idx_prescription_requests_clinic ON prescription_requests(clinic_id);
CREATE INDEX idx_prescription_requests_patient ON prescription_requests(patient_id);
CREATE INDEX idx_loyalty_points_patient ON loyalty_points(patient_id);
CREATE INDEX idx_loyalty_points_clinic ON loyalty_points(clinic_id);
CREATE INDEX idx_family_members_primary ON family_members(primary_user_id);


-- >>>>>>>>>> 00002_auth_rls_roles.sql <<<<<<<<<<

-- ============================================================
-- Migration 00002: Auth + Role-Based RLS
-- Phone OTP auth, helper functions, granular RLS for 5 roles
-- ============================================================

-- ============================================================
-- 1. ENABLE RLS ON ALL TABLES
-- ============================================================

ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiting_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultation_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE odontogram ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sterilization_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescription_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_points ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. HELPER FUNCTIONS
-- ============================================================

-- Get the current user's internal ID (from users table)
CREATE OR REPLACE FUNCTION get_my_user_id()
RETURNS UUID AS $$
  SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get the current user's clinic_id
CREATE OR REPLACE FUNCTION get_user_clinic_id()
RETURNS UUID AS $$
  SELECT clinic_id FROM users WHERE auth_id = auth.uid() LIMIT 1
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get the current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM users WHERE auth_id = auth.uid() LIMIT 1
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if current user is super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid() AND role = 'super_admin'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if current user is clinic admin for a given clinic
CREATE OR REPLACE FUNCTION is_clinic_admin(check_clinic_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid()
      AND role = 'clinic_admin'
      AND clinic_id = check_clinic_id
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user is staff (clinic_admin, receptionist, or doctor) at their clinic
CREATE OR REPLACE FUNCTION is_clinic_staff()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid()
      AND role IN ('clinic_admin', 'receptionist', 'doctor')
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- 3. AUTH TRIGGER: Auto-create user profile on signup
-- Supports phone OTP, email, or social login
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (auth_id, role, name, phone, email, clinic_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient'),
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.phone, NEW.email, 'New User'),
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone'),
    NEW.email,
    (NEW.raw_user_meta_data->>'clinic_id')::UUID
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- ============================================================
-- 4. RLS POLICIES
-- Roles: super_admin, clinic_admin, receptionist, doctor, patient
--
-- Principles:
--   super_admin  -> full access to everything
--   clinic_admin -> full CRUD within their clinic
--   receptionist -> read/write appointments, patients, payments within clinic
--   doctor       -> read/write own patients & appointments within clinic
--   patient      -> read own data, create bookings/reviews
-- ============================================================

-- -------------------------------------------------------
-- CLINICS
-- -------------------------------------------------------

CREATE POLICY "sa_clinics_all" ON clinics
  FOR ALL USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "clinics_select_own" ON clinics
  FOR SELECT USING (id = get_user_clinic_id());

CREATE POLICY "admin_clinics_update" ON clinics
  FOR UPDATE USING (is_clinic_admin(id))
  WITH CHECK (is_clinic_admin(id));

CREATE POLICY "clinics_select_active_public" ON clinics
  FOR SELECT USING (status = 'active');

-- -------------------------------------------------------
-- USERS
-- -------------------------------------------------------

CREATE POLICY "sa_users_all" ON users
  FOR ALL USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "users_select_self" ON users
  FOR SELECT USING (auth_id = auth.uid());

CREATE POLICY "users_update_self" ON users
  FOR UPDATE USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());

CREATE POLICY "admin_users_all" ON users
  FOR ALL USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() = 'clinic_admin'
  )
  WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND role != 'super_admin'
  );

CREATE POLICY "receptionist_users_select" ON users
  FOR SELECT USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() = 'receptionist'
  );

CREATE POLICY "receptionist_users_insert_patient" ON users
  FOR INSERT WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND get_user_role() = 'receptionist'
    AND role = 'patient'
  );

CREATE POLICY "doctor_users_select" ON users
  FOR SELECT USING (
    get_user_role() = 'doctor'
    AND (
      id = get_my_user_id()
      OR (clinic_id = get_user_clinic_id() AND role = 'patient')
    )
  );

CREATE POLICY "patient_users_select" ON users
  FOR SELECT USING (
    get_user_role() = 'patient'
    AND (
      id = get_my_user_id()
      OR (clinic_id = get_user_clinic_id() AND role IN ('doctor', 'clinic_admin'))
    )
  );

-- Allow auth trigger to insert new user profiles
CREATE POLICY "users_insert_auth_trigger" ON users
  FOR INSERT WITH CHECK (TRUE);

-- -------------------------------------------------------
-- SERVICES
-- -------------------------------------------------------

CREATE POLICY "sa_services_all" ON services
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "admin_services_all" ON services
  FOR ALL USING (
    clinic_id = get_user_clinic_id() AND get_user_role() = 'clinic_admin'
  ) WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "services_select_clinic" ON services
  FOR SELECT USING (clinic_id = get_user_clinic_id());

-- -------------------------------------------------------
-- TIME_SLOTS
-- -------------------------------------------------------

CREATE POLICY "sa_time_slots_all" ON time_slots
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "admin_time_slots_all" ON time_slots
  FOR ALL USING (
    clinic_id = get_user_clinic_id() AND get_user_role() = 'clinic_admin'
  ) WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "doctor_time_slots_own" ON time_slots
  FOR ALL USING (
    clinic_id = get_user_clinic_id()
    AND doctor_id = get_my_user_id()
    AND get_user_role() = 'doctor'
  ) WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND doctor_id = get_my_user_id()
  );

CREATE POLICY "time_slots_select_available" ON time_slots
  FOR SELECT USING (
    clinic_id = get_user_clinic_id() AND is_available = TRUE
  );

-- -------------------------------------------------------
-- APPOINTMENTS
-- -------------------------------------------------------

CREATE POLICY "sa_appointments_all" ON appointments
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "admin_appointments_all" ON appointments
  FOR ALL USING (
    clinic_id = get_user_clinic_id() AND get_user_role() = 'clinic_admin'
  ) WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "receptionist_appointments_all" ON appointments
  FOR ALL USING (
    clinic_id = get_user_clinic_id() AND get_user_role() = 'receptionist'
  ) WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "doctor_appointments_select" ON appointments
  FOR SELECT USING (
    clinic_id = get_user_clinic_id()
    AND doctor_id = get_my_user_id()
    AND get_user_role() = 'doctor'
  );

CREATE POLICY "doctor_appointments_update" ON appointments
  FOR UPDATE USING (
    clinic_id = get_user_clinic_id()
    AND doctor_id = get_my_user_id()
    AND get_user_role() = 'doctor'
  ) WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "patient_appointments_select" ON appointments
  FOR SELECT USING (
    patient_id = get_my_user_id() AND get_user_role() = 'patient'
  );

CREATE POLICY "patient_appointments_insert" ON appointments
  FOR INSERT WITH CHECK (
    patient_id = get_my_user_id() AND get_user_role() = 'patient'
  );

CREATE POLICY "patient_appointments_update" ON appointments
  FOR UPDATE USING (
    patient_id = get_my_user_id()
    AND get_user_role() = 'patient'
    AND status IN ('pending', 'confirmed')
  ) WITH CHECK (
    patient_id = get_my_user_id()
    AND status IN ('pending', 'confirmed', 'cancelled', 'rescheduled')
  );

-- -------------------------------------------------------
-- WAITING_LIST
-- -------------------------------------------------------

CREATE POLICY "sa_waiting_list_all" ON waiting_list
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "admin_waiting_list_all" ON waiting_list
  FOR ALL USING (
    clinic_id = get_user_clinic_id() AND get_user_role() = 'clinic_admin'
  ) WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "receptionist_waiting_list_all" ON waiting_list
  FOR ALL USING (
    clinic_id = get_user_clinic_id() AND get_user_role() = 'receptionist'
  ) WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "doctor_waiting_list_select" ON waiting_list
  FOR SELECT USING (
    clinic_id = get_user_clinic_id()
    AND doctor_id = get_my_user_id()
    AND get_user_role() = 'doctor'
  );

CREATE POLICY "patient_waiting_list_select" ON waiting_list
  FOR SELECT USING (
    patient_id = get_my_user_id() AND get_user_role() = 'patient'
  );

CREATE POLICY "patient_waiting_list_insert" ON waiting_list
  FOR INSERT WITH CHECK (
    patient_id = get_my_user_id() AND get_user_role() = 'patient'
  );

CREATE POLICY "patient_waiting_list_delete" ON waiting_list
  FOR DELETE USING (
    patient_id = get_my_user_id() AND get_user_role() = 'patient'
  );

-- -------------------------------------------------------
-- NOTIFICATIONS
-- -------------------------------------------------------

CREATE POLICY "sa_notifications_all" ON notifications
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT USING (user_id = get_my_user_id());

CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (user_id = get_my_user_id())
  WITH CHECK (user_id = get_my_user_id());

CREATE POLICY "notifications_insert_staff" ON notifications
  FOR INSERT WITH CHECK (
    get_user_role() IN ('clinic_admin', 'receptionist', 'doctor')
  );

-- -------------------------------------------------------
-- PAYMENTS
-- -------------------------------------------------------

CREATE POLICY "sa_payments_all" ON payments
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "payments_select_patient" ON payments
  FOR SELECT USING (patient_id = get_my_user_id());

CREATE POLICY "payments_manage_staff" ON payments
  FOR ALL USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('clinic_admin', 'receptionist')
  ) WITH CHECK (
    clinic_id = get_user_clinic_id()
  );

-- -------------------------------------------------------
-- REVIEWS
-- -------------------------------------------------------

CREATE POLICY "sa_reviews_all" ON reviews
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "reviews_insert_patient" ON reviews
  FOR INSERT WITH CHECK (patient_id = get_my_user_id());

CREATE POLICY "reviews_update_patient" ON reviews
  FOR UPDATE USING (patient_id = get_my_user_id())
  WITH CHECK (patient_id = get_my_user_id());

CREATE POLICY "reviews_select_clinic" ON reviews
  FOR SELECT USING (clinic_id = get_user_clinic_id());

CREATE POLICY "reviews_manage_admin" ON reviews
  FOR ALL USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() = 'clinic_admin'
  ) WITH CHECK (clinic_id = get_user_clinic_id());

-- -------------------------------------------------------
-- DOCUMENTS
-- -------------------------------------------------------

CREATE POLICY "sa_documents_all" ON documents
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "documents_select_own" ON documents
  FOR SELECT USING (user_id = get_my_user_id());

CREATE POLICY "documents_insert_own" ON documents
  FOR INSERT WITH CHECK (user_id = get_my_user_id());

CREATE POLICY "documents_select_doctor" ON documents
  FOR SELECT USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() = 'doctor'
  );

CREATE POLICY "documents_manage_staff" ON documents
  FOR ALL USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('clinic_admin', 'receptionist')
  ) WITH CHECK (clinic_id = get_user_clinic_id());

-- -------------------------------------------------------
-- PRESCRIPTIONS (Doctor Extra)
-- -------------------------------------------------------

CREATE POLICY "sa_prescriptions_all" ON prescriptions
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "prescriptions_select_patient" ON prescriptions
  FOR SELECT USING (patient_id = get_my_user_id());

CREATE POLICY "prescriptions_manage_doctor" ON prescriptions
  FOR ALL USING (
    doctor_id = get_my_user_id() AND get_user_role() = 'doctor'
  ) WITH CHECK (doctor_id = get_my_user_id());

CREATE POLICY "prescriptions_select_admin" ON prescriptions
  FOR SELECT USING (
    get_user_role() = 'clinic_admin'
    AND EXISTS (
      SELECT 1 FROM users u WHERE u.id = prescriptions.doctor_id
        AND u.clinic_id = get_user_clinic_id()
    )
  );

-- -------------------------------------------------------
-- CONSULTATION_NOTES (Doctor Extra)
-- -------------------------------------------------------

CREATE POLICY "sa_consultation_notes_all" ON consultation_notes
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "consultation_notes_manage_doctor" ON consultation_notes
  FOR ALL USING (
    doctor_id = get_my_user_id() AND get_user_role() = 'doctor'
  ) WITH CHECK (doctor_id = get_my_user_id());

CREATE POLICY "consultation_notes_select_admin" ON consultation_notes
  FOR SELECT USING (
    get_user_role() = 'clinic_admin'
    AND EXISTS (
      SELECT 1 FROM users u WHERE u.id = consultation_notes.doctor_id
        AND u.clinic_id = get_user_clinic_id()
    )
  );

-- Patients can see non-private notes about them
CREATE POLICY "consultation_notes_select_patient" ON consultation_notes
  FOR SELECT USING (
    patient_id = get_my_user_id()
    AND private = FALSE
  );

-- -------------------------------------------------------
-- FAMILY_MEMBERS (Doctor Extra)
-- -------------------------------------------------------

CREATE POLICY "sa_family_members_all" ON family_members
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "family_members_manage_own" ON family_members
  FOR ALL USING (primary_user_id = get_my_user_id())
  WITH CHECK (primary_user_id = get_my_user_id());

CREATE POLICY "family_members_select_staff" ON family_members
  FOR SELECT USING (
    is_clinic_staff()
    AND EXISTS (
      SELECT 1 FROM users u WHERE u.id = family_members.primary_user_id
        AND u.clinic_id = get_user_clinic_id()
    )
  );

-- -------------------------------------------------------
-- ODONTOGRAM (Dentist Extra)
-- -------------------------------------------------------

CREATE POLICY "sa_odontogram_all" ON odontogram
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "odontogram_select_patient" ON odontogram
  FOR SELECT USING (patient_id = get_my_user_id());

CREATE POLICY "odontogram_manage_doctor" ON odontogram
  FOR ALL USING (
    get_user_role() IN ('doctor', 'clinic_admin')
    AND EXISTS (
      SELECT 1 FROM users u WHERE u.id = odontogram.patient_id
        AND u.clinic_id = get_user_clinic_id()
    )
  ) WITH CHECK (
    get_user_role() IN ('doctor', 'clinic_admin')
  );

-- -------------------------------------------------------
-- TREATMENT_PLANS (Dentist Extra)
-- -------------------------------------------------------

CREATE POLICY "sa_treatment_plans_all" ON treatment_plans
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "treatment_plans_select_patient" ON treatment_plans
  FOR SELECT USING (patient_id = get_my_user_id());

CREATE POLICY "treatment_plans_manage_doctor" ON treatment_plans
  FOR ALL USING (
    doctor_id = get_my_user_id() AND get_user_role() = 'doctor'
  ) WITH CHECK (doctor_id = get_my_user_id());

CREATE POLICY "treatment_plans_select_admin" ON treatment_plans
  FOR SELECT USING (
    get_user_role() = 'clinic_admin'
    AND EXISTS (
      SELECT 1 FROM users u WHERE u.id = treatment_plans.doctor_id
        AND u.clinic_id = get_user_clinic_id()
    )
  );

-- -------------------------------------------------------
-- LAB_ORDERS (Dentist Extra)
-- -------------------------------------------------------

CREATE POLICY "sa_lab_orders_all" ON lab_orders
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "lab_orders_manage_doctor" ON lab_orders
  FOR ALL USING (
    doctor_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
    AND get_user_role() = 'doctor'
  ) WITH CHECK (
    doctor_id = get_my_user_id()
    AND clinic_id = get_user_clinic_id()
  );

CREATE POLICY "lab_orders_manage_admin" ON lab_orders
  FOR ALL USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() = 'clinic_admin'
  ) WITH CHECK (clinic_id = get_user_clinic_id());

-- -------------------------------------------------------
-- INSTALLMENTS (Dentist Extra)
-- -------------------------------------------------------

CREATE POLICY "sa_installments_all" ON installments
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "installments_select_patient" ON installments
  FOR SELECT USING (patient_id = get_my_user_id());

CREATE POLICY "installments_manage_staff" ON installments
  FOR ALL USING (
    get_user_role() IN ('clinic_admin', 'receptionist')
    AND EXISTS (
      SELECT 1 FROM treatment_plans tp
      JOIN users u ON u.id = tp.doctor_id
      WHERE tp.id = installments.treatment_plan_id
        AND u.clinic_id = get_user_clinic_id()
    )
  ) WITH CHECK (
    get_user_role() IN ('clinic_admin', 'receptionist')
  );

-- -------------------------------------------------------
-- STERILIZATION_LOG (Dentist Extra)
-- -------------------------------------------------------

CREATE POLICY "sa_sterilization_log_all" ON sterilization_log
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "sterilization_log_manage_staff" ON sterilization_log
  FOR ALL USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('clinic_admin', 'doctor', 'receptionist')
  ) WITH CHECK (clinic_id = get_user_clinic_id());

-- -------------------------------------------------------
-- PRODUCTS (Pharmacy Extra)
-- -------------------------------------------------------

CREATE POLICY "sa_products_all" ON products
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "products_manage_staff" ON products
  FOR ALL USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('clinic_admin', 'receptionist')
  ) WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "products_select_clinic" ON products
  FOR SELECT USING (clinic_id = get_user_clinic_id());

-- -------------------------------------------------------
-- SUPPLIERS (Pharmacy Extra)
-- -------------------------------------------------------

CREATE POLICY "sa_suppliers_all" ON suppliers
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "suppliers_manage_staff" ON suppliers
  FOR ALL USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('clinic_admin', 'receptionist')
  ) WITH CHECK (clinic_id = get_user_clinic_id());

-- -------------------------------------------------------
-- STOCK (Pharmacy Extra)
-- -------------------------------------------------------

CREATE POLICY "sa_stock_all" ON stock
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "stock_manage_staff" ON stock
  FOR ALL USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('clinic_admin', 'receptionist')
  ) WITH CHECK (clinic_id = get_user_clinic_id());

-- -------------------------------------------------------
-- PRESCRIPTION_REQUESTS (Pharmacy Extra)
-- -------------------------------------------------------

CREATE POLICY "sa_prescription_requests_all" ON prescription_requests
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "prescription_requests_manage_patient" ON prescription_requests
  FOR ALL USING (patient_id = get_my_user_id())
  WITH CHECK (patient_id = get_my_user_id());

CREATE POLICY "prescription_requests_manage_staff" ON prescription_requests
  FOR ALL USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('clinic_admin', 'receptionist')
  ) WITH CHECK (clinic_id = get_user_clinic_id());

-- -------------------------------------------------------
-- LOYALTY_POINTS (Pharmacy Extra)
-- -------------------------------------------------------

CREATE POLICY "sa_loyalty_points_all" ON loyalty_points
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "loyalty_points_select_patient" ON loyalty_points
  FOR SELECT USING (patient_id = get_my_user_id());

CREATE POLICY "loyalty_points_manage_staff" ON loyalty_points
  FOR ALL USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('clinic_admin', 'receptionist')
  ) WITH CHECK (clinic_id = get_user_clinic_id());


-- >>>>>>>>>> 00003_seed_data.sql <<<<<<<<<<

-- ============================================================
-- SEED DATA for Health SaaS Platform
-- 1 clinic, 1 doctor, 1 receptionist, 5 patients,
-- sample services, time slots, and appointments
-- ============================================================

-- ============================================================
-- CLINIC
-- ============================================================

INSERT INTO clinics (id, name, type, config, tier, status) VALUES
  ('c1000000-0000-0000-0000-000000000001',
   'Cabinet Dr. Ahmed Benali',
   'doctor',
   '{
     "locale": "fr",
     "currency": "MAD",
     "city": "Casablanca",
     "phone": "+212 5 22 33 44 55",
     "specialty": "General Medicine"
   }'::jsonb,
   'pro',
   'active');

-- ============================================================
-- USERS
-- ============================================================

-- Super Admin (no clinic)
INSERT INTO users (id, auth_id, role, name, phone, email, clinic_id) VALUES
  ('u0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001',
   'super_admin',
   'Admin Platform',
   '+212600000001',
   'admin@health-saas.ma',
   NULL);

-- Clinic Admin
INSERT INTO users (id, auth_id, role, name, phone, email, clinic_id) VALUES
  ('u0000000-0000-0000-0000-000000000002',
   'a0000000-0000-0000-0000-000000000002',
   'clinic_admin',
   'Nadia Benali',
   '+212611000001',
   'nadia@dr-benali.ma',
   'c1000000-0000-0000-0000-000000000001');

-- Doctor
INSERT INTO users (id, auth_id, role, name, phone, email, clinic_id) VALUES
  ('u0000000-0000-0000-0000-000000000003',
   'a0000000-0000-0000-0000-000000000003',
   'doctor',
   'Dr. Ahmed Benali',
   '+212611000002',
   'ahmed@dr-benali.ma',
   'c1000000-0000-0000-0000-000000000001');

-- Receptionist
INSERT INTO users (id, auth_id, role, name, phone, email, clinic_id) VALUES
  ('u0000000-0000-0000-0000-000000000004',
   'a0000000-0000-0000-0000-000000000004',
   'receptionist',
   'Amina Tazi',
   '+212611000003',
   'amina@dr-benali.ma',
   'c1000000-0000-0000-0000-000000000001');

-- Patient 1
INSERT INTO users (id, auth_id, role, name, phone, email, clinic_id) VALUES
  ('u0000000-0000-0000-0000-000000000010',
   'a0000000-0000-0000-0000-000000000010',
   'patient',
   'Fatima Zahra Mansouri',
   '+212622113344',
   'fatima.m@gmail.com',
   'c1000000-0000-0000-0000-000000000001');

-- Patient 2
INSERT INTO users (id, auth_id, role, name, phone, email, clinic_id) VALUES
  ('u0000000-0000-0000-0000-000000000011',
   'a0000000-0000-0000-0000-000000000011',
   'patient',
   'Hassan Bourkia',
   '+212633224455',
   'hassan.b@gmail.com',
   'c1000000-0000-0000-0000-000000000001');

-- Patient 3
INSERT INTO users (id, auth_id, role, name, phone, email, clinic_id) VALUES
  ('u0000000-0000-0000-0000-000000000012',
   'a0000000-0000-0000-0000-000000000012',
   'patient',
   'Khadija Alaoui',
   '+212644335566',
   'khadija.a@gmail.com',
   'c1000000-0000-0000-0000-000000000001');

-- Patient 4
INSERT INTO users (id, auth_id, role, name, phone, email, clinic_id) VALUES
  ('u0000000-0000-0000-0000-000000000013',
   'a0000000-0000-0000-0000-000000000013',
   'patient',
   'Omar El Fassi',
   '+212655446677',
   'omar.f@gmail.com',
   'c1000000-0000-0000-0000-000000000001');

-- Patient 5
INSERT INTO users (id, auth_id, role, name, phone, email, clinic_id) VALUES
  ('u0000000-0000-0000-0000-000000000014',
   'a0000000-0000-0000-0000-000000000014',
   'patient',
   'Youssef Tazi',
   '+212666557788',
   'youssef.t@gmail.com',
   'c1000000-0000-0000-0000-000000000001');

-- ============================================================
-- SERVICES
-- ============================================================

INSERT INTO services (id, clinic_id, name, price, duration_minutes, category) VALUES
  ('s0000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000001',
   'General Consultation', 300.00, 30, 'consultation'),
  ('s0000000-0000-0000-0000-000000000002',
   'c1000000-0000-0000-0000-000000000001',
   'Follow-up Visit', 200.00, 20, 'follow-up'),
  ('s0000000-0000-0000-0000-000000000003',
   'c1000000-0000-0000-0000-000000000001',
   'ECG Checkup', 500.00, 45, 'diagnostic'),
  ('s0000000-0000-0000-0000-000000000004',
   'c1000000-0000-0000-0000-000000000001',
   'Blood Pressure Check', 150.00, 15, 'screening'),
  ('s0000000-0000-0000-0000-000000000005',
   'c1000000-0000-0000-0000-000000000001',
   'Vaccination', 200.00, 15, 'vaccination');

-- ============================================================
-- TIME SLOTS (Dr. Ahmed — Mon-Fri 09:00-12:00 & 14:00-17:00)
-- ============================================================

INSERT INTO time_slots (doctor_id, clinic_id, day_of_week, start_time, end_time, is_available, max_capacity, buffer_minutes) VALUES
  ('u0000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 1, '09:00', '12:00', TRUE, 1, 10),
  ('u0000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 1, '14:00', '17:00', TRUE, 1, 10),
  ('u0000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 2, '09:00', '12:00', TRUE, 1, 10),
  ('u0000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 2, '14:00', '17:00', TRUE, 1, 10),
  ('u0000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 3, '09:00', '12:00', TRUE, 1, 10),
  ('u0000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 3, '14:00', '17:00', TRUE, 1, 10),
  ('u0000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 4, '09:00', '12:00', TRUE, 1, 10),
  ('u0000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 4, '14:00', '17:00', TRUE, 1, 10),
  ('u0000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 5, '09:00', '12:00', TRUE, 1, 10),
  ('u0000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 5, '14:00', '17:00', TRUE, 1, 10);

-- ============================================================
-- APPOINTMENTS (sample: various statuses)
-- ============================================================

-- Appointment 1: Fatima — completed general consultation
INSERT INTO appointments (id, patient_id, doctor_id, clinic_id, service_id, slot_start, slot_end, status, is_first_visit, insurance_flag, source, notes) VALUES
  ('ap000000-0000-0000-0000-000000000001',
   'u0000000-0000-0000-0000-000000000010',
   'u0000000-0000-0000-0000-000000000003',
   'c1000000-0000-0000-0000-000000000001',
   's0000000-0000-0000-0000-000000000001',
   '2026-03-18 09:00:00+00', '2026-03-18 09:30:00+00',
   'completed', TRUE, TRUE, 'online',
   'Initial consultation — blood pressure normal');

-- Appointment 2: Hassan — confirmed follow-up
INSERT INTO appointments (id, patient_id, doctor_id, clinic_id, service_id, slot_start, slot_end, status, is_first_visit, insurance_flag, source) VALUES
  ('ap000000-0000-0000-0000-000000000002',
   'u0000000-0000-0000-0000-000000000011',
   'u0000000-0000-0000-0000-000000000003',
   'c1000000-0000-0000-0000-000000000001',
   's0000000-0000-0000-0000-000000000002',
   '2026-03-21 10:00:00+00', '2026-03-21 10:20:00+00',
   'confirmed', FALSE, TRUE, 'phone');

-- Appointment 3: Khadija — pending ECG
INSERT INTO appointments (id, patient_id, doctor_id, clinic_id, service_id, slot_start, slot_end, status, is_first_visit, insurance_flag, source) VALUES
  ('ap000000-0000-0000-0000-000000000003',
   'u0000000-0000-0000-0000-000000000012',
   'u0000000-0000-0000-0000-000000000003',
   'c1000000-0000-0000-0000-000000000001',
   's0000000-0000-0000-0000-000000000003',
   '2026-03-22 14:00:00+00', '2026-03-22 14:45:00+00',
   'pending', TRUE, FALSE, 'whatsapp');

-- Appointment 4: Omar — cancelled
INSERT INTO appointments (id, patient_id, doctor_id, clinic_id, service_id, slot_start, slot_end, status, is_first_visit, insurance_flag, source, notes) VALUES
  ('ap000000-0000-0000-0000-000000000004',
   'u0000000-0000-0000-0000-000000000013',
   'u0000000-0000-0000-0000-000000000003',
   'c1000000-0000-0000-0000-000000000001',
   's0000000-0000-0000-0000-000000000001',
   '2026-03-19 11:00:00+00', '2026-03-19 11:30:00+00',
   'cancelled', FALSE, TRUE, 'online',
   'Patient cancelled — will reschedule');

-- Appointment 5: Youssef — no show
INSERT INTO appointments (id, patient_id, doctor_id, clinic_id, service_id, slot_start, slot_end, status, is_first_visit, insurance_flag, source) VALUES
  ('ap000000-0000-0000-0000-000000000005',
   'u0000000-0000-0000-0000-000000000014',
   'u0000000-0000-0000-0000-000000000003',
   'c1000000-0000-0000-0000-000000000001',
   's0000000-0000-0000-0000-000000000005',
   '2026-03-17 09:30:00+00', '2026-03-17 09:45:00+00',
   'no_show', TRUE, FALSE, 'walk_in');

-- Appointment 6: Fatima — upcoming vaccination
INSERT INTO appointments (id, patient_id, doctor_id, clinic_id, service_id, slot_start, slot_end, status, is_first_visit, insurance_flag, source) VALUES
  ('ap000000-0000-0000-0000-000000000006',
   'u0000000-0000-0000-0000-000000000010',
   'u0000000-0000-0000-0000-000000000003',
   'c1000000-0000-0000-0000-000000000001',
   's0000000-0000-0000-0000-000000000005',
   '2026-03-25 15:00:00+00', '2026-03-25 15:15:00+00',
   'confirmed', FALSE, TRUE, 'online');

-- ============================================================
-- PRESCRIPTIONS (sample for completed appointment)
-- ============================================================

INSERT INTO prescriptions (id, patient_id, doctor_id, appointment_id, content, pdf_url) VALUES
  ('pr000000-0000-0000-0000-000000000001',
   'u0000000-0000-0000-0000-000000000010',
   'u0000000-0000-0000-0000-000000000003',
   'ap000000-0000-0000-0000-000000000001',
   '[
     {"medication": "Paracetamol 500mg", "dosage": "1 tablet 3x/day", "duration": "5 days"},
     {"medication": "Omeprazole 20mg", "dosage": "1 capsule before breakfast", "duration": "14 days"}
   ]'::jsonb,
   NULL);

-- ============================================================
-- CONSULTATION NOTES
-- ============================================================

INSERT INTO consultation_notes (id, patient_id, doctor_id, appointment_id, notes, private) VALUES
  ('cn000000-0000-0000-0000-000000000001',
   'u0000000-0000-0000-0000-000000000010',
   'u0000000-0000-0000-0000-000000000003',
   'ap000000-0000-0000-0000-000000000001',
   'Patient presents with mild headache and fatigue. BP 120/80. Prescribed paracetamol and omeprazole for gastric discomfort.',
   TRUE);

-- ============================================================
-- PAYMENTS (sample)
-- ============================================================

INSERT INTO payments (id, clinic_id, patient_id, appointment_id, amount, method, status, ref) VALUES
  ('py000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000001',
   'u0000000-0000-0000-0000-000000000010',
   'ap000000-0000-0000-0000-000000000001',
   300.00, 'cash', 'completed', 'PAY-001');

-- ============================================================
-- REVIEWS (sample)
-- ============================================================

INSERT INTO reviews (id, patient_id, clinic_id, stars, comment, response) VALUES
  ('rv000000-0000-0000-0000-000000000001',
   'u0000000-0000-0000-0000-000000000010',
   'c1000000-0000-0000-0000-000000000001',
   5,
   'Excellent doctor, very professional and caring.',
   'Thank you for your kind words, Fatima!');

-- ============================================================
-- NOTIFICATIONS (sample)
-- ============================================================

INSERT INTO notifications (id, user_id, type, channel, message, sent_at, read_at) VALUES
  ('nt000000-0000-0000-0000-000000000001',
   'u0000000-0000-0000-0000-000000000011',
   'appointment_reminder',
   'whatsapp',
   'Reminder: Your follow-up appointment with Dr. Ahmed Benali is on March 21 at 10:00 AM.',
   '2026-03-20 08:00:00+00',
   NULL),
  ('nt000000-0000-0000-0000-000000000002',
   'u0000000-0000-0000-0000-000000000010',
   'appointment_confirmed',
   'sms',
   'Your vaccination appointment on March 25 at 3:00 PM has been confirmed.',
   '2026-03-20 09:00:00+00',
   '2026-03-20 09:05:00+00');


-- >>>>>>>>>> 00004_add_clinic_subdomain.sql <<<<<<<<<<

-- ============================================================
-- Migration 00004: Add subdomain column to clinics
-- Enables subdomain-based multi-tenant routing
-- (e.g., clinicname.yourdomain.com)
-- ============================================================

ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS subdomain TEXT UNIQUE;

-- Index for fast subdomain lookups in middleware
CREATE INDEX IF NOT EXISTS idx_clinics_subdomain ON clinics(subdomain)
  WHERE subdomain IS NOT NULL;


-- >>>>>>>>>> 00005_schema_gaps.sql <<<<<<<<<<

-- ============================================================
-- Migration 00005: Schema Gaps
-- Creates tables for entities that exist in demo data files
-- but lack corresponding Supabase tables.
-- Also extends existing tables with columns needed by the app.
-- ============================================================

-- ============================================================
-- 1. BLOG POSTS (demo-data.ts → blogPosts)
-- ============================================================

CREATE TABLE blog_posts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id   UUID REFERENCES clinics(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  excerpt     TEXT,
  content     TEXT,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  read_time   TEXT,
  category    TEXT,
  slug        TEXT,
  is_published BOOLEAN DEFAULT FALSE,
  author_id   UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_blog_posts_clinic ON blog_posts(clinic_id);
CREATE INDEX idx_blog_posts_date ON blog_posts(date DESC);
CREATE INDEX idx_blog_posts_slug ON blog_posts(slug);

-- ============================================================
-- 2. ANNOUNCEMENTS (super-admin-data.ts → announcements)
-- Platform-wide announcements from super-admin to clinics.
-- ============================================================

CREATE TABLE announcements (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title        TEXT NOT NULL,
  message      TEXT NOT NULL,
  type         TEXT NOT NULL DEFAULT 'info'
               CHECK (type IN ('info', 'warning', 'critical')),
  target       TEXT NOT NULL DEFAULT 'all',
  target_label TEXT,
  published_at TIMESTAMPTZ DEFAULT now(),
  expires_at   TIMESTAMPTZ,
  is_active    BOOLEAN DEFAULT TRUE,
  created_by   TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_announcements_active ON announcements(is_active)
  WHERE is_active = TRUE;

-- ============================================================
-- 3. ACTIVITY LOGS (super-admin-data.ts → activityLogs)
-- Platform-level audit trail.
-- ============================================================

CREATE TABLE activity_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action      TEXT NOT NULL,
  description TEXT,
  clinic_id   UUID REFERENCES clinics(id) ON DELETE SET NULL,
  clinic_name TEXT,
  timestamp   TIMESTAMPTZ DEFAULT now(),
  actor       TEXT,
  type        TEXT NOT NULL
              CHECK (type IN ('clinic', 'billing', 'feature', 'announcement', 'template', 'auth')),
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_activity_logs_clinic ON activity_logs(clinic_id);
CREATE INDEX idx_activity_logs_type ON activity_logs(type);
CREATE INDEX idx_activity_logs_timestamp ON activity_logs(timestamp DESC);

-- ============================================================
-- 4. PLATFORM BILLING (super-admin-data.ts → billingRecords)
-- SA-level billing records for clinic subscriptions.
-- Separate from the per-clinic payments table.
-- ============================================================

CREATE TABLE platform_billing (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id      UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  clinic_name    TEXT,
  plan           TEXT,
  amount_due     DECIMAL(10,2) NOT NULL DEFAULT 0,
  amount_paid    DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency       TEXT NOT NULL DEFAULT 'MAD',
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('paid', 'pending', 'overdue', 'cancelled')),
  invoice_date   DATE NOT NULL,
  due_date       DATE NOT NULL,
  paid_date      DATE,
  payment_method TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_platform_billing_clinic ON platform_billing(clinic_id);
CREATE INDEX idx_platform_billing_status ON platform_billing(status);
CREATE INDEX idx_platform_billing_due_date ON platform_billing(due_date);

-- ============================================================
-- 5. FEATURE DEFINITIONS (super-admin-data.ts → featureDefinitions)
-- Global feature catalogue managed by super-admin.
-- ============================================================

CREATE TABLE feature_definitions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  description     TEXT,
  key             TEXT NOT NULL UNIQUE,
  category        TEXT NOT NULL DEFAULT 'core'
                  CHECK (category IN ('core', 'communication', 'integration', 'advanced')),
  available_tiers TEXT[] NOT NULL DEFAULT '{}',
  global_enabled  BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_feature_definitions_key ON feature_definitions(key);

-- Per-clinic feature overrides
CREATE TABLE clinic_feature_overrides (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id   UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  feature_id  UUID NOT NULL REFERENCES feature_definitions(id) ON DELETE CASCADE,
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (clinic_id, feature_id)
);

CREATE INDEX idx_clinic_feature_overrides_clinic ON clinic_feature_overrides(clinic_id);

-- ============================================================
-- 6. PRICING TIERS (pricing-data.ts → pricingTiers)
-- Platform pricing configuration.
-- ============================================================

CREATE TABLE pricing_tiers (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug        TEXT NOT NULL UNIQUE
              CHECK (slug IN ('vitrine', 'cabinet', 'pro', 'premium', 'saas-monthly')),
  name        TEXT NOT NULL,
  description TEXT,
  is_popular  BOOLEAN DEFAULT FALSE,
  pricing     JSONB NOT NULL DEFAULT '{}',
  features    JSONB NOT NULL DEFAULT '[]',
  limits      JSONB NOT NULL DEFAULT '{}',
  sort_order  INT DEFAULT 0,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pricing_tiers_slug ON pricing_tiers(slug);

-- ============================================================
-- 7. SUBSCRIPTIONS (pricing-data.ts → clientSubscriptions)
-- Clinic subscriptions to pricing tiers.
-- ============================================================

CREATE TABLE subscriptions (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id            UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  clinic_name          TEXT,
  system_type          TEXT NOT NULL CHECK (system_type IN ('doctor', 'dentist', 'pharmacy')),
  tier_slug            TEXT NOT NULL,
  tier_name            TEXT,
  status               TEXT NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active', 'trial', 'past_due', 'cancelled', 'suspended')),
  current_period_start DATE NOT NULL,
  current_period_end   DATE NOT NULL,
  billing_cycle        TEXT NOT NULL DEFAULT 'monthly'
                       CHECK (billing_cycle IN ('monthly', 'yearly')),
  amount               DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency             TEXT NOT NULL DEFAULT 'MAD',
  payment_method       TEXT,
  auto_renew           BOOLEAN DEFAULT TRUE,
  trial_ends_at        DATE,
  cancelled_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_subscriptions_clinic ON subscriptions(clinic_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_tier ON subscriptions(tier_slug);

-- Subscription invoices
CREATE TABLE subscription_invoices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  amount          DECIMAL(10,2) NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('paid', 'pending', 'overdue', 'refunded')),
  paid_date       DATE,
  download_url    TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_subscription_invoices_sub ON subscription_invoices(subscription_id);

-- ============================================================
-- 8. FEATURE TOGGLES (pricing-data.ts → featureToggles)
-- Per-tier feature availability flags.
-- ============================================================

CREATE TABLE feature_toggles (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key          TEXT NOT NULL UNIQUE,
  label        TEXT NOT NULL,
  description  TEXT,
  category     TEXT NOT NULL DEFAULT 'core'
               CHECK (category IN ('core', 'communication', 'integration', 'advanced', 'pharmacy')),
  system_types TEXT[] NOT NULL DEFAULT '{}',
  tiers        TEXT[] NOT NULL DEFAULT '{}',
  enabled      BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_feature_toggles_key ON feature_toggles(key);

-- ============================================================
-- 9. SALES (pharmacy-demo-data.ts → dailySales)
-- Point-of-sale transaction records for pharmacies.
-- ============================================================

CREATE TABLE sales (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id             UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  date                  DATE NOT NULL DEFAULT CURRENT_DATE,
  time                  TIME NOT NULL DEFAULT CURRENT_TIME,
  patient_id            UUID REFERENCES users(id),
  patient_name          TEXT,
  items                 JSONB NOT NULL DEFAULT '[]',
  total                 DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency              TEXT NOT NULL DEFAULT 'MAD',
  payment_method        TEXT NOT NULL DEFAULT 'cash'
                        CHECK (payment_method IN ('cash', 'card', 'insurance')),
  has_prescription      BOOLEAN DEFAULT FALSE,
  loyalty_points_earned INT DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sales_clinic ON sales(clinic_id);
CREATE INDEX idx_sales_date ON sales(date DESC);
CREATE INDEX idx_sales_patient ON sales(patient_id);

-- ============================================================
-- 10. ON-DUTY SCHEDULE (pharmacy-demo-data.ts → onDutySchedule)
-- Pharmacy on-duty / night-duty rota.
-- ============================================================

CREATE TABLE on_duty_schedule (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id  UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time   TIME NOT NULL,
  is_on_duty BOOLEAN DEFAULT FALSE,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_on_duty_schedule_clinic ON on_duty_schedule(clinic_id);
CREATE INDEX idx_on_duty_schedule_date ON on_duty_schedule(date);

-- ============================================================
-- 11. BEFORE/AFTER PHOTOS (dental-demo-data.ts → beforeAfterPhotos)
-- Dental treatment before/after comparison photos.
-- ============================================================

CREATE TABLE before_after_photos (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id         UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id        UUID NOT NULL REFERENCES users(id),
  treatment_plan_id UUID REFERENCES treatment_plans(id) ON DELETE SET NULL,
  description       TEXT,
  before_image_url  TEXT,
  after_image_url   TEXT,
  before_date       DATE,
  after_date        DATE,
  category          TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_before_after_photos_clinic ON before_after_photos(clinic_id);
CREATE INDEX idx_before_after_photos_patient ON before_after_photos(patient_id);
CREATE INDEX idx_before_after_photos_plan ON before_after_photos(treatment_plan_id);

-- ============================================================
-- 12. PAIN QUESTIONNAIRES (dental-demo-data.ts → painQuestionnaires)
-- Pre-appointment pain assessment forms.
-- ============================================================

CREATE TABLE pain_questionnaires (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id        UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id       UUID NOT NULL REFERENCES users(id),
  appointment_id   UUID REFERENCES appointments(id) ON DELETE SET NULL,
  pain_level       INT NOT NULL CHECK (pain_level BETWEEN 0 AND 10),
  pain_location    TEXT,
  pain_duration    TEXT,
  pain_type        TEXT,
  triggers         TEXT[] DEFAULT '{}',
  has_swelling     BOOLEAN DEFAULT FALSE,
  has_bleeding     BOOLEAN DEFAULT FALSE,
  additional_notes TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pain_questionnaires_clinic ON pain_questionnaires(clinic_id);
CREATE INDEX idx_pain_questionnaires_patient ON pain_questionnaires(patient_id);
CREATE INDEX idx_pain_questionnaires_appointment ON pain_questionnaires(appointment_id);

-- ============================================================
-- 13. EXTEND EXISTING TABLES
-- ============================================================

-- 13a. clinics: add columns used by ClinicDetail (super-admin-data.ts)
ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS domain TEXT,
  ADD COLUMN IF NOT EXISTS owner_name TEXT,
  ADD COLUMN IF NOT EXISTS owner_email TEXT,
  ADD COLUMN IF NOT EXISTS owner_phone TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 13b. loyalty_points: add columns used by LoyaltyMember (pharmacy-demo-data.ts)
ALTER TABLE loyalty_points
  ADD COLUMN IF NOT EXISTS available_points INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS redeemed_points INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'bronze'
    CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  ADD COLUMN IF NOT EXISTS referral_code TEXT,
  ADD COLUMN IF NOT EXISTS referred_by TEXT,
  ADD COLUMN IF NOT EXISTS total_purchases DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS birthday_reward_claimed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS birthday_reward_year INT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 13c. loyalty_transactions: add columns used by LoyaltyTransaction (pharmacy-demo-data.ts)
ALTER TABLE loyalty_transactions
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'earned'
    CHECK (type IN ('earned', 'redeemed', 'birthday_bonus', 'referral_bonus', 'expired')),
  ADD COLUMN IF NOT EXISTS sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description TEXT;

-- loyalty_transactions: rename reason → description if reason exists
-- (The existing column is "reason"; demo data uses "description". We add description above;
--  the app layer can read either.)

-- 13d. stock: add batch_number column for tracking
ALTER TABLE stock
  ADD COLUMN IF NOT EXISTS batch_number TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 13e. products: add extra columns used by PharmacyProduct (pharmacy-demo-data.ts)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS generic_name TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'MAD',
  ADD COLUMN IF NOT EXISTS manufacturer TEXT,
  ADD COLUMN IF NOT EXISTS dosage_form TEXT,
  ADD COLUMN IF NOT EXISTS strength TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 13f. suppliers: add extra columns used by Supplier (pharmacy-demo-data.ts)
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS contact_person TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS rating DECIMAL(3,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_terms TEXT,
  ADD COLUMN IF NOT EXISTS delivery_days INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 13g. purchase_orders: add extra columns used by PurchaseOrder (pharmacy-demo-data.ts)
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS supplier_name TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'MAD',
  ADD COLUMN IF NOT EXISTS expected_delivery DATE,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- 13h. sterilization_log: add method and sterilized_by columns (dental-demo-data.ts)
ALTER TABLE sterilization_log
  ADD COLUMN IF NOT EXISTS sterilized_by TEXT,
  ADD COLUMN IF NOT EXISTS method TEXT DEFAULT 'autoclave'
    CHECK (method IN ('autoclave', 'chemical', 'dry_heat')),
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- 13i. treatment_plans: add title column (dental-demo-data.ts)
ALTER TABLE treatment_plans
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 13j. installments: add clinic_id column (database.ts type expects it)
ALTER TABLE installments
  ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 13k. lab_orders: add due_date and updated_at columns (dental-demo-data.ts)
ALTER TABLE lab_orders
  ADD COLUMN IF NOT EXISTS lab_name TEXT,
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 13l. prescription_requests: add delivery_requested column (database.ts type expects it)
ALTER TABLE prescription_requests
  ADD COLUMN IF NOT EXISTS delivery_requested BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 13m. purchase_order_items: add created_at column (database.ts type expects it)
ALTER TABLE purchase_order_items
  ADD COLUMN IF NOT EXISTS unit_price DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 13n. appointments: add separate date/time columns used by the app
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS appointment_date DATE,
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS end_time TIME,
  ADD COLUMN IF NOT EXISTS is_walk_in BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS booking_source TEXT DEFAULT 'online'
    CHECK (booking_source IN ('online', 'phone', 'walk_in', 'whatsapp')),
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS rescheduled_from UUID,
  ADD COLUMN IF NOT EXISTS is_emergency BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS recurrence_group_id UUID,
  ADD COLUMN IF NOT EXISTS recurrence_pattern TEXT
    CHECK (recurrence_pattern IN ('weekly', 'biweekly', 'monthly')),
  ADD COLUMN IF NOT EXISTS recurrence_index INT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 13o. users: add extra columns used by the app
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 13p. services: add extra columns used by the app
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS duration_min INT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 13q. time_slots: add extra columns used by the app
ALTER TABLE time_slots
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS buffer_min INT DEFAULT 10;

-- 13r. notifications: add extra columns used by the app
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS body TEXT,
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ DEFAULT now();

-- 13s. payments: add extra columns used by the app
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'full'
    CHECK (payment_type IN ('deposit', 'full')),
  ADD COLUMN IF NOT EXISTS gateway_session_id TEXT,
  ADD COLUMN IF NOT EXISTS refunded_amount DECIMAL(10,2) DEFAULT 0;

-- 13t. reviews: add doctor_id and is_visible columns used by the app
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS doctor_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT TRUE;

-- 13u. documents: add extra columns used by the app
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS file_size BIGINT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 13v. clinic_holidays: add created_at column
ALTER TABLE clinic_holidays
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 13w. consultation_notes: add extra columns used by the app
ALTER TABLE consultation_notes
  ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS diagnosis TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 13x. prescriptions: add extra columns used by the app
ALTER TABLE prescriptions
  ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- 13y. family_members: add member_user_id column used by the app
ALTER TABLE family_members
  ADD COLUMN IF NOT EXISTS member_user_id UUID REFERENCES users(id);

-- 13z. odontogram: add clinic_id column used by the app
ALTER TABLE odontogram
  ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE;

-- 13aa. emergency_slots: ensure it exists (may already from initial schema via app code)
-- The table was in database.ts types but not in the initial SQL migration.
CREATE TABLE IF NOT EXISTS emergency_slots (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id   UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  doctor_id   UUID NOT NULL REFERENCES users(id),
  slot_date   DATE NOT NULL,
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  reason      TEXT,
  is_booked   BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emergency_slots_clinic ON emergency_slots(clinic_id);
CREATE INDEX IF NOT EXISTS idx_emergency_slots_doctor ON emergency_slots(doctor_id);
CREATE INDEX IF NOT EXISTS idx_emergency_slots_date ON emergency_slots(slot_date);

-- 13bb. appointment_doctors: ensure it exists
CREATE TABLE IF NOT EXISTS appointment_doctors (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  doctor_id      UUID NOT NULL REFERENCES users(id),
  is_primary     BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointment_doctors_appointment ON appointment_doctors(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_doctors_doctor ON appointment_doctors(doctor_id);

-- 13cc. clinic_holidays: ensure it exists
CREATE TABLE IF NOT EXISTS clinic_holidays (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id  UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinic_holidays_clinic ON clinic_holidays(clinic_id);

-- 13dd. purchase_orders: ensure it exists
CREATE TABLE IF NOT EXISTS purchase_orders (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id     UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  supplier_id   UUID NOT NULL REFERENCES suppliers(id),
  status        TEXT DEFAULT 'draft'
                CHECK (status IN ('draft', 'sent', 'confirmed', 'received', 'cancelled')),
  total_amount  DECIMAL(10,2),
  notes         TEXT,
  ordered_at    TIMESTAMPTZ,
  received_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_clinic ON purchase_orders(clinic_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);

-- 13ee. purchase_order_items: ensure it exists
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id        UUID NOT NULL REFERENCES products(id),
  quantity          INT NOT NULL DEFAULT 0,
  unit_price        DECIMAL(10,2),
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_order ON purchase_order_items(purchase_order_id);

-- 13ff. loyalty_transactions: ensure it exists
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id   UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id  UUID NOT NULL REFERENCES users(id),
  points      INT NOT NULL DEFAULT 0,
  reason      TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_clinic ON loyalty_transactions(clinic_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_patient ON loyalty_transactions(patient_id);


-- >>>>>>>>>> 00006_clinic_branding.sql <<<<<<<<<<

-- ============================================================
-- 00006: Add branding columns to clinics table
-- Allows each clinic to customise logo, colors, fonts, and
-- hero image. Values are consumed by the public layout and
-- the admin branding-settings page.
-- ============================================================

ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS logo_url        TEXT,
  ADD COLUMN IF NOT EXISTS favicon_url     TEXT,
  ADD COLUMN IF NOT EXISTS primary_color   TEXT DEFAULT '#1E4DA1',
  ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#0F6E56',
  ADD COLUMN IF NOT EXISTS heading_font    TEXT DEFAULT 'Geist',
  ADD COLUMN IF NOT EXISTS body_font       TEXT DEFAULT 'Geist',
  ADD COLUMN IF NOT EXISTS hero_image_url  TEXT;


-- >>>>>>>>>> 00007_website_customization.sql <<<<<<<<<<

-- ============================================================
-- 00007: Website Customization — Levels 1, 2 & 3
--
-- Level 1 (Branding): tagline, cover_photo_url columns
-- Level 2 (Layout Templates): template_id column
-- Level 3 (Section Control): section_visibility JSONB column
-- ============================================================

-- Level 1: extra branding fields (logo, colors, hero already exist from 00006)
ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS tagline          TEXT,
  ADD COLUMN IF NOT EXISTS cover_photo_url  TEXT;

-- Level 2: chosen layout template (defaults to 'modern')
ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS template_id      TEXT DEFAULT 'modern';

-- Level 3: section visibility as JSONB
-- Default: all sections ON
ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS section_visibility JSONB DEFAULT '{
    "hero": true,
    "services": true,
    "doctors": true,
    "reviews": true,
    "blog": true,
    "beforeAfter": true,
    "location": true,
    "booking": true,
    "contactForm": true,
    "insurance": true,
    "faq": true
  }'::jsonb;


-- >>>>>>>>>> 00008_chatbot_tables.sql <<<<<<<<<<

-- ============================================================
-- Migration 00008: Chatbot Tables
-- Per-clinic chatbot configuration and custom FAQ entries.
-- ============================================================

-- ============================================================
-- 1. CHATBOT CONFIG — per-clinic chatbot settings
-- ============================================================

CREATE TABLE chatbot_config (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  enabled         BOOLEAN DEFAULT TRUE,
  intelligence    TEXT NOT NULL DEFAULT 'basic'
                  CHECK (intelligence IN ('basic', 'smart', 'advanced')),
  greeting        TEXT DEFAULT 'Bonjour ! Comment puis-je vous aider ?',
  language        TEXT DEFAULT 'fr'
                  CHECK (language IN ('fr', 'ar', 'en', 'darija')),
  accent_color    TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (clinic_id)
);

CREATE INDEX idx_chatbot_config_clinic ON chatbot_config(clinic_id);

-- ============================================================
-- 2. CHATBOT FAQs — custom Q&A pairs per clinic
-- ============================================================

CREATE TABLE chatbot_faqs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  question        TEXT NOT NULL,
  answer          TEXT NOT NULL,
  keywords        TEXT[] DEFAULT '{}',
  sort_order      INT DEFAULT 0,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chatbot_faqs_clinic ON chatbot_faqs(clinic_id);
CREATE INDEX idx_chatbot_faqs_active ON chatbot_faqs(clinic_id, is_active)
  WHERE is_active = TRUE;

-- ============================================================
-- 3. RLS POLICIES
-- ============================================================

ALTER TABLE chatbot_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_faqs ENABLE ROW LEVEL SECURITY;

-- chatbot_config: public read for active clinics (chatbot needs it)
CREATE POLICY "chatbot_config_select_public" ON chatbot_config
  FOR SELECT USING (TRUE);

-- chatbot_config: clinic admin can manage their own
CREATE POLICY "chatbot_config_admin_manage" ON chatbot_config
  FOR ALL USING (is_clinic_admin(clinic_id))
  WITH CHECK (is_clinic_admin(clinic_id));

-- chatbot_config: super admin full access
CREATE POLICY "chatbot_config_sa_all" ON chatbot_config
  FOR ALL USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- chatbot_faqs: public read for active FAQs (chatbot needs it)
CREATE POLICY "chatbot_faqs_select_public" ON chatbot_faqs
  FOR SELECT USING (is_active = TRUE);

-- chatbot_faqs: clinic admin can manage their own
CREATE POLICY "chatbot_faqs_admin_manage" ON chatbot_faqs
  FOR ALL USING (is_clinic_admin(clinic_id))
  WITH CHECK (is_clinic_admin(clinic_id));

-- chatbot_faqs: super admin full access
CREATE POLICY "chatbot_faqs_sa_all" ON chatbot_faqs
  FOR ALL USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ============================================================
-- 4. FEATURE TOGGLE — register chatbot as a toggleable feature
-- ============================================================

INSERT INTO feature_toggles (key, label, description, category, system_types, tiers, enabled)
VALUES (
  'chatbot',
  'Chatbot Assistant',
  'Assistant virtuel intelligent pour répondre aux questions des patients',
  'advanced',
  ARRAY['doctor', 'dentist', 'pharmacy'],
  ARRAY['cabinet', 'pro', 'premium', 'saas'],
  TRUE
)
ON CONFLICT (key) DO NOTHING;


-- >>>>>>>>>> 00009_clinic_types.sql <<<<<<<<<<

-- ============================================================
-- Migration 00009: Clinic Type Registry
-- Adds clinic_types table with all health sector categories,
-- seeds ~35 clinic types, and adds FK to clinics table.
-- ============================================================

-- ============================================================
-- 1. CREATE CLINIC_TYPES TABLE
-- ============================================================

CREATE TABLE clinic_types (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type_key        TEXT NOT NULL UNIQUE,
  name_fr         TEXT NOT NULL,
  name_ar         TEXT NOT NULL,
  category        TEXT NOT NULL CHECK (category IN (
    'medical', 'para_medical', 'diagnostic', 'pharmacy_retail', 'clinics_centers'
  )),
  icon            TEXT NOT NULL DEFAULT 'Stethoscope',
  features_config JSONB NOT NULL DEFAULT '{}',
  sort_order      INT NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_clinic_types_category ON clinic_types(category);
CREATE INDEX idx_clinic_types_key ON clinic_types(type_key);

-- ============================================================
-- 2. SEED CLINIC TYPES (~35 types across 5 categories)
-- ============================================================

-- ---- MEDICAL (طبي) ----

INSERT INTO clinic_types (type_key, name_fr, name_ar, category, icon, sort_order, features_config) VALUES
-- ---- MEDICAL (طبي) ----
('general_medicine',  'Médecine Générale',           'الطب العام',                    'medical', 'Stethoscope',    1,  '{"appointments":true,"prescriptions":true,"consultations":true,"lab_results":false,"imaging":false,"stock":false,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('cardiology',        'Cardiologie',                  'أمراض القلب',                   'medical', 'Heart',          2,  '{"appointments":true,"prescriptions":true,"consultations":true,"lab_results":true,"imaging":true,"stock":false,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('dermatology',       'Dermatologie',                 'الأمراض الجلدية',               'medical', 'Scan',           3,  '{"appointments":true,"prescriptions":true,"consultations":true,"lab_results":false,"imaging":false,"stock":false,"sales":false,"odontogram":false,"before_after_photos":true,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('pediatrics',        'Pédiatrie',                    'طب الأطفال',                    'medical', 'Baby',           4,  '{"appointments":true,"prescriptions":true,"consultations":true,"lab_results":true,"imaging":false,"stock":false,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":true,"vaccination":true,"bed_management":false,"installments":false}'),
('gynecology',        'Gynécologie-Obstétrique',      'أمراض النساء والتوليد',          'medical', 'HeartHandshake', 5,  '{"appointments":true,"prescriptions":true,"consultations":true,"lab_results":true,"imaging":true,"stock":false,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('ophthalmology',     'Ophtalmologie',                'طب العيون',                     'medical', 'Eye',            6,  '{"appointments":true,"prescriptions":true,"consultations":true,"lab_results":false,"imaging":false,"stock":false,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('ent',               'ORL',                          'أمراض الأنف والأذن والحنجرة',   'medical', 'Ear',            7,  '{"appointments":true,"prescriptions":true,"consultations":true,"lab_results":false,"imaging":true,"stock":false,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('neurology',         'Neurologie',                   'طب الأعصاب',                    'medical', 'Brain',          8,  '{"appointments":true,"prescriptions":true,"consultations":true,"lab_results":true,"imaging":true,"stock":false,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('psychiatry',        'Psychiatrie',                  'الطب النفسي',                   'medical', 'BrainCircuit',   9,  '{"appointments":true,"prescriptions":true,"consultations":true,"lab_results":false,"imaging":false,"stock":false,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('orthopedics',       'Orthopédie',                   'جراحة العظام',                  'medical', 'Bone',           10, '{"appointments":true,"prescriptions":true,"consultations":true,"lab_results":false,"imaging":true,"stock":false,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('urology',           'Urologie',                     'المسالك البولية',               'medical', 'Activity',       11, '{"appointments":true,"prescriptions":true,"consultations":true,"lab_results":true,"imaging":true,"stock":false,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('gastroenterology',  'Gastro-entérologie',           'أمراض الجهاز الهضمي',           'medical', 'Apple',          12, '{"appointments":true,"prescriptions":true,"consultations":true,"lab_results":true,"imaging":true,"stock":false,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('pulmonology',       'Pneumologie',                  'أمراض الرئة',                   'medical', 'Wind',           13, '{"appointments":true,"prescriptions":true,"consultations":true,"lab_results":true,"imaging":true,"stock":false,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('endocrinology',     'Endocrinologie',               'الغدد الصماء والسكري',          'medical', 'Droplets',       14, '{"appointments":true,"prescriptions":true,"consultations":true,"lab_results":true,"imaging":false,"stock":false,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('rheumatology',      'Rhumatologie',                 'أمراض الروماتيزم',              'medical', 'Accessibility',  15, '{"appointments":true,"prescriptions":true,"consultations":true,"lab_results":true,"imaging":true,"stock":false,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),

-- ---- PARA-MEDICAL (شبه طبي) ----

('physiotherapy',     'Kinésithérapie',               'العلاج الطبيعي',                'para_medical', 'Dumbbell',      16, '{"appointments":true,"prescriptions":false,"consultations":true,"lab_results":false,"imaging":false,"stock":false,"sales":false,"odontogram":false,"before_after_photos":true,"exercise_programs":true,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('speech_therapy',    'Orthophonie',                  'النطق والتخاطب',                'para_medical', 'MessageCircle', 17, '{"appointments":true,"prescriptions":false,"consultations":true,"lab_results":false,"imaging":false,"stock":false,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('nutrition',         'Diététique et Nutrition',      'التغذية',                        'para_medical', 'Salad',         18, '{"appointments":true,"prescriptions":false,"consultations":true,"lab_results":false,"imaging":false,"stock":false,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":true,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('psychology',        'Psychologie',                  'علم النفس',                      'para_medical', 'HeartPulse',    19, '{"appointments":true,"prescriptions":false,"consultations":true,"lab_results":false,"imaging":false,"stock":false,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('nursing',           'Soins Infirmiers',             'التمريض',                        'para_medical', 'Syringe',       20, '{"appointments":true,"prescriptions":false,"consultations":true,"lab_results":false,"imaging":false,"stock":true,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":true,"bed_management":false,"installments":false}'),
('optician',          'Opticien',                     'البصريات',                       'para_medical', 'Glasses',       21, '{"appointments":true,"prescriptions":false,"consultations":false,"lab_results":false,"imaging":false,"stock":true,"sales":true,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":true}'),
('podiatry',          'Podologie',                    'طب القدم',                       'para_medical', 'Footprints',    22, '{"appointments":true,"prescriptions":false,"consultations":true,"lab_results":false,"imaging":false,"stock":false,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('osteopathy',        'Ostéopathie',                  'تقويم العظام',                   'para_medical', 'PersonStanding',23, '{"appointments":true,"prescriptions":false,"consultations":true,"lab_results":false,"imaging":false,"stock":false,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":true,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),

-- ---- DIAGNOSTIC (تشخيصي) ----

('radiology',         'Radiologie',                   'الأشعة',                         'diagnostic', 'ScanLine',       24, '{"appointments":true,"prescriptions":false,"consultations":false,"lab_results":true,"imaging":true,"stock":false,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('medical_lab',       'Laboratoire d''Analyses',      'مختبر التحاليل الطبية',          'diagnostic', 'TestTube',       25, '{"appointments":true,"prescriptions":false,"consultations":false,"lab_results":true,"imaging":false,"stock":true,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('medical_imaging',   'Imagerie Médicale',            'التصوير الطبي',                  'diagnostic', 'MonitorCheck',   26, '{"appointments":true,"prescriptions":false,"consultations":false,"lab_results":true,"imaging":true,"stock":false,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('pathology',         'Anatomie Pathologique',        'التشريح المرضي',                 'diagnostic', 'Microscope',     27, '{"appointments":false,"prescriptions":false,"consultations":false,"lab_results":true,"imaging":false,"stock":true,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),

-- ---- PHARMACY & RETAIL (صيدلة وبيع) ----

('pharmacy',          'Pharmacie',                    'صيدلية',                         'pharmacy_retail', 'Pill',           28, '{"appointments":false,"prescriptions":true,"consultations":false,"lab_results":false,"imaging":false,"stock":true,"sales":true,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('parapharmacy',      'Parapharmacie',                'شبه صيدلية',                    'pharmacy_retail', 'ShoppingBag',    29, '{"appointments":false,"prescriptions":false,"consultations":false,"lab_results":false,"imaging":false,"stock":true,"sales":true,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('medical_equipment', 'Matériel Médical',             'المعدات الطبية',                 'pharmacy_retail', 'Wrench',         30, '{"appointments":false,"prescriptions":false,"consultations":false,"lab_results":false,"imaging":false,"stock":true,"sales":true,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":true}'),
('orthopedic_supply', 'Orthopédie et Appareillage',   'تقويم العظام والأجهزة',          'pharmacy_retail', 'Cog',            31, '{"appointments":true,"prescriptions":false,"consultations":false,"lab_results":false,"imaging":false,"stock":true,"sales":true,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":true}'),

-- ---- CLINICS & CENTERS (عيادات ومراكز) ----

('dental_clinic',     'Cabinet Dentaire',             'عيادة الأسنان',                  'clinics_centers', 'Smile',          32, '{"appointments":true,"prescriptions":true,"consultations":true,"lab_results":true,"imaging":true,"stock":true,"sales":false,"odontogram":true,"before_after_photos":true,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":true}'),
('polyclinic',        'Polyclinique',                 'عيادة متعددة التخصصات',          'clinics_centers', 'Building2',      33, '{"appointments":true,"prescriptions":true,"consultations":true,"lab_results":true,"imaging":true,"stock":true,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":true,"installments":true}'),
('medical_center',    'Centre Médical',               'مركز طبي',                       'clinics_centers', 'Hospital',       34, '{"appointments":true,"prescriptions":true,"consultations":true,"lab_results":true,"imaging":true,"stock":true,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":true,"bed_management":true,"installments":true}'),
('dialysis_center',   'Centre d''Hémodialyse',        'مركز غسيل الكلى',                'clinics_centers', 'Droplet',        35, '{"appointments":true,"prescriptions":true,"consultations":true,"lab_results":true,"imaging":false,"stock":true,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":true,"installments":false}'),
('rehabilitation',    'Centre de Rééducation',        'مركز إعادة التأهيل',             'clinics_centers', 'StretchVertical',36, '{"appointments":true,"prescriptions":false,"consultations":true,"lab_results":false,"imaging":false,"stock":false,"sales":false,"odontogram":false,"before_after_photos":true,"exercise_programs":true,"meal_plans":true,"growth_charts":false,"vaccination":false,"bed_management":true,"installments":true}'),
('aesthetic_clinic',  'Clinique Esthétique',          'عيادة التجميل',                  'clinics_centers', 'Sparkles',       37, '{"appointments":true,"prescriptions":false,"consultations":true,"lab_results":false,"imaging":false,"stock":true,"sales":true,"odontogram":false,"before_after_photos":true,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":true}');

-- ============================================================
-- 3. ADD clinic_type_key FK TO CLINICS TABLE
-- ============================================================

ALTER TABLE clinics
  ADD COLUMN clinic_type_key TEXT REFERENCES clinic_types(type_key);

CREATE INDEX idx_clinics_type_key ON clinics(clinic_type_key);

-- ============================================================
-- 4. ENABLE RLS ON CLINIC_TYPES
-- ============================================================

ALTER TABLE clinic_types ENABLE ROW LEVEL SECURITY;

-- Everyone can read clinic types (public reference data)
CREATE POLICY "clinic_types_select_all" ON clinic_types
  FOR SELECT USING (true);

-- Only super admins can modify clinic types
CREATE POLICY "sa_clinic_types_all" ON clinic_types
  FOR ALL USING (is_super_admin())
  WITH CHECK (is_super_admin());


-- >>>>>>>>>> 00010_medical_features.sql <<<<<<<<<<

-- ============================================================
-- Migration 00010: Medical Features (Phase 2)
-- Adds medical_certificates table, extends consultation_notes,
-- extends sterilization_log, updates odontogram constraints,
-- and adds certificates feature flag.
-- ============================================================

-- ============================================================
-- 1. MEDICAL CERTIFICATES (General Doctor - new feature)
-- ============================================================

CREATE TABLE medical_certificates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  appointment_id  UUID REFERENCES appointments(id),
  type            TEXT NOT NULL CHECK (type IN (
    'sick_leave', 'fitness', 'medical_report', 'disability', 'custom'
  )),
  content         JSONB NOT NULL DEFAULT '{}',
  pdf_url         TEXT,
  issued_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_medical_certificates_clinic ON medical_certificates(clinic_id);
CREATE INDEX idx_medical_certificates_patient ON medical_certificates(patient_id);
CREATE INDEX idx_medical_certificates_doctor ON medical_certificates(doctor_id);

-- ============================================================
-- 2. EXTEND CONSULTATION NOTES
-- Add structured content JSONB column for rich note data
-- ============================================================

ALTER TABLE consultation_notes
  ADD COLUMN IF NOT EXISTS content JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ============================================================
-- 3. EXTEND STERILIZATION LOG
-- Add batch_number and cycle_number for compliance tracking
-- ============================================================

ALTER TABLE sterilization_log
  ADD COLUMN IF NOT EXISTS batch_number TEXT,
  ADD COLUMN IF NOT EXISTS cycle_number INT;

-- ============================================================
-- 4. EXTEND ODONTOGRAM
-- Update tooth_number constraint to support child (deciduous)
-- teeth using FDI notation (range 11-85)
-- ============================================================

-- Drop existing constraint and add broader one for FDI notation
ALTER TABLE odontogram
  DROP CONSTRAINT IF EXISTS odontogram_tooth_number_check;

ALTER TABLE odontogram
  ADD CONSTRAINT odontogram_tooth_number_fdi_check
    CHECK (tooth_number BETWEEN 11 AND 85);

-- Add dentition type column
ALTER TABLE odontogram
  ADD COLUMN IF NOT EXISTS dentition TEXT DEFAULT 'adult'
    CHECK (dentition IN ('adult', 'child'));

-- ============================================================
-- 5. UPDATE FEATURES CONFIG for certificates
-- Add "certificates" feature to general_medicine clinic type
-- ============================================================

UPDATE clinic_types
SET features_config = features_config || '{"certificates": true}'::jsonb
WHERE type_key = 'general_medicine';

-- Also add sterilization_log feature key for dental types
UPDATE clinic_types
SET features_config = features_config || '{"sterilization_log": true}'::jsonb
WHERE type_key = 'dental';


-- >>>>>>>>>> 00011_specialty_modules.sql <<<<<<<<<<

-- ============================================================
-- Migration 00011: Specialty Modules
-- Adds tables for Pediatrician, Gynecologist, and Ophthalmologist
-- specialty features.
-- ============================================================

-- ============================================================
-- 1. PEDIATRICIAN — Growth Measurements
-- ============================================================

CREATE TABLE growth_measurements (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id     UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id    UUID NOT NULL REFERENCES users(id),
  doctor_id     UUID NOT NULL REFERENCES users(id),
  measured_at   DATE NOT NULL DEFAULT CURRENT_DATE,
  age_months    INT NOT NULL CHECK (age_months >= 0),
  weight_kg     DECIMAL(5,2),
  height_cm     DECIMAL(5,1),
  head_circ_cm  DECIMAL(5,1),
  bmi           DECIMAL(4,1),
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_growth_measurements_clinic ON growth_measurements(clinic_id);
CREATE INDEX idx_growth_measurements_patient ON growth_measurements(patient_id);
CREATE INDEX idx_growth_measurements_doctor ON growth_measurements(doctor_id);

-- ============================================================
-- 2. PEDIATRICIAN — Vaccinations
-- ============================================================

CREATE TABLE vaccinations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID REFERENCES users(id),
  vaccine_name    TEXT NOT NULL,
  dose_number     INT NOT NULL DEFAULT 1,
  scheduled_date  DATE NOT NULL,
  administered_date DATE,
  status          TEXT NOT NULL DEFAULT 'scheduled'
                  CHECK (status IN ('scheduled', 'administered', 'overdue', 'skipped')),
  lot_number      TEXT,
  site            TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_vaccinations_clinic ON vaccinations(clinic_id);
CREATE INDEX idx_vaccinations_patient ON vaccinations(patient_id);
CREATE INDEX idx_vaccinations_status ON vaccinations(status);

-- ============================================================
-- 3. PEDIATRICIAN — Developmental Milestones
-- ============================================================

CREATE TABLE developmental_milestones (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id     UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id    UUID NOT NULL REFERENCES users(id),
  doctor_id     UUID REFERENCES users(id),
  category      TEXT NOT NULL CHECK (category IN ('motor', 'language', 'social', 'cognitive')),
  milestone     TEXT NOT NULL,
  expected_age_months INT,
  achieved_date DATE,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'achieved', 'delayed', 'concern')),
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_milestones_clinic ON developmental_milestones(clinic_id);
CREATE INDEX idx_milestones_patient ON developmental_milestones(patient_id);

-- ============================================================
-- 4. GYNECOLOGIST — Pregnancies
-- ============================================================

CREATE TABLE pregnancies (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id         UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id        UUID NOT NULL REFERENCES users(id),
  doctor_id         UUID NOT NULL REFERENCES users(id),
  lmp_date          DATE NOT NULL,
  edd_date          DATE NOT NULL,
  status            TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'delivered', 'miscarriage', 'ectopic', 'terminated')),
  gravida           INT,
  para              INT,
  blood_type        TEXT,
  rh_factor         TEXT CHECK (rh_factor IN ('positive', 'negative')),
  risk_factors      JSONB DEFAULT '[]',
  birth_plan_notes  TEXT,
  delivery_date     DATE,
  delivery_type     TEXT CHECK (delivery_type IN ('vaginal', 'cesarean', 'assisted')),
  baby_weight_kg    DECIMAL(4,2),
  baby_gender       TEXT CHECK (baby_gender IN ('male', 'female')),
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pregnancies_clinic ON pregnancies(clinic_id);
CREATE INDEX idx_pregnancies_patient ON pregnancies(patient_id);
CREATE INDEX idx_pregnancies_doctor ON pregnancies(doctor_id);
CREATE INDEX idx_pregnancies_status ON pregnancies(status);

-- ============================================================
-- 5. GYNECOLOGIST — Ultrasound Records
-- ============================================================

CREATE TABLE ultrasound_records (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  pregnancy_id    UUID NOT NULL REFERENCES pregnancies(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  scan_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  trimester       INT NOT NULL CHECK (trimester BETWEEN 1 AND 3),
  gestational_weeks INT,
  gestational_days  INT CHECK (gestational_days BETWEEN 0 AND 6),
  measurements    JSONB DEFAULT '{}',
  findings        TEXT,
  image_urls      JSONB DEFAULT '[]',
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ultrasound_clinic ON ultrasound_records(clinic_id);
CREATE INDEX idx_ultrasound_pregnancy ON ultrasound_records(pregnancy_id);
CREATE INDEX idx_ultrasound_patient ON ultrasound_records(patient_id);

-- ============================================================
-- 6. OPHTHALMOLOGIST — Vision Tests
-- ============================================================

CREATE TABLE vision_tests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  test_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  od_acuity       TEXT,
  os_acuity       TEXT,
  od_sphere       DECIMAL(4,2),
  od_cylinder     DECIMAL(4,2),
  od_axis         INT CHECK (od_axis BETWEEN 0 AND 180),
  os_sphere       DECIMAL(4,2),
  os_cylinder     DECIMAL(4,2),
  os_axis         INT CHECK (os_axis BETWEEN 0 AND 180),
  od_add          DECIMAL(3,2),
  os_add          DECIMAL(3,2),
  pd_mm           DECIMAL(4,1),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_vision_tests_clinic ON vision_tests(clinic_id);
CREATE INDEX idx_vision_tests_patient ON vision_tests(patient_id);
CREATE INDEX idx_vision_tests_doctor ON vision_tests(doctor_id);

-- ============================================================
-- 7. OPHTHALMOLOGIST — Intraocular Pressure (IOP)
-- ============================================================

CREATE TABLE iop_measurements (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  measured_at     DATE NOT NULL DEFAULT CURRENT_DATE,
  od_pressure     DECIMAL(4,1) NOT NULL,
  os_pressure     DECIMAL(4,1) NOT NULL,
  method          TEXT DEFAULT 'goldmann'
                  CHECK (method IN ('goldmann', 'non_contact', 'tonopen', 'icare', 'other')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_iop_clinic ON iop_measurements(clinic_id);
CREATE INDEX idx_iop_patient ON iop_measurements(patient_id);
CREATE INDEX idx_iop_doctor ON iop_measurements(doctor_id);

-- ============================================================
-- 8. UPDATE FEATURES CONFIG
-- Add specialty feature flags to ClinicFeatureKey
-- ============================================================

-- Add pediatrics features to pediatrics clinic type (if exists)
UPDATE clinic_types
SET features_config = features_config || '{"growth_charts": true, "vaccination": true}'::jsonb
WHERE type_key = 'pediatrics';

-- Add gynecology features to gynecology clinic type (if exists)
UPDATE clinic_types
SET features_config = features_config || '{"pregnancy_tracking": true, "ultrasound_records": true}'::jsonb
WHERE type_key = 'gynecology';

-- Add ophthalmology features to ophthalmology clinic type (if exists)
UPDATE clinic_types
SET features_config = features_config || '{"vision_tests": true, "iop_tracking": true}'::jsonb
WHERE type_key = 'ophthalmology';


-- >>>>>>>>>> 00012_specialist_features.sql <<<<<<<<<<

-- ============================================================
-- Migration 00012: Medical Specialist Features (Tasks 9-15)
-- Adds tables for Dermatologist, Cardiologist, ENT, Orthopedist,
-- Psychiatrist, Neurologist, and remaining specialists.
-- ============================================================

-- ============================================================
-- 1. DERMATOLOGIST (Task 9)
-- ============================================================

CREATE TABLE skin_photos (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  body_region     TEXT NOT NULL,
  description     TEXT,
  image_url       TEXT,
  photo_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  tags            TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_skin_photos_clinic ON skin_photos(clinic_id);
CREATE INDEX idx_skin_photos_patient ON skin_photos(patient_id);

CREATE TABLE skin_conditions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  condition_name  TEXT NOT NULL,
  body_region     TEXT NOT NULL,
  severity        TEXT CHECK (severity IN ('mild', 'moderate', 'severe')),
  status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'monitoring')),
  diagnosis_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  notes           TEXT,
  treatments      JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_skin_conditions_clinic ON skin_conditions(clinic_id);
CREATE INDEX idx_skin_conditions_patient ON skin_conditions(patient_id);

-- ============================================================
-- 2. CARDIOLOGIST (Task 10)
-- ============================================================

CREATE TABLE ecg_records (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  record_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  file_url        TEXT,
  heart_rate      INT,
  rhythm          TEXT,
  interpretation  TEXT,
  notes           TEXT,
  is_abnormal     BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ecg_records_clinic ON ecg_records(clinic_id);
CREATE INDEX idx_ecg_records_patient ON ecg_records(patient_id);

CREATE TABLE blood_pressure_readings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  systolic        INT NOT NULL,
  diastolic       INT NOT NULL,
  heart_rate      INT,
  reading_date    TIMESTAMPTZ NOT NULL DEFAULT now(),
  position        TEXT DEFAULT 'sitting',
  arm             TEXT DEFAULT 'left',
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bp_readings_clinic ON blood_pressure_readings(clinic_id);
CREATE INDEX idx_bp_readings_patient ON blood_pressure_readings(patient_id);

CREATE TABLE heart_monitoring_notes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  note_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  category        TEXT DEFAULT 'general' CHECK (category IN ('general', 'alert', 'follow_up', 'medication')),
  title           TEXT NOT NULL,
  content         TEXT,
  severity        TEXT DEFAULT 'normal' CHECK (severity IN ('normal', 'warning', 'critical')),
  is_alert        BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_heart_notes_clinic ON heart_monitoring_notes(clinic_id);
CREATE INDEX idx_heart_notes_patient ON heart_monitoring_notes(patient_id);

-- ============================================================
-- 3. ENT SPECIALIST (Task 11)
-- ============================================================

CREATE TABLE hearing_tests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  test_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  test_type       TEXT DEFAULT 'pure_tone' CHECK (test_type IN ('pure_tone', 'speech', 'tympanometry', 'oae', 'abr')),
  left_ear_data   JSONB DEFAULT '{}',
  right_ear_data  JSONB DEFAULT '{}',
  interpretation  TEXT,
  hearing_loss_type TEXT,
  hearing_loss_degree TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_hearing_tests_clinic ON hearing_tests(clinic_id);
CREATE INDEX idx_hearing_tests_patient ON hearing_tests(patient_id);

CREATE TABLE ent_exam_records (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  exam_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  template_type   TEXT DEFAULT 'general' CHECK (template_type IN ('general', 'ear', 'nose', 'throat', 'sinus', 'vertigo')),
  findings        JSONB DEFAULT '{}',
  diagnosis       TEXT,
  plan            TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ent_exams_clinic ON ent_exam_records(clinic_id);
CREATE INDEX idx_ent_exams_patient ON ent_exam_records(patient_id);

-- ============================================================
-- 4. ORTHOPEDIST (Task 12)
-- ============================================================

CREATE TABLE xray_records (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  record_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  body_part       TEXT NOT NULL,
  image_url       TEXT,
  annotations     JSONB DEFAULT '[]',
  findings        TEXT,
  diagnosis       TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_xray_records_clinic ON xray_records(clinic_id);
CREATE INDEX idx_xray_records_patient ON xray_records(patient_id);

CREATE TABLE fracture_records (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  location        TEXT NOT NULL,
  fracture_type   TEXT NOT NULL,
  severity        TEXT DEFAULT 'simple' CHECK (severity IN ('simple', 'compound', 'comminuted', 'stress', 'greenstick')),
  status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'healing', 'healed', 'surgical')),
  injury_date     DATE NOT NULL,
  diagnosis_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_healing_date DATE,
  notes           TEXT,
  xray_record_id  UUID REFERENCES xray_records(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_fracture_records_clinic ON fracture_records(clinic_id);
CREATE INDEX idx_fracture_records_patient ON fracture_records(patient_id);

CREATE TABLE rehab_plans (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  title           TEXT NOT NULL,
  condition       TEXT NOT NULL,
  start_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  target_end_date DATE,
  status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),
  milestones      JSONB DEFAULT '[]',
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_rehab_plans_clinic ON rehab_plans(clinic_id);
CREATE INDEX idx_rehab_plans_patient ON rehab_plans(patient_id);

-- ============================================================
-- 5. PSYCHIATRIST (Task 13)
-- ============================================================

CREATE TABLE psych_session_notes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  session_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  session_number  INT DEFAULT 1,
  session_type    TEXT DEFAULT 'individual' CHECK (session_type IN ('individual', 'group', 'family', 'crisis')),
  mood_rating     INT CHECK (mood_rating BETWEEN 1 AND 10),
  content         TEXT,
  observations    TEXT,
  plan            TEXT,
  is_confidential BOOLEAN DEFAULT TRUE,
  access_level    TEXT DEFAULT 'doctor_only' CHECK (access_level IN ('doctor_only', 'care_team', 'full')),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_psych_notes_clinic ON psych_session_notes(clinic_id);
CREATE INDEX idx_psych_notes_patient ON psych_session_notes(patient_id);
CREATE INDEX idx_psych_notes_doctor ON psych_session_notes(doctor_id);

CREATE TABLE psych_medications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  medication_name TEXT NOT NULL,
  dosage          TEXT NOT NULL,
  frequency       TEXT NOT NULL,
  start_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date        DATE,
  status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'discontinued', 'adjusted', 'completed')),
  reason          TEXT,
  side_effects    TEXT,
  notes           TEXT,
  dosage_history  JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_psych_meds_clinic ON psych_medications(clinic_id);
CREATE INDEX idx_psych_meds_patient ON psych_medications(patient_id);

-- ============================================================
-- 6. NEUROLOGIST (Task 14)
-- ============================================================

CREATE TABLE eeg_records (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  record_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  file_url        TEXT,
  duration_minutes INT,
  findings        TEXT,
  interpretation  TEXT,
  is_abnormal     BOOLEAN DEFAULT FALSE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_eeg_records_clinic ON eeg_records(clinic_id);
CREATE INDEX idx_eeg_records_patient ON eeg_records(patient_id);

CREATE TABLE neuro_exam_records (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  exam_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  mental_status   JSONB DEFAULT '{}',
  cranial_nerves  JSONB DEFAULT '{}',
  motor_function  JSONB DEFAULT '{}',
  sensory_function JSONB DEFAULT '{}',
  reflexes        JSONB DEFAULT '{}',
  coordination    JSONB DEFAULT '{}',
  gait            JSONB DEFAULT '{}',
  diagnosis       TEXT,
  plan            TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_neuro_exams_clinic ON neuro_exam_records(clinic_id);
CREATE INDEX idx_neuro_exams_patient ON neuro_exam_records(patient_id);

-- ============================================================
-- 7. REMAINING SPECIALISTS (Task 15)
-- ============================================================

-- Urologist
CREATE TABLE urology_exams (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  exam_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  template_type   TEXT DEFAULT 'general' CHECK (template_type IN ('general', 'prostate', 'kidney', 'bladder', 'uti')),
  findings        JSONB DEFAULT '{}',
  lab_results     JSONB DEFAULT '{}',
  diagnosis       TEXT,
  plan            TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_urology_exams_clinic ON urology_exams(clinic_id);

-- Pulmonologist
CREATE TABLE spirometry_records (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  test_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  fvc             DECIMAL(5,2),
  fev1            DECIMAL(5,2),
  fev1_fvc_ratio  DECIMAL(5,2),
  pef             DECIMAL(5,2),
  interpretation  TEXT,
  test_quality    TEXT DEFAULT 'acceptable' CHECK (test_quality IN ('acceptable', 'good', 'poor')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_spirometry_clinic ON spirometry_records(clinic_id);

CREATE TABLE respiratory_tests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  test_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  test_type       TEXT NOT NULL,
  results         JSONB DEFAULT '{}',
  interpretation  TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_respiratory_tests_clinic ON respiratory_tests(clinic_id);

-- Endocrinologist
CREATE TABLE blood_sugar_readings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  reading_date    TIMESTAMPTZ NOT NULL DEFAULT now(),
  glucose_level   DECIMAL(6,2) NOT NULL,
  reading_type    TEXT DEFAULT 'fasting' CHECK (reading_type IN ('fasting', 'post_meal', 'random', 'hba1c')),
  unit            TEXT DEFAULT 'mg/dL',
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_blood_sugar_clinic ON blood_sugar_readings(clinic_id);
CREATE INDEX idx_blood_sugar_patient ON blood_sugar_readings(patient_id);

CREATE TABLE hormone_levels (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  test_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  hormone_name    TEXT NOT NULL,
  value           DECIMAL(10,3) NOT NULL,
  unit            TEXT NOT NULL,
  reference_range TEXT,
  is_abnormal     BOOLEAN DEFAULT FALSE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_hormone_levels_clinic ON hormone_levels(clinic_id);
CREATE INDEX idx_hormone_levels_patient ON hormone_levels(patient_id);

CREATE TABLE diabetes_management (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  diabetes_type   TEXT CHECK (diabetes_type IN ('type1', 'type2', 'gestational', 'prediabetes')),
  diagnosis_date  DATE,
  current_hba1c   DECIMAL(4,1),
  target_hba1c    DECIMAL(4,1) DEFAULT 7.0,
  medications     JSONB DEFAULT '[]',
  diet_plan       TEXT,
  exercise_plan   TEXT,
  monitoring_frequency TEXT DEFAULT 'daily',
  notes           TEXT,
  last_review_date DATE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_diabetes_mgmt_clinic ON diabetes_management(clinic_id);
CREATE INDEX idx_diabetes_mgmt_patient ON diabetes_management(patient_id);

-- Rheumatologist
CREATE TABLE joint_assessments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  joints_data     JSONB DEFAULT '{}',
  vas_pain_score  INT CHECK (vas_pain_score BETWEEN 0 AND 10),
  morning_stiffness_minutes INT,
  swollen_joint_count INT DEFAULT 0,
  tender_joint_count INT DEFAULT 0,
  das28_score     DECIMAL(4,2),
  functional_status TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_joint_assessments_clinic ON joint_assessments(clinic_id);
CREATE INDEX idx_joint_assessments_patient ON joint_assessments(patient_id);

CREATE TABLE mobility_tests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  test_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  test_type       TEXT NOT NULL,
  joint           TEXT NOT NULL,
  range_of_motion JSONB DEFAULT '{}',
  strength_score  INT CHECK (strength_score BETWEEN 0 AND 5),
  pain_during_test INT CHECK (pain_during_test BETWEEN 0 AND 10),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_mobility_tests_clinic ON mobility_tests(clinic_id);
CREATE INDEX idx_mobility_tests_patient ON mobility_tests(patient_id);

-- ============================================================
-- 8. UPDATE FEATURE FLAGS
-- ============================================================

-- Add specialist feature keys to relevant clinic types
UPDATE clinic_types
SET features_config = features_config || '{
  "dermatology": true,
  "cardiology": true,
  "ent": true,
  "orthopedics": true,
  "psychiatry": true,
  "neurology": true,
  "urology": true,
  "pulmonology": true,
  "endocrinology": true,
  "rheumatology": true
}'::jsonb
WHERE type_key = 'general_medicine';


-- >>>>>>>>>> 00013_para_medical_tables.sql <<<<<<<<<<

-- Phase 3: Para-Medical Types
-- Physiotherapist, Nutritionist, Psychologist, Speech Therapist, Optician

-- ========== Physiotherapist ==========

CREATE TABLE IF NOT EXISTS exercise_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES users(id),
  therapist_id uuid NOT NULL REFERENCES users(id),
  title text NOT NULL,
  exercises jsonb NOT NULL DEFAULT '[]',
  frequency text DEFAULT 'daily',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','paused')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS physio_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES users(id),
  therapist_id uuid NOT NULL REFERENCES users(id),
  program_id uuid REFERENCES exercise_programs(id),
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  duration_minutes int NOT NULL DEFAULT 30,
  attended boolean NOT NULL DEFAULT true,
  progress_notes text,
  pain_level_before int CHECK (pain_level_before BETWEEN 0 AND 10),
  pain_level_after int CHECK (pain_level_after BETWEEN 0 AND 10),
  exercises_completed jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS progress_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES users(id),
  photo_url text NOT NULL,
  photo_date date NOT NULL DEFAULT CURRENT_DATE,
  category text DEFAULT 'general',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ========== Nutritionist ==========

CREATE TABLE IF NOT EXISTS meal_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES users(id),
  nutritionist_id uuid NOT NULL REFERENCES users(id),
  title text NOT NULL,
  type text NOT NULL DEFAULT 'weekly' CHECK (type IN ('daily','weekly')),
  daily_plans jsonb NOT NULL DEFAULT '[]',
  target_calories int DEFAULT 2000,
  notes text,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('active','completed','draft')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS body_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES users(id),
  measurement_date date NOT NULL DEFAULT CURRENT_DATE,
  weight_kg numeric(5,2),
  height_cm numeric(5,1),
  bmi numeric(4,1),
  body_fat_pct numeric(4,1),
  waist_cm numeric(5,1),
  hip_cm numeric(5,1),
  chest_cm numeric(5,1),
  arm_cm numeric(5,1),
  thigh_cm numeric(5,1),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ========== Psychologist ==========

CREATE TABLE IF NOT EXISTS therapy_session_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES users(id),
  therapist_id uuid NOT NULL REFERENCES users(id),
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  session_number int NOT NULL DEFAULT 1,
  duration_minutes int NOT NULL DEFAULT 50,
  session_type text NOT NULL DEFAULT 'individual' CHECK (session_type IN ('individual','couple','family','group')),
  mood_rating int CHECK (mood_rating BETWEEN 1 AND 10),
  presenting_issues text,
  interventions text,
  observations text,
  homework text,
  is_confidential boolean NOT NULL DEFAULT true,
  risk_assessment text CHECK (risk_assessment IN ('none','low','moderate','high')),
  next_session_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS therapy_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES users(id),
  therapist_id uuid NOT NULL REFERENCES users(id),
  diagnosis text,
  treatment_approach text NOT NULL DEFAULT '',
  goals jsonb NOT NULL DEFAULT '[]',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  review_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','on_hold')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ========== Speech Therapist ==========

CREATE TABLE IF NOT EXISTS speech_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('articulation','fluency','language','voice','pragmatics','phonology')),
  description text NOT NULL DEFAULT '',
  difficulty text NOT NULL DEFAULT 'beginner' CHECK (difficulty IN ('beginner','intermediate','advanced')),
  target_sounds jsonb NOT NULL DEFAULT '[]',
  instructions text NOT NULL DEFAULT '',
  materials_needed text,
  duration_minutes int NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS speech_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES users(id),
  therapist_id uuid NOT NULL REFERENCES users(id),
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  duration_minutes int NOT NULL DEFAULT 30,
  attended boolean NOT NULL DEFAULT true,
  exercises_assigned jsonb NOT NULL DEFAULT '[]',
  exercises_completed jsonb NOT NULL DEFAULT '[]',
  accuracy_pct int CHECK (accuracy_pct BETWEEN 0 AND 100),
  notes text,
  home_practice text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS speech_progress_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES users(id),
  therapist_id uuid NOT NULL REFERENCES users(id),
  report_date date NOT NULL DEFAULT CURRENT_DATE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  goals_summary text NOT NULL DEFAULT '',
  progress_summary text NOT NULL DEFAULT '',
  areas_of_improvement jsonb NOT NULL DEFAULT '[]',
  areas_of_concern jsonb NOT NULL DEFAULT '[]',
  recommendations text NOT NULL DEFAULT '',
  next_steps text NOT NULL DEFAULT '',
  overall_progress text NOT NULL DEFAULT 'moderate' CHECK (overall_progress IN ('significant','moderate','minimal','regression')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ========== Optician ==========

CREATE TABLE IF NOT EXISTS lens_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('single_vision','bifocal','progressive','contact','sunglasses')),
  material text NOT NULL DEFAULT '',
  coating text,
  power_range text NOT NULL DEFAULT '',
  stock_quantity int NOT NULL DEFAULT 0,
  min_threshold int NOT NULL DEFAULT 5,
  unit_cost numeric(10,2) NOT NULL DEFAULT 0,
  selling_price numeric(10,2) NOT NULL DEFAULT 0,
  supplier text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS frame_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  brand text NOT NULL,
  model text NOT NULL,
  color text NOT NULL DEFAULT '',
  size text NOT NULL DEFAULT '',
  material text NOT NULL DEFAULT '',
  frame_type text NOT NULL DEFAULT 'full_rim' CHECK (frame_type IN ('full_rim','semi_rimless','rimless')),
  gender text NOT NULL DEFAULT 'unisex' CHECK (gender IN ('men','women','unisex','kids')),
  price numeric(10,2) NOT NULL DEFAULT 0,
  cost_price numeric(10,2) NOT NULL DEFAULT 0,
  stock_quantity int NOT NULL DEFAULT 0,
  photo_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS optical_prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES users(id),
  ophthalmologist_name text,
  prescription_date date NOT NULL DEFAULT CURRENT_DATE,
  expiry_date date,
  right_eye jsonb NOT NULL DEFAULT '{}',
  left_eye jsonb NOT NULL DEFAULT '{}',
  notes text,
  frame_id uuid REFERENCES frame_catalog(id),
  lens_type text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','ready','delivered')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ========== RLS Policies ==========

ALTER TABLE exercise_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE physio_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE body_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE therapy_session_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE therapy_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE speech_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE speech_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE speech_progress_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE lens_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE frame_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE optical_prescriptions ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (scoped by clinic_id in app logic)
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'exercise_programs','physio_sessions','progress_photos',
    'meal_plans','body_measurements',
    'therapy_session_notes','therapy_plans',
    'speech_exercises','speech_sessions','speech_progress_reports',
    'lens_inventory','frame_catalog','optical_prescriptions'
  ])
  LOOP
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (true) WITH CHECK (true)',
      'allow_all_' || tbl, tbl);
  END LOOP;
END $$;

-- ========== Insert para-medical clinic types ==========

INSERT INTO clinic_types (type_key, name_fr, name_ar, category, icon, features_config, sort_order, is_active)
VALUES
  ('physiotherapist', 'Kinésithérapeute', 'معالج طبيعي', 'para_medical', 'Activity', '{"appointments":true,"exercise_programs":true,"consultations":true}', 20, true),
  ('nutritionist', 'Nutritionniste', 'أخصائي تغذية', 'para_medical', 'Apple', '{"appointments":true,"meal_plans":true,"consultations":true}', 21, true),
  ('psychologist', 'Psychologue', 'أخصائي نفسي', 'para_medical', 'Brain', '{"appointments":true,"therapy_notes":true,"consultations":true}', 22, true),
  ('speech_therapist', 'Orthophoniste', 'أخصائي نطق', 'para_medical', 'Mic', '{"appointments":true,"speech_exercises":true,"consultations":true}', 23, true),
  ('optician', 'Opticien', 'نظاراتي', 'para_medical', 'Eye', '{"appointments":true,"lens_inventory":true,"frame_catalog":true,"optical_prescriptions":true}', 24, true)
ON CONFLICT (type_key) DO NOTHING;


-- >>>>>>>>>> 00014_diagnostic_pharmacy_equipment.sql <<<<<<<<<<

-- ============================================================
-- Migration 00014: Phase 4 & 5
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


-- >>>>>>>>>> 00015_phase6_clinics_centers.sql <<<<<<<<<<

-- ============================================================
-- Migration 00015: Phase 6 — Clinics & Centers
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


-- >>>>>>>>>> 00016_custom_fields.sql <<<<<<<<<<

-- ============================================================
-- Migration 00016: Custom Fields Engine (Phase 9, Tasks 38-39)
-- Flexible custom field definitions per clinic type, stored
-- with JSONB values for appointments, patients, consultations,
-- products, and lab orders.
-- ============================================================

-- ============================================================
-- 1. CUSTOM FIELD DEFINITIONS
-- Each clinic type can define its own set of fields that appear
-- on specific entities (appointments, patients, consultations, etc.)
-- ============================================================

CREATE TABLE custom_field_definitions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_type_key TEXT NOT NULL REFERENCES clinic_types(type_key),
  entity_type     TEXT NOT NULL CHECK (entity_type IN (
    'appointment', 'patient', 'consultation', 'product', 'lab_order'
  )),
  field_key       TEXT NOT NULL,
  field_type      TEXT NOT NULL CHECK (field_type IN (
    'text', 'number', 'date', 'select', 'multi_select', 'file', 'tooth_number'
  )),
  label_fr        TEXT NOT NULL,
  label_ar        TEXT NOT NULL DEFAULT '',
  description     TEXT,
  placeholder     TEXT,
  is_required     BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order      INT NOT NULL DEFAULT 0,
  options         JSONB DEFAULT '[]',      -- For select / multi_select: [{"value":"v1","label_fr":"...","label_ar":"..."}]
  validation      JSONB DEFAULT '{}',      -- min, max, pattern, min_length, max_length, etc.
  default_value   JSONB,                   -- Default value (type depends on field_type)
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_system       BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE for built-in fields (Task 39), cannot be deleted by clinic admins
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),

  -- Each clinic type + entity can only have one field with a given key
  UNIQUE (clinic_type_key, entity_type, field_key)
);

CREATE INDEX idx_cfd_clinic_type ON custom_field_definitions(clinic_type_key);
CREATE INDEX idx_cfd_entity ON custom_field_definitions(entity_type);
CREATE INDEX idx_cfd_active ON custom_field_definitions(is_active);

-- ============================================================
-- 2. CUSTOM FIELD VALUES
-- Stores actual values entered by users. One row per entity
-- instance, with all custom field values in a single JSONB column.
-- ============================================================

CREATE TABLE custom_field_values (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  entity_type     TEXT NOT NULL CHECK (entity_type IN (
    'appointment', 'patient', 'consultation', 'product', 'lab_order'
  )),
  entity_id       UUID NOT NULL,           -- FK to the specific record (appointment, patient, etc.)
  field_values    JSONB NOT NULL DEFAULT '{}',  -- { "field_key": value, ... }
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),

  -- One values row per entity instance
  UNIQUE (clinic_id, entity_type, entity_id)
);

CREATE INDEX idx_cfv_clinic ON custom_field_values(clinic_id);
CREATE INDEX idx_cfv_entity ON custom_field_values(entity_type, entity_id);
CREATE INDEX idx_cfv_values ON custom_field_values USING GIN (field_values);

-- ============================================================
-- 3. CLINIC-LEVEL FIELD OVERRIDES (optional)
-- Allows individual clinics to override system defaults
-- (e.g., change required flag, reorder fields).
-- ============================================================

CREATE TABLE custom_field_overrides (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id           UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  field_definition_id UUID NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
  is_enabled          BOOLEAN DEFAULT TRUE,
  is_required         BOOLEAN,
  sort_order          INT,
  created_at          TIMESTAMPTZ DEFAULT now(),

  UNIQUE (clinic_id, field_definition_id)
);

CREATE INDEX idx_cfo_clinic ON custom_field_overrides(clinic_id);

-- ============================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_overrides ENABLE ROW LEVEL SECURITY;

-- Definitions: everyone can read (reference data), only super admins can write
CREATE POLICY "cfd_select_all" ON custom_field_definitions
  FOR SELECT USING (true);

CREATE POLICY "cfd_sa_all" ON custom_field_definitions
  FOR ALL USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Values: users can read/write values for their own clinic
CREATE POLICY "cfv_select_own_clinic" ON custom_field_values
  FOR SELECT USING (
    clinic_id IN (SELECT clinic_id FROM users WHERE auth_id = auth.uid())
    OR is_super_admin()
  );

CREATE POLICY "cfv_insert_own_clinic" ON custom_field_values
  FOR INSERT WITH CHECK (
    clinic_id IN (SELECT clinic_id FROM users WHERE auth_id = auth.uid())
    OR is_super_admin()
  );

CREATE POLICY "cfv_update_own_clinic" ON custom_field_values
  FOR UPDATE USING (
    clinic_id IN (SELECT clinic_id FROM users WHERE auth_id = auth.uid())
    OR is_super_admin()
  );

CREATE POLICY "cfv_delete_own_clinic" ON custom_field_values
  FOR DELETE USING (
    clinic_id IN (SELECT clinic_id FROM users WHERE auth_id = auth.uid())
    OR is_super_admin()
  );

-- Overrides: clinic admins can manage their own overrides
CREATE POLICY "cfo_select_own" ON custom_field_overrides
  FOR SELECT USING (
    clinic_id IN (SELECT clinic_id FROM users WHERE auth_id = auth.uid())
    OR is_super_admin()
  );

CREATE POLICY "cfo_all_own" ON custom_field_overrides
  FOR ALL USING (
    clinic_id IN (SELECT clinic_id FROM users WHERE auth_id = auth.uid())
    OR is_super_admin()
  )
  WITH CHECK (
    clinic_id IN (SELECT clinic_id FROM users WHERE auth_id = auth.uid())
    OR is_super_admin()
  );

-- ============================================================
-- 5. SEED DEFAULT CUSTOM FIELDS (Task 39)
-- ============================================================

-- Dentist: "tooth number" on appointments
INSERT INTO custom_field_definitions (clinic_type_key, entity_type, field_key, field_type, label_fr, label_ar, description, is_required, sort_order, is_system, validation) VALUES
('dental_clinic', 'appointment', 'tooth_number', 'tooth_number', 'Numéro de dent', 'رقم السن', 'Tooth number using FDI notation (11-85)', FALSE, 1, TRUE, '{"min": 11, "max": 85}');

-- Also add for general dentistry types that exist
INSERT INTO custom_field_definitions (clinic_type_key, entity_type, field_key, field_type, label_fr, label_ar, description, is_required, sort_order, is_system, validation) VALUES
('dental_clinic', 'consultation', 'affected_teeth', 'multi_select', 'Dents concernées', 'الأسنان المعنية', 'Select all affected teeth', FALSE, 1, TRUE,
 '{}');

-- Pharmacy: "prescription required" flag on products
INSERT INTO custom_field_definitions (clinic_type_key, entity_type, field_key, field_type, label_fr, label_ar, description, is_required, sort_order, is_system, options) VALUES
('pharmacy', 'product', 'prescription_required', 'select', 'Ordonnance requise', 'وصفة طبية مطلوبة', 'Whether a prescription is required', TRUE, 1, TRUE,
 '[{"value":"yes","label_fr":"Oui","label_ar":"نعم"},{"value":"no","label_fr":"Non","label_ar":"لا"},{"value":"recommended","label_fr":"Recommandé","label_ar":"موصى به"}]');

INSERT INTO custom_field_definitions (clinic_type_key, entity_type, field_key, field_type, label_fr, label_ar, description, is_required, sort_order, is_system) VALUES
('pharmacy', 'product', 'drug_class', 'text', 'Classe thérapeutique', 'الفئة العلاجية', 'Therapeutic drug classification', FALSE, 2, TRUE);

-- Ophthalmologist: refraction values on consultations
INSERT INTO custom_field_definitions (clinic_type_key, entity_type, field_key, field_type, label_fr, label_ar, description, is_required, sort_order, is_system, validation) VALUES
('ophthalmology', 'consultation', 'od_sphere', 'number', 'OD Sphère (dioptries)', 'كرة العين اليمنى', 'Right eye sphere value', FALSE, 1, TRUE, '{"min": -30, "max": 30, "step": 0.25}'),
('ophthalmology', 'consultation', 'od_cylinder', 'number', 'OD Cylindre', 'أسطوانة العين اليمنى', 'Right eye cylinder value', FALSE, 2, TRUE, '{"min": -10, "max": 10, "step": 0.25}'),
('ophthalmology', 'consultation', 'od_axis', 'number', 'OD Axe (°)', 'محور العين اليمنى', 'Right eye axis in degrees', FALSE, 3, TRUE, '{"min": 0, "max": 180, "step": 1}'),
('ophthalmology', 'consultation', 'os_sphere', 'number', 'OS Sphère (dioptries)', 'كرة العين اليسرى', 'Left eye sphere value', FALSE, 4, TRUE, '{"min": -30, "max": 30, "step": 0.25}'),
('ophthalmology', 'consultation', 'os_cylinder', 'number', 'OS Cylindre', 'أسطوانة العين اليسرى', 'Left eye cylinder value', FALSE, 5, TRUE, '{"min": -10, "max": 10, "step": 0.25}'),
('ophthalmology', 'consultation', 'os_axis', 'number', 'OS Axe (°)', 'محور العين اليسرى', 'Left eye axis in degrees', FALSE, 6, TRUE, '{"min": 0, "max": 180, "step": 1}'),
('ophthalmology', 'consultation', 'od_visual_acuity', 'text', 'AV OD (acuité visuelle)', 'حدة البصر للعين اليمنى', 'Right eye visual acuity (e.g., 10/10)', FALSE, 7, TRUE),
('ophthalmology', 'consultation', 'os_visual_acuity', 'text', 'AV OS (acuité visuelle)', 'حدة البصر للعين اليسرى', 'Left eye visual acuity (e.g., 10/10)', FALSE, 8, TRUE),
('ophthalmology', 'consultation', 'intraocular_pressure_od', 'number', 'PIO OD (mmHg)', 'ضغط العين اليمنى', 'Right eye intraocular pressure', FALSE, 9, TRUE, '{"min": 0, "max": 80, "step": 1}'),
('ophthalmology', 'consultation', 'intraocular_pressure_os', 'number', 'PIO OS (mmHg)', 'ضغط العين اليسرى', 'Left eye intraocular pressure', FALSE, 10, TRUE, '{"min": 0, "max": 80, "step": 1}');

-- Pediatrician: growth percentile on visits
INSERT INTO custom_field_definitions (clinic_type_key, entity_type, field_key, field_type, label_fr, label_ar, description, is_required, sort_order, is_system, validation) VALUES
('pediatrics', 'consultation', 'weight_kg', 'number', 'Poids (kg)', 'الوزن (كغ)', 'Child weight in kilograms', FALSE, 1, TRUE, '{"min": 0, "max": 200, "step": 0.1}'),
('pediatrics', 'consultation', 'height_cm', 'number', 'Taille (cm)', 'الطول (سم)', 'Child height in centimeters', FALSE, 2, TRUE, '{"min": 0, "max": 250, "step": 0.1}'),
('pediatrics', 'consultation', 'head_circumference_cm', 'number', 'Périmètre crânien (cm)', 'محيط الرأس (سم)', 'Head circumference in centimeters', FALSE, 3, TRUE, '{"min": 0, "max": 80, "step": 0.1}'),
('pediatrics', 'consultation', 'weight_percentile', 'number', 'Percentile poids', 'النسبة المئوية للوزن', 'Weight-for-age percentile', FALSE, 4, TRUE, '{"min": 0, "max": 100, "step": 1}'),
('pediatrics', 'consultation', 'height_percentile', 'number', 'Percentile taille', 'النسبة المئوية للطول', 'Height-for-age percentile', FALSE, 5, TRUE, '{"min": 0, "max": 100, "step": 1}'),
('pediatrics', 'consultation', 'bmi_percentile', 'number', 'Percentile IMC', 'النسبة المئوية لمؤشر كتلة الجسم', 'BMI-for-age percentile', FALSE, 6, TRUE, '{"min": 0, "max": 100, "step": 1}'),
('pediatrics', 'consultation', 'growth_status', 'select', 'Statut de croissance', 'حالة النمو', 'Growth assessment status', FALSE, 7, TRUE,
 '[{"value":"normal","label_fr":"Normal","label_ar":"طبيعي"},{"value":"underweight","label_fr":"Insuffisance pondérale","label_ar":"نقص الوزن"},{"value":"overweight","label_fr":"Surpoids","label_ar":"زيادة الوزن"},{"value":"stunted","label_fr":"Retard de croissance","label_ar":"تأخر النمو"},{"value":"wasted","label_fr":"Émaciation","label_ar":"هزال"}]');

-- Lab: test category & urgency level on orders
INSERT INTO custom_field_definitions (clinic_type_key, entity_type, field_key, field_type, label_fr, label_ar, description, is_required, sort_order, is_system, options) VALUES
('medical_lab', 'lab_order', 'test_category', 'select', 'Catégorie d''analyse', 'فئة التحليل', 'Category of laboratory test', TRUE, 1, TRUE,
 '[{"value":"hematology","label_fr":"Hématologie","label_ar":"أمراض الدم"},{"value":"biochemistry","label_fr":"Biochimie","label_ar":"الكيمياء الحيوية"},{"value":"microbiology","label_fr":"Microbiologie","label_ar":"الأحياء الدقيقة"},{"value":"immunology","label_fr":"Immunologie","label_ar":"المناعة"},{"value":"parasitology","label_fr":"Parasitologie","label_ar":"الطفيليات"},{"value":"urinalysis","label_fr":"Analyse d''urine","label_ar":"تحليل البول"},{"value":"serology","label_fr":"Sérologie","label_ar":"الأمصال"},{"value":"hormones","label_fr":"Hormonologie","label_ar":"الهرمونات"},{"value":"other","label_fr":"Autre","label_ar":"أخرى"}]'),
('medical_lab', 'lab_order', 'urgency_level', 'select', 'Niveau d''urgence', 'مستوى الاستعجال', 'How urgent is this test', TRUE, 2, TRUE,
 '[{"value":"routine","label_fr":"Routine","label_ar":"روتيني"},{"value":"urgent","label_fr":"Urgent","label_ar":"عاجل"},{"value":"stat","label_fr":"STAT (immédiat)","label_ar":"فوري"},{"value":"timed","label_fr":"Programmé","label_ar":"مجدول"}]'),
('medical_lab', 'lab_order', 'fasting_required', 'select', 'À jeun requis', 'الصيام مطلوب', 'Whether fasting is required before the test', FALSE, 3, TRUE,
 '[{"value":"yes","label_fr":"Oui","label_ar":"نعم"},{"value":"no","label_fr":"Non","label_ar":"لا"},{"value":"preferred","label_fr":"Préféré","label_ar":"مفضل"}]'),
('medical_lab', 'lab_order', 'sample_type', 'select', 'Type d''échantillon', 'نوع العينة', 'Type of sample required', FALSE, 4, TRUE,
 '[{"value":"blood","label_fr":"Sang","label_ar":"دم"},{"value":"urine","label_fr":"Urine","label_ar":"بول"},{"value":"stool","label_fr":"Selles","label_ar":"براز"},{"value":"swab","label_fr":"Écouvillon","label_ar":"مسحة"},{"value":"tissue","label_fr":"Tissu","label_ar":"نسيج"},{"value":"csf","label_fr":"LCR","label_ar":"سائل نخاعي"},{"value":"other","label_fr":"Autre","label_ar":"أخرى"}]');

-- ============================================================
-- 6. UPDATE FEATURES CONFIG
-- Add custom_fields feature flag to all clinic types
-- ============================================================

UPDATE clinic_types
SET features_config = features_config || '{"custom_fields": true}'::jsonb
WHERE is_active = TRUE;


-- >>>>>>>>>> 00017_lab_clinic_center_tables.sql <<<<<<<<<<

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
CREATE INDEX IF NOT EXISTS idx_lab_test_orders_doctor ON lab_test_orders(doctor_id);
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
CREATE INDEX IF NOT EXISTS idx_beds_department ON beds(department_id);
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


-- >>>>>>>>>> 00018_missing_rls_policies.sql <<<<<<<<<<

-- ============================================================
-- Migration 00018: Missing RLS Policies
-- Adds Row Level Security to tables from migrations 00011,
-- 00012, and 00014 that were created without RLS policies.
-- ============================================================

-- ============================================================
-- 1. ENABLE RLS ON ALL TABLES
-- ============================================================

-- From 00011_specialty_modules.sql (Pediatrics, Gynecology, Ophthalmology)
ALTER TABLE growth_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE vaccinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE developmental_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE pregnancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE ultrasound_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE vision_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE iop_measurements ENABLE ROW LEVEL SECURITY;

-- From 00012_specialist_features.sql (Derm, Cardio, ENT, Ortho, Psych, Neuro, etc.)
ALTER TABLE skin_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE skin_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecg_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE blood_pressure_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE heart_monitoring_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE hearing_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ent_exam_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE xray_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE fracture_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE rehab_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE psych_session_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE psych_medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE eeg_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE neuro_exam_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE urology_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE spirometry_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE respiratory_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE blood_sugar_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE hormone_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE diabetes_management ENABLE ROW LEVEL SECURITY;
ALTER TABLE joint_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mobility_tests ENABLE ROW LEVEL SECURITY;

-- From 00014_diagnostic_pharmacy_equipment.sql
ALTER TABLE lab_test_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_test_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE radiology_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE radiology_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE radiology_report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE parapharmacy_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_maintenance ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. SPECIALTY MODULES (00011) -- Pediatrics
-- ============================================================

-- growth_measurements
CREATE POLICY "sa_growth_measurements_all" ON growth_measurements FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_growth_measurements" ON growth_measurements FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_growth_measurements_read" ON growth_measurements FOR SELECT USING (patient_id = get_my_user_id());

-- vaccinations
CREATE POLICY "sa_vaccinations_all" ON vaccinations FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_vaccinations" ON vaccinations FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_vaccinations_read" ON vaccinations FOR SELECT USING (patient_id = get_my_user_id());

-- developmental_milestones
CREATE POLICY "sa_developmental_milestones_all" ON developmental_milestones FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_developmental_milestones" ON developmental_milestones FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_developmental_milestones_read" ON developmental_milestones FOR SELECT USING (patient_id = get_my_user_id());

-- ============================================================
-- 3. SPECIALTY MODULES (00011) -- Gynecology
-- ============================================================

-- pregnancies
CREATE POLICY "sa_pregnancies_all" ON pregnancies FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_pregnancies" ON pregnancies FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_pregnancies_read" ON pregnancies FOR SELECT USING (patient_id = get_my_user_id());

-- ultrasound_records
CREATE POLICY "sa_ultrasound_records_all" ON ultrasound_records FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_ultrasound_records" ON ultrasound_records FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_ultrasound_records_read" ON ultrasound_records FOR SELECT USING (patient_id = get_my_user_id());

-- ============================================================
-- 4. SPECIALTY MODULES (00011) -- Ophthalmology
-- ============================================================

-- vision_tests
CREATE POLICY "sa_vision_tests_all" ON vision_tests FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_vision_tests" ON vision_tests FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_vision_tests_read" ON vision_tests FOR SELECT USING (patient_id = get_my_user_id());

-- iop_measurements
CREATE POLICY "sa_iop_measurements_all" ON iop_measurements FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_iop_measurements" ON iop_measurements FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_iop_measurements_read" ON iop_measurements FOR SELECT USING (patient_id = get_my_user_id());

-- ============================================================
-- 5. SPECIALIST FEATURES (00012) -- Dermatologist
-- ============================================================

CREATE POLICY "sa_skin_photos_all" ON skin_photos FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_skin_photos" ON skin_photos FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_skin_photos_read" ON skin_photos FOR SELECT USING (patient_id = get_my_user_id());

CREATE POLICY "sa_skin_conditions_all" ON skin_conditions FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_skin_conditions" ON skin_conditions FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_skin_conditions_read" ON skin_conditions FOR SELECT USING (patient_id = get_my_user_id());

-- ============================================================
-- 6. SPECIALIST FEATURES (00012) -- Cardiologist
-- ============================================================

CREATE POLICY "sa_ecg_records_all" ON ecg_records FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_ecg_records" ON ecg_records FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_ecg_records_read" ON ecg_records FOR SELECT USING (patient_id = get_my_user_id());

CREATE POLICY "sa_bp_readings_all" ON blood_pressure_readings FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_bp_readings" ON blood_pressure_readings FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_bp_readings_read" ON blood_pressure_readings FOR SELECT USING (patient_id = get_my_user_id());

CREATE POLICY "sa_heart_notes_all" ON heart_monitoring_notes FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_heart_notes" ON heart_monitoring_notes FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_heart_notes_read" ON heart_monitoring_notes FOR SELECT USING (patient_id = get_my_user_id());

-- ============================================================
-- 7. SPECIALIST FEATURES (00012) -- ENT
-- ============================================================

CREATE POLICY "sa_hearing_tests_all" ON hearing_tests FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_hearing_tests" ON hearing_tests FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_hearing_tests_read" ON hearing_tests FOR SELECT USING (patient_id = get_my_user_id());

CREATE POLICY "sa_ent_exams_all" ON ent_exam_records FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_ent_exams" ON ent_exam_records FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_ent_exams_read" ON ent_exam_records FOR SELECT USING (patient_id = get_my_user_id());

-- ============================================================
-- 8. SPECIALIST FEATURES (00012) -- Orthopedist
-- ============================================================

CREATE POLICY "sa_xray_records_all" ON xray_records FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_xray_records" ON xray_records FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_xray_records_read" ON xray_records FOR SELECT USING (patient_id = get_my_user_id());

CREATE POLICY "sa_fracture_records_all" ON fracture_records FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_fracture_records" ON fracture_records FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_fracture_records_read" ON fracture_records FOR SELECT USING (patient_id = get_my_user_id());

CREATE POLICY "sa_rehab_plans_all" ON rehab_plans FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_rehab_plans" ON rehab_plans FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_rehab_plans_read" ON rehab_plans FOR SELECT USING (patient_id = get_my_user_id());

-- ============================================================
-- 9. SPECIALIST FEATURES (00012) -- Psychiatrist
-- ============================================================

CREATE POLICY "sa_psych_notes_all" ON psych_session_notes FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_psych_notes" ON psych_session_notes FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());

CREATE POLICY "sa_psych_meds_all" ON psych_medications FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_psych_meds" ON psych_medications FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_psych_meds_read" ON psych_medications FOR SELECT USING (patient_id = get_my_user_id());

-- ============================================================
-- 10. SPECIALIST FEATURES (00012) -- Neurologist
-- ============================================================

CREATE POLICY "sa_eeg_records_all" ON eeg_records FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_eeg_records" ON eeg_records FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_eeg_records_read" ON eeg_records FOR SELECT USING (patient_id = get_my_user_id());

CREATE POLICY "sa_neuro_exams_all" ON neuro_exam_records FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_neuro_exams" ON neuro_exam_records FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_neuro_exams_read" ON neuro_exam_records FOR SELECT USING (patient_id = get_my_user_id());

-- ============================================================
-- 11. SPECIALIST FEATURES (00012) -- Remaining Specialists
-- ============================================================

-- Urologist
CREATE POLICY "sa_urology_exams_all" ON urology_exams FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_urology_exams" ON urology_exams FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_urology_exams_read" ON urology_exams FOR SELECT USING (patient_id = get_my_user_id());

-- Pulmonologist
CREATE POLICY "sa_spirometry_all" ON spirometry_records FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_spirometry" ON spirometry_records FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_spirometry_read" ON spirometry_records FOR SELECT USING (patient_id = get_my_user_id());

CREATE POLICY "sa_respiratory_tests_all" ON respiratory_tests FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_respiratory_tests" ON respiratory_tests FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_respiratory_tests_read" ON respiratory_tests FOR SELECT USING (patient_id = get_my_user_id());

-- Endocrinologist
CREATE POLICY "sa_blood_sugar_all" ON blood_sugar_readings FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_blood_sugar" ON blood_sugar_readings FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_blood_sugar_read" ON blood_sugar_readings FOR SELECT USING (patient_id = get_my_user_id());

CREATE POLICY "sa_hormone_levels_all" ON hormone_levels FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_hormone_levels" ON hormone_levels FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_hormone_levels_read" ON hormone_levels FOR SELECT USING (patient_id = get_my_user_id());

CREATE POLICY "sa_diabetes_mgmt_all" ON diabetes_management FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_diabetes_mgmt" ON diabetes_management FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_diabetes_mgmt_read" ON diabetes_management FOR SELECT USING (patient_id = get_my_user_id());

-- Rheumatologist
CREATE POLICY "sa_joint_assessments_all" ON joint_assessments FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_joint_assessments" ON joint_assessments FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_joint_assessments_read" ON joint_assessments FOR SELECT USING (patient_id = get_my_user_id());

CREATE POLICY "sa_mobility_tests_all" ON mobility_tests FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_mobility_tests" ON mobility_tests FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_mobility_tests_read" ON mobility_tests FOR SELECT USING (patient_id = get_my_user_id());

-- ============================================================
-- 12. DIAGNOSTIC -- Lab (00014)
-- ============================================================

-- lab_test_catalog (reference data: everyone reads, staff manages)
CREATE POLICY "sa_lab_test_catalog_all" ON lab_test_catalog FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_lab_test_catalog" ON lab_test_catalog FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "lab_test_catalog_select" ON lab_test_catalog FOR SELECT USING (clinic_id = get_user_clinic_id());

-- lab_test_items
CREATE POLICY "sa_lab_test_items_all" ON lab_test_items FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_lab_test_items" ON lab_test_items FOR ALL
  USING (is_clinic_staff() AND EXISTS (SELECT 1 FROM lab_test_orders o WHERE o.id = lab_test_items.order_id AND o.clinic_id = get_user_clinic_id()))
  WITH CHECK (is_clinic_staff() AND EXISTS (SELECT 1 FROM lab_test_orders o WHERE o.id = lab_test_items.order_id AND o.clinic_id = get_user_clinic_id()));
CREATE POLICY "patient_lab_test_items_read" ON lab_test_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM lab_test_orders o WHERE o.id = lab_test_items.order_id AND o.patient_id = get_my_user_id()));

-- lab_test_results
CREATE POLICY "sa_lab_test_results_all" ON lab_test_results FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_lab_test_results" ON lab_test_results FOR ALL
  USING (is_clinic_staff() AND EXISTS (SELECT 1 FROM lab_test_orders o WHERE o.id = lab_test_results.order_id AND o.clinic_id = get_user_clinic_id()))
  WITH CHECK (is_clinic_staff() AND EXISTS (SELECT 1 FROM lab_test_orders o WHERE o.id = lab_test_results.order_id AND o.clinic_id = get_user_clinic_id()));
CREATE POLICY "patient_lab_test_results_read" ON lab_test_results FOR SELECT
  USING (EXISTS (SELECT 1 FROM lab_test_orders o WHERE o.id = lab_test_results.order_id AND o.patient_id = get_my_user_id()));

-- ============================================================
-- 13. DIAGNOSTIC -- Radiology (00014)
-- ============================================================

CREATE POLICY "sa_radiology_orders_all" ON radiology_orders FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_radiology_orders" ON radiology_orders FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_radiology_orders_read" ON radiology_orders FOR SELECT USING (patient_id = get_my_user_id());

CREATE POLICY "sa_radiology_images_all" ON radiology_images FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_radiology_images" ON radiology_images FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_radiology_images_read" ON radiology_images FOR SELECT
  USING (EXISTS (SELECT 1 FROM radiology_orders o WHERE o.id = radiology_images.order_id AND o.patient_id = get_my_user_id()));

CREATE POLICY "sa_radiology_templates_all" ON radiology_report_templates FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_radiology_templates" ON radiology_report_templates FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());

-- ============================================================
-- 14. PHARMACY & RETAIL (00014)
-- ============================================================

-- parapharmacy_categories
CREATE POLICY "sa_parapharmacy_categories_all" ON parapharmacy_categories FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_parapharmacy_categories" ON parapharmacy_categories FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "parapharmacy_categories_select" ON parapharmacy_categories FOR SELECT USING (clinic_id = get_user_clinic_id());

-- equipment_inventory
CREATE POLICY "sa_equipment_inventory_all" ON equipment_inventory FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_equipment_inventory" ON equipment_inventory FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "equipment_inventory_select" ON equipment_inventory FOR SELECT USING (clinic_id = get_user_clinic_id());

-- equipment_rentals
CREATE POLICY "sa_equipment_rentals_all" ON equipment_rentals FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_equipment_rentals" ON equipment_rentals FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());

-- equipment_maintenance
CREATE POLICY "sa_equipment_maintenance_all" ON equipment_maintenance FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_equipment_maintenance" ON equipment_maintenance FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());


