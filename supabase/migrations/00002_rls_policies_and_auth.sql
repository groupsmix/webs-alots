-- ============================================================
-- Migration 00002: Comprehensive RLS Policies + Auth Helpers
-- Replaces the basic "clinic isolation" policies with
-- granular role-based policies for all 5 roles.
-- ============================================================

-- ============================================================
-- DROP EXISTING POLICIES (from 00001)
-- ============================================================

DROP POLICY IF EXISTS "Users see own clinic data" ON users;
DROP POLICY IF EXISTS "Clinic isolation" ON appointments;
DROP POLICY IF EXISTS "Clinic isolation" ON services;
DROP POLICY IF EXISTS "Clinic isolation" ON time_slots;
DROP POLICY IF EXISTS "Clinic isolation" ON notifications;
DROP POLICY IF EXISTS "Clinic isolation" ON payments;
DROP POLICY IF EXISTS "Clinic isolation" ON reviews;
DROP POLICY IF EXISTS "Clinic isolation" ON documents;
DROP POLICY IF EXISTS "Clinic isolation" ON consultation_notes;
DROP POLICY IF EXISTS "Clinic isolation" ON prescriptions;
DROP POLICY IF EXISTS "Clinic isolation" ON waiting_list;
DROP POLICY IF EXISTS "Clinic isolation" ON odontogram;
DROP POLICY IF EXISTS "Clinic isolation" ON treatment_plans;
DROP POLICY IF EXISTS "Clinic isolation" ON lab_orders;
DROP POLICY IF EXISTS "Clinic isolation" ON installments;
DROP POLICY IF EXISTS "Clinic isolation" ON products;
DROP POLICY IF EXISTS "Clinic isolation" ON stock;
DROP POLICY IF EXISTS "Clinic isolation" ON suppliers;
DROP POLICY IF EXISTS "Clinic isolation" ON prescription_requests;
DROP POLICY IF EXISTS "Clinic isolation" ON loyalty_points;
DROP POLICY IF EXISTS "Super admin sees all clinics" ON clinics;
DROP POLICY IF EXISTS "Public reviews" ON reviews;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Get the current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM users WHERE auth_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if current user is clinic staff (admin, receptionist, or doctor)
CREATE OR REPLACE FUNCTION is_clinic_staff()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid()
      AND role IN ('clinic_admin', 'receptionist', 'doctor')
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get current user's id (from users table, not auth.uid())
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS UUID AS $$
  SELECT id FROM users WHERE auth_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- TRIGGER: auto-set updated_at on UPDATE
-- ============================================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to tables that have the column
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'clinics', 'users', 'appointments', 'consultation_notes',
      'treatment_plans', 'lab_orders', 'prescription_requests',
      'odontogram', 'stock', 'loyalty_points'
    ])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_updated_at ON %I; CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- ============================================================
-- TRIGGER: auto-create user profile on Supabase Auth signup
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (auth_id, name, phone, email, role, clinic_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient'),
    (NEW.raw_user_meta_data->>'clinic_id')::UUID
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- ============================================================
-- RLS POLICIES: clinics
-- ============================================================

-- Anyone authenticated can read their own clinic
CREATE POLICY "clinics_select_own" ON clinics
  FOR SELECT USING (
    id = get_user_clinic_id() OR is_super_admin()
  );

-- Super admin can manage all clinics
CREATE POLICY "clinics_all_super_admin" ON clinics
  FOR ALL USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Public can read active clinic info (for public website)
CREATE POLICY "clinics_select_public" ON clinics
  FOR SELECT USING (is_active = TRUE);

-- ============================================================
-- RLS POLICIES: users
-- ============================================================

-- Users can read their own profile
CREATE POLICY "users_select_self" ON users
  FOR SELECT USING (auth_id = auth.uid());

-- Staff can read all users in their clinic
CREATE POLICY "users_select_clinic_staff" ON users
  FOR SELECT USING (
    clinic_id = get_user_clinic_id() AND is_clinic_staff()
  );

-- Super admin can read all users
CREATE POLICY "users_select_super_admin" ON users
  FOR SELECT USING (is_super_admin());

-- Users can update their own profile
CREATE POLICY "users_update_self" ON users
  FOR UPDATE USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());

-- Clinic admin can manage users in their clinic
CREATE POLICY "users_all_clinic_admin" ON users
  FOR ALL USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() = 'clinic_admin'
  )
  WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND get_user_role() = 'clinic_admin'
  );

-- Super admin can manage all users
CREATE POLICY "users_all_super_admin" ON users
  FOR ALL USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Allow the auth trigger to insert new user profiles
CREATE POLICY "users_insert_auth_trigger" ON users
  FOR INSERT WITH CHECK (TRUE);

-- ============================================================
-- RLS POLICIES: services
-- ============================================================

-- Public can read active services (for public website booking)
CREATE POLICY "services_select_public" ON services
  FOR SELECT USING (is_active = TRUE);

-- Staff can read all services in their clinic
CREATE POLICY "services_select_clinic" ON services
  FOR SELECT USING (
    clinic_id = get_user_clinic_id()
  );

-- Clinic admin can manage services
CREATE POLICY "services_manage_admin" ON services
  FOR ALL USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('clinic_admin', 'super_admin')
  )
  WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('clinic_admin', 'super_admin')
  );

-- Super admin can manage all services
CREATE POLICY "services_all_super_admin" ON services
  FOR ALL USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ============================================================
-- RLS POLICIES: time_slots
-- ============================================================

-- Staff can read time slots in their clinic
CREATE POLICY "time_slots_select_clinic" ON time_slots
  FOR SELECT USING (
    clinic_id = get_user_clinic_id() OR is_super_admin()
  );

-- Public can read active time slots (for booking)
CREATE POLICY "time_slots_select_public" ON time_slots
  FOR SELECT USING (is_active = TRUE);

-- Clinic admin and doctor can manage time slots
CREATE POLICY "time_slots_manage" ON time_slots
  FOR ALL USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('clinic_admin', 'doctor')
  )
  WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('clinic_admin', 'doctor')
  );

-- Super admin can manage all
CREATE POLICY "time_slots_all_super_admin" ON time_slots
  FOR ALL USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ============================================================
-- RLS POLICIES: appointments
-- ============================================================

-- Patients can read their own appointments
CREATE POLICY "appointments_select_patient" ON appointments
  FOR SELECT USING (
    patient_id = get_current_user_id()
  );

-- Doctors can read appointments assigned to them
CREATE POLICY "appointments_select_doctor" ON appointments
  FOR SELECT USING (
    doctor_id = get_current_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- Receptionist and clinic admin can read all appointments in their clinic
CREATE POLICY "appointments_select_staff" ON appointments
  FOR SELECT USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('receptionist', 'clinic_admin')
  );

-- Patients can create appointments (online booking)
CREATE POLICY "appointments_insert_patient" ON appointments
  FOR INSERT WITH CHECK (
    patient_id = get_current_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- Allow anonymous booking (no auth required for public booking)
CREATE POLICY "appointments_insert_public" ON appointments
  FOR INSERT WITH CHECK (
    booking_source = 'online'
  );

-- Receptionist and admin can create/update appointments
CREATE POLICY "appointments_manage_staff" ON appointments
  FOR ALL USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('receptionist', 'clinic_admin')
  )
  WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('receptionist', 'clinic_admin')
  );

-- Doctors can update their own appointments (status changes)
CREATE POLICY "appointments_update_doctor" ON appointments
  FOR UPDATE USING (
    doctor_id = get_current_user_id()
    AND clinic_id = get_user_clinic_id()
  )
  WITH CHECK (
    doctor_id = get_current_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- Super admin can manage all
CREATE POLICY "appointments_all_super_admin" ON appointments
  FOR ALL USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ============================================================
-- RLS POLICIES: waiting_list
-- ============================================================

-- Patients can see their own waiting list entries
CREATE POLICY "waiting_list_select_patient" ON waiting_list
  FOR SELECT USING (patient_id = get_current_user_id());

-- Staff can manage waiting list in their clinic
CREATE POLICY "waiting_list_manage_staff" ON waiting_list
  FOR ALL USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('receptionist', 'clinic_admin', 'doctor')
  )
  WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('receptionist', 'clinic_admin', 'doctor')
  );

-- Super admin
CREATE POLICY "waiting_list_all_super_admin" ON waiting_list
  FOR ALL USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ============================================================
-- RLS POLICIES: notifications
-- ============================================================

-- Users can read their own notifications
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT USING (user_id = get_current_user_id());

-- Users can update their own notifications (mark as read)
CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (user_id = get_current_user_id())
  WITH CHECK (user_id = get_current_user_id());

-- Staff can create notifications for users in their clinic
CREATE POLICY "notifications_insert_staff" ON notifications
  FOR INSERT WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('receptionist', 'clinic_admin', 'doctor')
  );

-- Super admin
CREATE POLICY "notifications_all_super_admin" ON notifications
  FOR ALL USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ============================================================
-- RLS POLICIES: payments
-- ============================================================

-- Patients can see their own payments
CREATE POLICY "payments_select_patient" ON payments
  FOR SELECT USING (patient_id = get_current_user_id());

-- Staff can manage payments in their clinic
CREATE POLICY "payments_manage_staff" ON payments
  FOR ALL USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('receptionist', 'clinic_admin')
  )
  WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('receptionist', 'clinic_admin')
  );

-- Super admin
CREATE POLICY "payments_all_super_admin" ON payments
  FOR ALL USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ============================================================
-- RLS POLICIES: reviews
-- ============================================================

-- Public can read visible reviews (for website)
CREATE POLICY "reviews_select_public" ON reviews
  FOR SELECT USING (is_visible = TRUE);

-- Patients can create reviews
CREATE POLICY "reviews_insert_patient" ON reviews
  FOR INSERT WITH CHECK (
    patient_id = get_current_user_id()
  );

-- Patients can update their own reviews
CREATE POLICY "reviews_update_patient" ON reviews
  FOR UPDATE USING (patient_id = get_current_user_id())
  WITH CHECK (patient_id = get_current_user_id());

-- Clinic admin can manage reviews (respond, toggle visibility)
CREATE POLICY "reviews_manage_admin" ON reviews
  FOR ALL USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() = 'clinic_admin'
  )
  WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND get_user_role() = 'clinic_admin'
  );

-- Super admin
CREATE POLICY "reviews_all_super_admin" ON reviews
  FOR ALL USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ============================================================
-- RLS POLICIES: documents
-- ============================================================

-- Users can see their own documents
CREATE POLICY "documents_select_own" ON documents
  FOR SELECT USING (user_id = get_current_user_id());

-- Users can upload their own documents
CREATE POLICY "documents_insert_own" ON documents
  FOR INSERT WITH CHECK (user_id = get_current_user_id());

-- Doctor can see documents for patients in their clinic
CREATE POLICY "documents_select_doctor" ON documents
  FOR SELECT USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() = 'doctor'
  );

-- Admin and receptionist can manage documents in their clinic
CREATE POLICY "documents_manage_staff" ON documents
  FOR ALL USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('clinic_admin', 'receptionist')
  )
  WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('clinic_admin', 'receptionist')
  );

-- Super admin
CREATE POLICY "documents_all_super_admin" ON documents
  FOR ALL USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ============================================================
-- RLS POLICIES: consultation_notes (DOCTOR EXTRA)
-- ============================================================

-- Doctors can manage their own consultation notes
CREATE POLICY "consultation_notes_manage_doctor" ON consultation_notes
  FOR ALL USING (
    doctor_id = get_current_user_id()
    AND clinic_id = get_user_clinic_id()
  )
  WITH CHECK (
    doctor_id = get_current_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- Clinic admin can read all consultation notes
CREATE POLICY "consultation_notes_select_admin" ON consultation_notes
  FOR SELECT USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() = 'clinic_admin'
  );

-- Super admin
CREATE POLICY "consultation_notes_all_super_admin" ON consultation_notes
  FOR ALL USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ============================================================
-- RLS POLICIES: prescriptions (DOCTOR EXTRA)
-- ============================================================

-- Patients can read their own prescriptions
CREATE POLICY "prescriptions_select_patient" ON prescriptions
  FOR SELECT USING (patient_id = get_current_user_id());

-- Doctors can manage prescriptions they created
CREATE POLICY "prescriptions_manage_doctor" ON prescriptions
  FOR ALL USING (
    doctor_id = get_current_user_id()
    AND clinic_id = get_user_clinic_id()
  )
  WITH CHECK (
    doctor_id = get_current_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- Admin can read all prescriptions in their clinic
CREATE POLICY "prescriptions_select_admin" ON prescriptions
  FOR SELECT USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() = 'clinic_admin'
  );

-- Super admin
CREATE POLICY "prescriptions_all_super_admin" ON prescriptions
  FOR ALL USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ============================================================
-- RLS POLICIES: family_members (DOCTOR EXTRA)
-- ============================================================

-- Users can manage their own family members
CREATE POLICY "family_members_manage_own" ON family_members
  FOR ALL USING (primary_user_id = get_current_user_id())
  WITH CHECK (primary_user_id = get_current_user_id());

-- Staff can read family members in their clinic
CREATE POLICY "family_members_select_staff" ON family_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = family_members.primary_user_id
        AND users.clinic_id = get_user_clinic_id()
    )
    AND is_clinic_staff()
  );

-- Super admin
CREATE POLICY "family_members_all_super_admin" ON family_members
  FOR ALL USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ============================================================
-- RLS POLICIES: odontogram (DENTIST EXTRA)
-- ============================================================

-- Patients can see their own odontogram
CREATE POLICY "odontogram_select_patient" ON odontogram
  FOR SELECT USING (patient_id = get_current_user_id());

-- Doctors can manage odontograms in their clinic
CREATE POLICY "odontogram_manage_doctor" ON odontogram
  FOR ALL USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('doctor', 'clinic_admin')
  )
  WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('doctor', 'clinic_admin')
  );

-- Super admin
CREATE POLICY "odontogram_all_super_admin" ON odontogram
  FOR ALL USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ============================================================
-- RLS POLICIES: treatment_plans (DENTIST EXTRA)
-- ============================================================

-- Patients can see their own treatment plans
CREATE POLICY "treatment_plans_select_patient" ON treatment_plans
  FOR SELECT USING (patient_id = get_current_user_id());

-- Doctors can manage treatment plans they created
CREATE POLICY "treatment_plans_manage_doctor" ON treatment_plans
  FOR ALL USING (
    doctor_id = get_current_user_id()
    AND clinic_id = get_user_clinic_id()
  )
  WITH CHECK (
    doctor_id = get_current_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- Admin can read all treatment plans
CREATE POLICY "treatment_plans_select_admin" ON treatment_plans
  FOR SELECT USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() = 'clinic_admin'
  );

-- Super admin
CREATE POLICY "treatment_plans_all_super_admin" ON treatment_plans
  FOR ALL USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ============================================================
-- RLS POLICIES: lab_orders (DENTIST EXTRA)
-- ============================================================

-- Doctors can manage lab orders they created
CREATE POLICY "lab_orders_manage_doctor" ON lab_orders
  FOR ALL USING (
    doctor_id = get_current_user_id()
    AND clinic_id = get_user_clinic_id()
  )
  WITH CHECK (
    doctor_id = get_current_user_id()
    AND clinic_id = get_user_clinic_id()
  );

-- Admin can read all lab orders
CREATE POLICY "lab_orders_select_admin" ON lab_orders
  FOR SELECT USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() = 'clinic_admin'
  );

-- Super admin
CREATE POLICY "lab_orders_all_super_admin" ON lab_orders
  FOR ALL USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ============================================================
-- RLS POLICIES: installments (DENTIST EXTRA)
-- ============================================================

-- Patients can see their own installments
CREATE POLICY "installments_select_patient" ON installments
  FOR SELECT USING (patient_id = get_current_user_id());

-- Staff can manage installments in their clinic
CREATE POLICY "installments_manage_staff" ON installments
  FOR ALL USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('receptionist', 'clinic_admin')
  )
  WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('receptionist', 'clinic_admin')
  );

-- Super admin
CREATE POLICY "installments_all_super_admin" ON installments
  FOR ALL USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ============================================================
-- RLS POLICIES: products (PHARMACY EXTRA)
-- ============================================================

-- Public can read active products (for catalog)
CREATE POLICY "products_select_public" ON products
  FOR SELECT USING (is_active = TRUE);

-- Staff can manage products in their clinic
CREATE POLICY "products_manage_staff" ON products
  FOR ALL USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('clinic_admin', 'receptionist')
  )
  WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('clinic_admin', 'receptionist')
  );

-- Super admin
CREATE POLICY "products_all_super_admin" ON products
  FOR ALL USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ============================================================
-- RLS POLICIES: stock (PHARMACY EXTRA)
-- ============================================================

-- Staff can manage stock in their clinic
CREATE POLICY "stock_manage_staff" ON stock
  FOR ALL USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('clinic_admin', 'receptionist')
  )
  WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('clinic_admin', 'receptionist')
  );

-- Super admin
CREATE POLICY "stock_all_super_admin" ON stock
  FOR ALL USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ============================================================
-- RLS POLICIES: suppliers (PHARMACY EXTRA)
-- ============================================================

-- Staff can manage suppliers in their clinic
CREATE POLICY "suppliers_manage_staff" ON suppliers
  FOR ALL USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('clinic_admin', 'receptionist')
  )
  WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('clinic_admin', 'receptionist')
  );

-- Super admin
CREATE POLICY "suppliers_all_super_admin" ON suppliers
  FOR ALL USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ============================================================
-- RLS POLICIES: prescription_requests (PHARMACY EXTRA)
-- ============================================================

-- Patients can manage their own prescription requests
CREATE POLICY "prescription_requests_manage_patient" ON prescription_requests
  FOR ALL USING (patient_id = get_current_user_id())
  WITH CHECK (patient_id = get_current_user_id());

-- Staff can manage prescription requests in their clinic
CREATE POLICY "prescription_requests_manage_staff" ON prescription_requests
  FOR ALL USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('clinic_admin', 'receptionist', 'doctor')
  )
  WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('clinic_admin', 'receptionist', 'doctor')
  );

-- Super admin
CREATE POLICY "prescription_requests_all_super_admin" ON prescription_requests
  FOR ALL USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ============================================================
-- RLS POLICIES: loyalty_points (PHARMACY EXTRA)
-- ============================================================

-- Patients can see their own loyalty points
CREATE POLICY "loyalty_points_select_patient" ON loyalty_points
  FOR SELECT USING (patient_id = get_current_user_id());

-- Staff can manage loyalty points in their clinic
CREATE POLICY "loyalty_points_manage_staff" ON loyalty_points
  FOR ALL USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('clinic_admin', 'receptionist')
  )
  WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('clinic_admin', 'receptionist')
  );

-- Super admin
CREATE POLICY "loyalty_points_all_super_admin" ON loyalty_points
  FOR ALL USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ============================================================
-- ADDITIONAL INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_services_clinic_active ON services(clinic_id, is_active);
CREATE INDEX IF NOT EXISTS idx_reviews_clinic_visible ON reviews(clinic_id, is_visible);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor ON prescriptions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_consultation_notes_doctor ON consultation_notes(doctor_id);
CREATE INDEX IF NOT EXISTS idx_consultation_notes_patient ON consultation_notes(patient_id);
CREATE INDEX IF NOT EXISTS idx_treatment_plans_patient ON treatment_plans(patient_id);
CREATE INDEX IF NOT EXISTS idx_installments_patient ON installments(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescription_requests_patient ON prescription_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_points_patient ON loyalty_points(patient_id);
