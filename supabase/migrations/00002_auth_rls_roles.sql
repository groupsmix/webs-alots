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
