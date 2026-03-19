-- ============================================================
-- Migration 00002: Auth + Role-Based RLS + Missing Tables
-- Adds: auth triggers, helper functions, granular RLS policies,
--        missing tables (clinic_holidays, sterilization_log, purchase_orders)
-- ============================================================

-- ============================================================
-- 1. ADDITIONAL TABLES
-- ============================================================

-- Clinic holidays / closures
CREATE TABLE IF NOT EXISTS clinic_holidays (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id    UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Sterilization log (dentist system)
CREATE TABLE IF NOT EXISTS sterilization_log (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id     UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  tool_name     TEXT NOT NULL,
  sterilized_by UUID REFERENCES users(id),
  sterilized_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_due      TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Purchase orders (pharmacy system)
CREATE TABLE IF NOT EXISTS purchase_orders (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id     UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  supplier_id   UUID NOT NULL REFERENCES suppliers(id),
  status        TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'confirmed', 'received', 'cancelled')),
  total_amount  DECIMAL(10,2),
  notes         TEXT,
  ordered_at    TIMESTAMPTZ,
  received_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Purchase order items
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id        UUID NOT NULL REFERENCES products(id),
  quantity          INT NOT NULL,
  unit_price        DECIMAL(10,2),
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- Loyalty transactions (pharmacy: track individual point earn/redeem events)
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id     UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id    UUID NOT NULL REFERENCES users(id),
  points        INT NOT NULL, -- positive = earned, negative = redeemed
  reason        TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE clinic_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE sterilization_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

-- Additional indexes
CREATE INDEX IF NOT EXISTS idx_clinic_holidays_clinic ON clinic_holidays(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_holidays_dates ON clinic_holidays(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_sterilization_log_clinic ON sterilization_log(clinic_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_clinic ON purchase_orders(clinic_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_order ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_patient ON loyalty_transactions(patient_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_clinic ON loyalty_transactions(clinic_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_services_clinic ON services(clinic_id);
CREATE INDEX IF NOT EXISTS idx_time_slots_doctor ON time_slots(doctor_id);
CREATE INDEX IF NOT EXISTS idx_waiting_list_clinic ON waiting_list(clinic_id);
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_consultation_notes_doctor ON consultation_notes(doctor_id);
CREATE INDEX IF NOT EXISTS idx_consultation_notes_patient ON consultation_notes(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor ON prescriptions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_odontogram_patient ON odontogram(patient_id);
CREATE INDEX IF NOT EXISTS idx_treatment_plans_patient ON treatment_plans(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_clinic ON lab_orders(clinic_id);
CREATE INDEX IF NOT EXISTS idx_installments_plan ON installments(treatment_plan_id);
CREATE INDEX IF NOT EXISTS idx_prescription_requests_clinic ON prescription_requests(clinic_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_points_patient ON loyalty_points(patient_id);
CREATE INDEX IF NOT EXISTS idx_reviews_clinic ON reviews(clinic_id);
CREATE INDEX IF NOT EXISTS idx_family_members_primary ON family_members(primary_user_id);

-- ============================================================
-- 2. ENHANCED HELPER FUNCTIONS
-- ============================================================

-- Drop old helper functions so we can recreate them with better logic
DROP FUNCTION IF EXISTS get_user_clinic_id();
DROP FUNCTION IF EXISTS is_super_admin();

-- Get the current authenticated user's row from the users table
-- Returns the full row for reuse in multiple checks
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

-- Check if user is staff (clinic_admin, receptionist, or doctor) at a given clinic
CREATE OR REPLACE FUNCTION is_clinic_staff(check_clinic_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid()
      AND role IN ('clinic_admin', 'receptionist', 'doctor')
      AND clinic_id = check_clinic_id
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- 3. AUTH TRIGGER: Auto-create user profile on signup
-- ============================================================

-- When a new user signs up via Supabase Auth (phone OTP, email, etc.),
-- automatically insert a row in public.users with role = 'patient'
-- and link it to the auth.users record via auth_id.
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (auth_id, role, name, phone, email)
  VALUES (
    NEW.id,
    'patient',  -- default role; admins can upgrade later
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.phone, NEW.email, 'New User'),
    NEW.phone,
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- ============================================================
-- 4. UPDATED_AT TRIGGER (auto-update timestamps)
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to tables that have the column
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'clinics', 'users', 'appointments', 'consultation_notes',
      'treatment_plans', 'lab_orders', 'prescription_requests',
      'purchase_orders'
    ])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_updated_at ON %I; CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
      t, t
    );
  END LOOP;
END;
$$;

-- ============================================================
-- 5. DROP OLD SIMPLE RLS POLICIES
-- ============================================================

-- Drop all existing policies so we can recreate them with proper role granularity
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END;
$$;

-- ============================================================
-- 6. GRANULAR ROLE-BASED RLS POLICIES
-- ============================================================
-- Roles: super_admin, clinic_admin, receptionist, doctor, patient
--
-- Principle:
--   super_admin  -> full access to everything
--   clinic_admin -> full CRUD within their clinic
--   receptionist -> read/write appointments, patients, payments within clinic
--   doctor       -> read/write own patients & appointments within clinic
--   patient      -> read own data, create bookings/reviews
-- ============================================================

-- -------------------------------------------------------
-- CLINICS
-- -------------------------------------------------------
-- Super admin: full access
CREATE POLICY "sa_clinics_all" ON clinics
  FOR ALL USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Clinic admin: read own clinic
CREATE POLICY "admin_clinics_select" ON clinics
  FOR SELECT USING (id = get_user_clinic_id());

-- Clinic admin: update own clinic config
CREATE POLICY "admin_clinics_update" ON clinics
  FOR UPDATE USING (is_clinic_admin(id))
  WITH CHECK (is_clinic_admin(id));

-- Staff & patients: read own clinic
CREATE POLICY "staff_patient_clinics_select" ON clinics
  FOR SELECT USING (id = get_user_clinic_id());

-- -------------------------------------------------------
-- USERS
-- -------------------------------------------------------
-- Super admin: full access
CREATE POLICY "sa_users_all" ON users
  FOR ALL USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Clinic admin: read all users in own clinic
CREATE POLICY "admin_users_select" ON users
  FOR SELECT USING (clinic_id = get_user_clinic_id() AND get_user_role() = 'clinic_admin');

-- Clinic admin: manage staff in own clinic (insert/update/delete non-super-admin users)
CREATE POLICY "admin_users_insert" ON users
  FOR INSERT WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND get_user_role() = 'clinic_admin'
    AND role != 'super_admin'
  );

CREATE POLICY "admin_users_update" ON users
  FOR UPDATE USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() = 'clinic_admin'
    AND role != 'super_admin'
  ) WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND role != 'super_admin'
  );

CREATE POLICY "admin_users_delete" ON users
  FOR DELETE USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() = 'clinic_admin'
    AND role NOT IN ('super_admin', 'clinic_admin')
  );

-- Receptionist: read patients and doctors in own clinic
CREATE POLICY "receptionist_users_select" ON users
  FOR SELECT USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() = 'receptionist'
  );

-- Receptionist: register new patients
CREATE POLICY "receptionist_users_insert_patient" ON users
  FOR INSERT WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND get_user_role() = 'receptionist'
    AND role = 'patient'
  );

-- Doctor: read patients in own clinic + own profile
CREATE POLICY "doctor_users_select" ON users
  FOR SELECT USING (
    get_user_role() = 'doctor'
    AND (
      id = get_my_user_id()
      OR (clinic_id = get_user_clinic_id() AND role = 'patient')
    )
  );

-- Patient: read own profile + doctors in clinic
CREATE POLICY "patient_users_select" ON users
  FOR SELECT USING (
    get_user_role() = 'patient'
    AND (
      id = get_my_user_id()
      OR (clinic_id = get_user_clinic_id() AND role IN ('doctor', 'clinic_admin'))
    )
  );

-- Patient: update own profile
CREATE POLICY "patient_users_update_self" ON users
  FOR UPDATE USING (
    id = get_my_user_id() AND get_user_role() = 'patient'
  ) WITH CHECK (
    id = get_my_user_id() AND role = 'patient'
  );

-- -------------------------------------------------------
-- SERVICES
-- -------------------------------------------------------
-- Super admin: full access
CREATE POLICY "sa_services_all" ON services
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Clinic admin: full CRUD within own clinic
CREATE POLICY "admin_services_all" ON services
  FOR ALL USING (
    clinic_id = get_user_clinic_id() AND get_user_role() = 'clinic_admin'
  ) WITH CHECK (
    clinic_id = get_user_clinic_id()
  );

-- Staff & patients: read active services in own clinic
CREATE POLICY "read_services" ON services
  FOR SELECT USING (
    clinic_id = get_user_clinic_id() AND is_active = TRUE
  );

-- -------------------------------------------------------
-- TIME_SLOTS
-- -------------------------------------------------------
CREATE POLICY "sa_time_slots_all" ON time_slots
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "admin_time_slots_all" ON time_slots
  FOR ALL USING (
    clinic_id = get_user_clinic_id() AND get_user_role() = 'clinic_admin'
  ) WITH CHECK (clinic_id = get_user_clinic_id());

-- Doctor: manage own time slots
CREATE POLICY "doctor_time_slots_all" ON time_slots
  FOR ALL USING (
    clinic_id = get_user_clinic_id()
    AND doctor_id = get_my_user_id()
    AND get_user_role() = 'doctor'
  ) WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND doctor_id = get_my_user_id()
  );

-- Staff & patients: read active slots in own clinic
CREATE POLICY "read_time_slots" ON time_slots
  FOR SELECT USING (
    clinic_id = get_user_clinic_id() AND is_active = TRUE
  );

-- -------------------------------------------------------
-- APPOINTMENTS
-- -------------------------------------------------------
CREATE POLICY "sa_appointments_all" ON appointments
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Clinic admin: full access within clinic
CREATE POLICY "admin_appointments_all" ON appointments
  FOR ALL USING (
    clinic_id = get_user_clinic_id() AND get_user_role() = 'clinic_admin'
  ) WITH CHECK (clinic_id = get_user_clinic_id());

-- Receptionist: full CRUD within clinic
CREATE POLICY "receptionist_appointments_all" ON appointments
  FOR ALL USING (
    clinic_id = get_user_clinic_id() AND get_user_role() = 'receptionist'
  ) WITH CHECK (clinic_id = get_user_clinic_id());

-- Doctor: read & update own appointments
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

-- Patient: read own appointments, create new ones, update (cancel/reschedule)
CREATE POLICY "patient_appointments_select" ON appointments
  FOR SELECT USING (
    patient_id = get_my_user_id() AND get_user_role() = 'patient'
  );

CREATE POLICY "patient_appointments_insert" ON appointments
  FOR INSERT WITH CHECK (
    patient_id = get_my_user_id()
    AND get_user_role() = 'patient'
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

-- -------------------------------------------------------
-- NOTIFICATIONS
-- -------------------------------------------------------
CREATE POLICY "sa_notifications_all" ON notifications
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "admin_notifications_all" ON notifications
  FOR ALL USING (
    clinic_id = get_user_clinic_id() AND get_user_role() = 'clinic_admin'
  ) WITH CHECK (clinic_id = get_user_clinic_id());

-- Staff: read notifications in own clinic
CREATE POLICY "staff_notifications_select" ON notifications
  FOR SELECT USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('receptionist', 'doctor')
  );

-- Any user: read & update own notifications (mark as read)
CREATE POLICY "own_notifications_select" ON notifications
  FOR SELECT USING (user_id = get_my_user_id());

CREATE POLICY "own_notifications_update" ON notifications
  FOR UPDATE USING (user_id = get_my_user_id())
  WITH CHECK (user_id = get_my_user_id());

-- -------------------------------------------------------
-- PAYMENTS
-- -------------------------------------------------------
CREATE POLICY "sa_payments_all" ON payments
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "admin_payments_all" ON payments
  FOR ALL USING (
    clinic_id = get_user_clinic_id() AND get_user_role() = 'clinic_admin'
  ) WITH CHECK (clinic_id = get_user_clinic_id());

-- Receptionist: create & read payments
CREATE POLICY "receptionist_payments_select" ON payments
  FOR SELECT USING (
    clinic_id = get_user_clinic_id() AND get_user_role() = 'receptionist'
  );

CREATE POLICY "receptionist_payments_insert" ON payments
  FOR INSERT WITH CHECK (
    clinic_id = get_user_clinic_id() AND get_user_role() = 'receptionist'
  );

CREATE POLICY "receptionist_payments_update" ON payments
  FOR UPDATE USING (
    clinic_id = get_user_clinic_id() AND get_user_role() = 'receptionist'
  ) WITH CHECK (clinic_id = get_user_clinic_id());

-- Patient: read own payments
CREATE POLICY "patient_payments_select" ON payments
  FOR SELECT USING (
    patient_id = get_my_user_id() AND get_user_role() = 'patient'
  );

-- -------------------------------------------------------
-- REVIEWS
-- -------------------------------------------------------
CREATE POLICY "sa_reviews_all" ON reviews
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "admin_reviews_all" ON reviews
  FOR ALL USING (
    clinic_id = get_user_clinic_id() AND get_user_role() = 'clinic_admin'
  ) WITH CHECK (clinic_id = get_user_clinic_id());

-- Public: read visible reviews (no auth required)
CREATE POLICY "public_reviews_select" ON reviews
  FOR SELECT USING (is_visible = TRUE);

-- Patient: create reviews, read own
CREATE POLICY "patient_reviews_insert" ON reviews
  FOR INSERT WITH CHECK (
    patient_id = get_my_user_id() AND get_user_role() = 'patient'
  );

CREATE POLICY "patient_reviews_select" ON reviews
  FOR SELECT USING (
    patient_id = get_my_user_id() AND get_user_role() = 'patient'
  );

-- -------------------------------------------------------
-- DOCUMENTS
-- -------------------------------------------------------
CREATE POLICY "sa_documents_all" ON documents
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "admin_documents_all" ON documents
  FOR ALL USING (
    clinic_id = get_user_clinic_id() AND get_user_role() = 'clinic_admin'
  ) WITH CHECK (clinic_id = get_user_clinic_id());

-- Staff: read documents in own clinic
CREATE POLICY "staff_documents_select" ON documents
  FOR SELECT USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('receptionist', 'doctor')
  );

-- Doctor: upload documents for patients
CREATE POLICY "doctor_documents_insert" ON documents
  FOR INSERT WITH CHECK (
    clinic_id = get_user_clinic_id() AND get_user_role() = 'doctor'
  );

-- Patient: read own documents, upload own
CREATE POLICY "patient_documents_select" ON documents
  FOR SELECT USING (
    user_id = get_my_user_id() AND get_user_role() = 'patient'
  );

CREATE POLICY "patient_documents_insert" ON documents
  FOR INSERT WITH CHECK (
    user_id = get_my_user_id() AND get_user_role() = 'patient'
  );

-- -------------------------------------------------------
-- CONSULTATION_NOTES (doctor-only private notes)
-- -------------------------------------------------------
CREATE POLICY "sa_consultation_notes_all" ON consultation_notes
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "admin_consultation_notes_select" ON consultation_notes
  FOR SELECT USING (
    clinic_id = get_user_clinic_id() AND get_user_role() = 'clinic_admin'
  );

-- Doctor: full CRUD on own notes
CREATE POLICY "doctor_consultation_notes_all" ON consultation_notes
  FOR ALL USING (
    clinic_id = get_user_clinic_id()
    AND doctor_id = get_my_user_id()
    AND get_user_role() = 'doctor'
  ) WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND doctor_id = get_my_user_id()
  );

-- Patients and receptionists do NOT see consultation notes

-- -------------------------------------------------------
-- PRESCRIPTIONS
-- -------------------------------------------------------
CREATE POLICY "sa_prescriptions_all" ON prescriptions
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "admin_prescriptions_select" ON prescriptions
  FOR SELECT USING (
    clinic_id = get_user_clinic_id() AND get_user_role() = 'clinic_admin'
  );

-- Doctor: full CRUD on own prescriptions
CREATE POLICY "doctor_prescriptions_all" ON prescriptions
  FOR ALL USING (
    clinic_id = get_user_clinic_id()
    AND doctor_id = get_my_user_id()
    AND get_user_role() = 'doctor'
  ) WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND doctor_id = get_my_user_id()
  );

-- Patient: read own prescriptions
CREATE POLICY "patient_prescriptions_select" ON prescriptions
  FOR SELECT USING (
    patient_id = get_my_user_id() AND get_user_role() = 'patient'
  );

-- -------------------------------------------------------
-- FAMILY_MEMBERS
-- -------------------------------------------------------
CREATE POLICY "sa_family_members_all" ON family_members
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "admin_family_members_select" ON family_members
  FOR SELECT USING (
    get_user_role() = 'clinic_admin'
  );

-- Patient: manage own family members
CREATE POLICY "patient_family_members_all" ON family_members
  FOR ALL USING (
    primary_user_id = get_my_user_id()
    AND get_user_role() = 'patient'
  ) WITH CHECK (
    primary_user_id = get_my_user_id()
  );

-- Staff: read family members for patients in clinic
CREATE POLICY "staff_family_members_select" ON family_members
  FOR SELECT USING (
    get_user_role() IN ('receptionist', 'doctor')
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = family_members.primary_user_id
        AND clinic_id = get_user_clinic_id()
    )
  );

-- -------------------------------------------------------
-- CLINIC_HOLIDAYS
-- -------------------------------------------------------
CREATE POLICY "sa_clinic_holidays_all" ON clinic_holidays
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "admin_clinic_holidays_all" ON clinic_holidays
  FOR ALL USING (
    clinic_id = get_user_clinic_id() AND get_user_role() = 'clinic_admin'
  ) WITH CHECK (clinic_id = get_user_clinic_id());

-- Everyone in clinic can read holidays
CREATE POLICY "read_clinic_holidays" ON clinic_holidays
  FOR SELECT USING (clinic_id = get_user_clinic_id());

-- -------------------------------------------------------
-- ODONTOGRAM (dentist system)
-- -------------------------------------------------------
CREATE POLICY "sa_odontogram_all" ON odontogram
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "admin_odontogram_all" ON odontogram
  FOR ALL USING (
    clinic_id = get_user_clinic_id() AND get_user_role() = 'clinic_admin'
  ) WITH CHECK (clinic_id = get_user_clinic_id());

-- Doctor: full CRUD on odontogram for patients in own clinic
CREATE POLICY "doctor_odontogram_all" ON odontogram
  FOR ALL USING (
    clinic_id = get_user_clinic_id() AND get_user_role() = 'doctor'
  ) WITH CHECK (clinic_id = get_user_clinic_id());

-- Patient: read own tooth chart
CREATE POLICY "patient_odontogram_select" ON odontogram
  FOR SELECT USING (
    patient_id = get_my_user_id() AND get_user_role() = 'patient'
  );

-- -------------------------------------------------------
-- TREATMENT_PLANS (dentist system)
-- -------------------------------------------------------
CREATE POLICY "sa_treatment_plans_all" ON treatment_plans
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "admin_treatment_plans_all" ON treatment_plans
  FOR ALL USING (
    clinic_id = get_user_clinic_id() AND get_user_role() = 'clinic_admin'
  ) WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "doctor_treatment_plans_all" ON treatment_plans
  FOR ALL USING (
    clinic_id = get_user_clinic_id()
    AND doctor_id = get_my_user_id()
    AND get_user_role() = 'doctor'
  ) WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND doctor_id = get_my_user_id()
  );

CREATE POLICY "patient_treatment_plans_select" ON treatment_plans
  FOR SELECT USING (
    patient_id = get_my_user_id() AND get_user_role() = 'patient'
  );

-- -------------------------------------------------------
-- LAB_ORDERS (dentist system)
-- -------------------------------------------------------
CREATE POLICY "sa_lab_orders_all" ON lab_orders
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "admin_lab_orders_all" ON lab_orders
  FOR ALL USING (
    clinic_id = get_user_clinic_id() AND get_user_role() = 'clinic_admin'
  ) WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "doctor_lab_orders_all" ON lab_orders
  FOR ALL USING (
    clinic_id = get_user_clinic_id()
    AND doctor_id = get_my_user_id()
    AND get_user_role() = 'doctor'
  ) WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND doctor_id = get_my_user_id()
  );

-- Receptionist: read lab orders
CREATE POLICY "receptionist_lab_orders_select" ON lab_orders
  FOR SELECT USING (
    clinic_id = get_user_clinic_id() AND get_user_role() = 'receptionist'
  );

-- -------------------------------------------------------
-- INSTALLMENTS (dentist payment plans)
-- -------------------------------------------------------
CREATE POLICY "sa_installments_all" ON installments
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "admin_installments_all" ON installments
  FOR ALL USING (
    clinic_id = get_user_clinic_id() AND get_user_role() = 'clinic_admin'
  ) WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "receptionist_installments_all" ON installments
  FOR ALL USING (
    clinic_id = get_user_clinic_id() AND get_user_role() = 'receptionist'
  ) WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "doctor_installments_select" ON installments
  FOR SELECT USING (
    clinic_id = get_user_clinic_id() AND get_user_role() = 'doctor'
  );

CREATE POLICY "patient_installments_select" ON installments
  FOR SELECT USING (
    patient_id = get_my_user_id() AND get_user_role() = 'patient'
  );

-- -------------------------------------------------------
-- STERILIZATION_LOG (dentist system)
-- -------------------------------------------------------
CREATE POLICY "sa_sterilization_log_all" ON sterilization_log
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "admin_sterilization_log_all" ON sterilization_log
  FOR ALL USING (
    clinic_id = get_user_clinic_id() AND get_user_role() = 'clinic_admin'
  ) WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "staff_sterilization_log_all" ON sterilization_log
  FOR ALL USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('doctor', 'receptionist')
  ) WITH CHECK (clinic_id = get_user_clinic_id());

-- -------------------------------------------------------
-- PRODUCTS (pharmacy system)
-- -------------------------------------------------------
CREATE POLICY "sa_products_all" ON products
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "admin_products_all" ON products
  FOR ALL USING (
    clinic_id = get_user_clinic_id() AND get_user_role() = 'clinic_admin'
  ) WITH CHECK (clinic_id = get_user_clinic_id());

-- Staff: read products
CREATE POLICY "staff_products_select" ON products
  FOR SELECT USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('receptionist', 'doctor')
  );

-- Patient: browse active products (catalog)
CREATE POLICY "patient_products_select" ON products
  FOR SELECT USING (
    clinic_id = get_user_clinic_id()
    AND is_active = TRUE
    AND get_user_role() = 'patient'
  );

-- -------------------------------------------------------
-- STOCK (pharmacy system)
-- -------------------------------------------------------
CREATE POLICY "sa_stock_all" ON stock
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "admin_stock_all" ON stock
  FOR ALL USING (
    clinic_id = get_user_clinic_id() AND get_user_role() = 'clinic_admin'
  ) WITH CHECK (clinic_id = get_user_clinic_id());

-- Staff: read stock levels
CREATE POLICY "staff_stock_select" ON stock
  FOR SELECT USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('receptionist', 'doctor')
  );

-- -------------------------------------------------------
-- SUPPLIERS (pharmacy system)
-- -------------------------------------------------------
CREATE POLICY "sa_suppliers_all" ON suppliers
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "admin_suppliers_all" ON suppliers
  FOR ALL USING (
    clinic_id = get_user_clinic_id() AND get_user_role() = 'clinic_admin'
  ) WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "staff_suppliers_select" ON suppliers
  FOR SELECT USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('receptionist', 'doctor')
  );

-- -------------------------------------------------------
-- PRESCRIPTION_REQUESTS (pharmacy system)
-- -------------------------------------------------------
CREATE POLICY "sa_prescription_requests_all" ON prescription_requests
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "admin_prescription_requests_all" ON prescription_requests
  FOR ALL USING (
    clinic_id = get_user_clinic_id() AND get_user_role() = 'clinic_admin'
  ) WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "staff_prescription_requests_all" ON prescription_requests
  FOR ALL USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('receptionist', 'doctor')
  ) WITH CHECK (clinic_id = get_user_clinic_id());

-- Patient: create & read own prescription requests
CREATE POLICY "patient_prescription_requests_select" ON prescription_requests
  FOR SELECT USING (
    patient_id = get_my_user_id() AND get_user_role() = 'patient'
  );

CREATE POLICY "patient_prescription_requests_insert" ON prescription_requests
  FOR INSERT WITH CHECK (
    patient_id = get_my_user_id() AND get_user_role() = 'patient'
  );

-- -------------------------------------------------------
-- LOYALTY_POINTS (pharmacy system)
-- -------------------------------------------------------
CREATE POLICY "sa_loyalty_points_all" ON loyalty_points
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "admin_loyalty_points_all" ON loyalty_points
  FOR ALL USING (
    clinic_id = get_user_clinic_id() AND get_user_role() = 'clinic_admin'
  ) WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "staff_loyalty_points_select" ON loyalty_points
  FOR SELECT USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('receptionist', 'doctor')
  );

CREATE POLICY "staff_loyalty_points_update" ON loyalty_points
  FOR UPDATE USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('receptionist', 'clinic_admin')
  ) WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "patient_loyalty_points_select" ON loyalty_points
  FOR SELECT USING (
    patient_id = get_my_user_id() AND get_user_role() = 'patient'
  );

-- -------------------------------------------------------
-- LOYALTY_TRANSACTIONS (pharmacy system)
-- -------------------------------------------------------
CREATE POLICY "sa_loyalty_transactions_all" ON loyalty_transactions
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "admin_loyalty_transactions_all" ON loyalty_transactions
  FOR ALL USING (
    clinic_id = get_user_clinic_id() AND get_user_role() = 'clinic_admin'
  ) WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "staff_loyalty_transactions_insert" ON loyalty_transactions
  FOR INSERT WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('receptionist', 'clinic_admin')
  );

CREATE POLICY "patient_loyalty_transactions_select" ON loyalty_transactions
  FOR SELECT USING (
    patient_id = get_my_user_id() AND get_user_role() = 'patient'
  );

-- -------------------------------------------------------
-- PURCHASE_ORDERS (pharmacy system)
-- -------------------------------------------------------
CREATE POLICY "sa_purchase_orders_all" ON purchase_orders
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "admin_purchase_orders_all" ON purchase_orders
  FOR ALL USING (
    clinic_id = get_user_clinic_id() AND get_user_role() = 'clinic_admin'
  ) WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "staff_purchase_orders_select" ON purchase_orders
  FOR SELECT USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('receptionist', 'doctor')
  );

-- -------------------------------------------------------
-- PURCHASE_ORDER_ITEMS
-- -------------------------------------------------------
CREATE POLICY "sa_purchase_order_items_all" ON purchase_order_items
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "admin_purchase_order_items_all" ON purchase_order_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = purchase_order_items.purchase_order_id
        AND po.clinic_id = get_user_clinic_id()
    )
    AND get_user_role() = 'clinic_admin'
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = purchase_order_items.purchase_order_id
        AND po.clinic_id = get_user_clinic_id()
    )
  );

CREATE POLICY "staff_purchase_order_items_select" ON purchase_order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = purchase_order_items.purchase_order_id
        AND po.clinic_id = get_user_clinic_id()
    )
    AND get_user_role() IN ('receptionist', 'doctor')
  );
