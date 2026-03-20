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
