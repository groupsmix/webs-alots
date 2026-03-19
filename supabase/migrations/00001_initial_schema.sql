-- ============================================================
-- Health SaaS Platform — Initial Schema
-- Supports: Doctor, Dentist, Pharmacy (multi-tenant via clinic_id)
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- SHARED TABLES (all systems)
-- ============================================================

-- Clinics (tenants)
CREATE TABLE clinics (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('doctor', 'dentist', 'pharmacy')),
  tier         TEXT NOT NULL DEFAULT 'pro' CHECK (tier IN ('vitrine', 'cabinet', 'pro', 'premium', 'saas')),
  domain       TEXT UNIQUE,
  config       JSONB DEFAULT '{}',
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- Users (all roles)
CREATE TABLE users (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id      UUID UNIQUE,  -- links to Supabase Auth user
  clinic_id    UUID REFERENCES clinics(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN ('super_admin', 'clinic_admin', 'receptionist', 'doctor', 'patient')),
  name         TEXT NOT NULL,
  phone        TEXT,
  email        TEXT,
  avatar_url   TEXT,
  is_active    BOOLEAN DEFAULT TRUE,
  metadata     JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- Services offered by clinics
CREATE TABLE services (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id    UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  duration_min INT NOT NULL DEFAULT 30,
  price        DECIMAL(10,2),
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Time slots configuration
CREATE TABLE time_slots (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id    UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  doctor_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week  INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  max_capacity INT DEFAULT 1,
  buffer_min   INT DEFAULT 10,
  is_active    BOOLEAN DEFAULT TRUE
);

-- Appointments
CREATE TABLE appointments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id         UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id        UUID NOT NULL REFERENCES users(id),
  doctor_id         UUID NOT NULL REFERENCES users(id),
  service_id        UUID REFERENCES services(id),
  appointment_date  DATE NOT NULL,
  start_time        TIME NOT NULL,
  end_time          TIME NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'confirmed', 'checked_in', 'in_progress', 'completed', 'no_show', 'cancelled', 'rescheduled')),
  is_first_visit    BOOLEAN DEFAULT FALSE,
  is_walk_in        BOOLEAN DEFAULT FALSE,
  insurance_flag    BOOLEAN DEFAULT FALSE,
  booking_source    TEXT DEFAULT 'online' CHECK (booking_source IN ('online', 'phone', 'walk_in', 'whatsapp')),
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- Waiting list
CREATE TABLE waiting_list (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  preferred_date  DATE,
  status          TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'notified', 'booked', 'expired')),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Notifications
CREATE TABLE notifications (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id    UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id),
  type         TEXT NOT NULL,
  channel      TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email', 'sms', 'in_app')),
  title        TEXT,
  body         TEXT,
  is_read      BOOLEAN DEFAULT FALSE,
  sent_at      TIMESTAMPTZ DEFAULT now()
);

-- Payments
CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  appointment_id  UUID REFERENCES appointments(id),
  patient_id      UUID NOT NULL REFERENCES users(id),
  amount          DECIMAL(10,2) NOT NULL,
  method          TEXT CHECK (method IN ('cash', 'card', 'transfer', 'online')),
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'refunded', 'failed')),
  reference       TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Reviews
CREATE TABLE reviews (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id    UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id   UUID NOT NULL REFERENCES users(id),
  doctor_id    UUID REFERENCES users(id),
  stars        INT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment      TEXT,
  response     TEXT,
  is_visible   BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Documents (uploaded files)
CREATE TABLE documents (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id    UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id),
  type         TEXT NOT NULL CHECK (type IN ('prescription', 'lab_result', 'xray', 'insurance', 'invoice', 'photo', 'other')),
  file_url     TEXT NOT NULL,
  file_name    TEXT,
  file_size    INT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- DOCTOR EXTRAS
-- ============================================================

-- Consultation notes (private to doctor)
CREATE TABLE consultation_notes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  appointment_id  UUID NOT NULL REFERENCES appointments(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  patient_id      UUID NOT NULL REFERENCES users(id),
  notes           TEXT,
  diagnosis       TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Prescriptions
CREATE TABLE prescriptions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  appointment_id  UUID REFERENCES appointments(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  patient_id      UUID NOT NULL REFERENCES users(id),
  items           JSONB NOT NULL DEFAULT '[]',
  notes           TEXT,
  pdf_url         TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Family members (linked patient accounts)
CREATE TABLE family_members (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  primary_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  relationship    TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- DENTIST EXTRAS
-- ============================================================

-- Odontogram (tooth chart)
CREATE TABLE odontogram (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id     UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id    UUID NOT NULL REFERENCES users(id),
  tooth_number  INT NOT NULL CHECK (tooth_number BETWEEN 1 AND 32),
  status        TEXT DEFAULT 'healthy' CHECK (status IN ('healthy', 'decayed', 'filled', 'missing', 'crown', 'implant', 'root_canal', 'extraction_needed')),
  notes         TEXT,
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Treatment plans
CREATE TABLE treatment_plans (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id     UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id    UUID NOT NULL REFERENCES users(id),
  doctor_id     UUID NOT NULL REFERENCES users(id),
  title         TEXT NOT NULL,
  steps         JSONB NOT NULL DEFAULT '[]',
  total_cost    DECIMAL(10,2),
  status        TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Lab orders (dental lab)
CREATE TABLE lab_orders (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id     UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id    UUID NOT NULL REFERENCES users(id),
  doctor_id     UUID NOT NULL REFERENCES users(id),
  lab_name      TEXT,
  description   TEXT NOT NULL,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'in_progress', 'ready', 'delivered')),
  due_date      DATE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Installment payments (for treatment plans)
CREATE TABLE installments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id         UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  treatment_plan_id UUID NOT NULL REFERENCES treatment_plans(id) ON DELETE CASCADE,
  patient_id        UUID NOT NULL REFERENCES users(id),
  amount            DECIMAL(10,2) NOT NULL,
  due_date          DATE NOT NULL,
  paid_date         DATE,
  status            TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  receipt_url       TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- PHARMACY EXTRAS
-- ============================================================

-- Products catalog
CREATE TABLE products (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id     UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  category      TEXT,
  description   TEXT,
  price         DECIMAL(10,2),
  requires_prescription BOOLEAN DEFAULT FALSE,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Stock management
CREATE TABLE stock (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id     UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity      INT NOT NULL DEFAULT 0,
  min_threshold INT DEFAULT 10,
  expiry_date   DATE,
  batch_number  TEXT,
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Suppliers
CREATE TABLE suppliers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id     UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  contact_phone TEXT,
  contact_email TEXT,
  address       TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Prescription requests (patient uploads)
CREATE TABLE prescription_requests (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id     UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id    UUID NOT NULL REFERENCES users(id),
  image_url     TEXT NOT NULL,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'ready', 'partial', 'delivered', 'cancelled')),
  notes         TEXT,
  delivery_requested BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Loyalty points
CREATE TABLE loyalty_points (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id     UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id    UUID NOT NULL REFERENCES users(id),
  points        INT NOT NULL DEFAULT 0,
  last_earned   TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
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
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescription_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_points ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's clinic_id
CREATE OR REPLACE FUNCTION get_user_clinic_id()
RETURNS UUID AS $$
  SELECT clinic_id FROM users WHERE auth_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function to check if current user is super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid() AND role = 'super_admin'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- RLS Policies: users can only see data for their own clinic
-- Super admins can see everything

CREATE POLICY "Users see own clinic data" ON users
  FOR SELECT USING (
    clinic_id = get_user_clinic_id() OR is_super_admin()
  );

CREATE POLICY "Clinic isolation" ON appointments
  FOR ALL USING (
    clinic_id = get_user_clinic_id() OR is_super_admin()
  );

CREATE POLICY "Clinic isolation" ON services
  FOR ALL USING (
    clinic_id = get_user_clinic_id() OR is_super_admin()
  );

CREATE POLICY "Clinic isolation" ON time_slots
  FOR ALL USING (
    clinic_id = get_user_clinic_id() OR is_super_admin()
  );

CREATE POLICY "Clinic isolation" ON notifications
  FOR ALL USING (
    clinic_id = get_user_clinic_id() OR is_super_admin()
  );

CREATE POLICY "Clinic isolation" ON payments
  FOR ALL USING (
    clinic_id = get_user_clinic_id() OR is_super_admin()
  );

CREATE POLICY "Clinic isolation" ON reviews
  FOR ALL USING (
    clinic_id = get_user_clinic_id() OR is_super_admin()
  );

CREATE POLICY "Clinic isolation" ON documents
  FOR ALL USING (
    clinic_id = get_user_clinic_id() OR is_super_admin()
  );

CREATE POLICY "Clinic isolation" ON consultation_notes
  FOR ALL USING (
    clinic_id = get_user_clinic_id() OR is_super_admin()
  );

CREATE POLICY "Clinic isolation" ON prescriptions
  FOR ALL USING (
    clinic_id = get_user_clinic_id() OR is_super_admin()
  );

CREATE POLICY "Clinic isolation" ON waiting_list
  FOR ALL USING (
    clinic_id = get_user_clinic_id() OR is_super_admin()
  );

CREATE POLICY "Clinic isolation" ON odontogram
  FOR ALL USING (
    clinic_id = get_user_clinic_id() OR is_super_admin()
  );

CREATE POLICY "Clinic isolation" ON treatment_plans
  FOR ALL USING (
    clinic_id = get_user_clinic_id() OR is_super_admin()
  );

CREATE POLICY "Clinic isolation" ON lab_orders
  FOR ALL USING (
    clinic_id = get_user_clinic_id() OR is_super_admin()
  );

CREATE POLICY "Clinic isolation" ON installments
  FOR ALL USING (
    clinic_id = get_user_clinic_id() OR is_super_admin()
  );

CREATE POLICY "Clinic isolation" ON products
  FOR ALL USING (
    clinic_id = get_user_clinic_id() OR is_super_admin()
  );

CREATE POLICY "Clinic isolation" ON stock
  FOR ALL USING (
    clinic_id = get_user_clinic_id() OR is_super_admin()
  );

CREATE POLICY "Clinic isolation" ON suppliers
  FOR ALL USING (
    clinic_id = get_user_clinic_id() OR is_super_admin()
  );

CREATE POLICY "Clinic isolation" ON prescription_requests
  FOR ALL USING (
    clinic_id = get_user_clinic_id() OR is_super_admin()
  );

CREATE POLICY "Clinic isolation" ON loyalty_points
  FOR ALL USING (
    clinic_id = get_user_clinic_id() OR is_super_admin()
  );

-- Super admin can see all clinics
CREATE POLICY "Super admin sees all clinics" ON clinics
  FOR SELECT USING (is_super_admin() OR id = get_user_clinic_id());

-- Public reviews (visible without login)
CREATE POLICY "Public reviews" ON reviews
  FOR SELECT USING (is_visible = TRUE);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_users_clinic ON users(clinic_id);
CREATE INDEX idx_users_auth ON users(auth_id);
CREATE INDEX idx_appointments_clinic ON appointments(clinic_id);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_payments_clinic ON payments(clinic_id);
CREATE INDEX idx_products_clinic ON products(clinic_id);
CREATE INDEX idx_stock_product ON stock(product_id);
CREATE INDEX idx_stock_expiry ON stock(expiry_date);
