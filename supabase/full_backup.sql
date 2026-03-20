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
