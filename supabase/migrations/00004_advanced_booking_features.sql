-- ============================================================
-- Migration 00004: Advanced Booking Features
-- Adds: Cancellation tracking, Reschedule references,
--        Emergency slots, Recurring bookings, Multi-doctor,
--        Waiting list enhancements, Payment enhancements
-- ============================================================

-- ============================================================
-- 1. ALTER appointments — cancellation, reschedule, emergency, recurring
-- ============================================================

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS rescheduled_from UUID REFERENCES appointments(id),
  ADD COLUMN IF NOT EXISTS is_emergency BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS recurrence_group_id UUID,
  ADD COLUMN IF NOT EXISTS recurrence_pattern TEXT CHECK (recurrence_pattern IN ('weekly', 'biweekly', 'monthly')),
  ADD COLUMN IF NOT EXISTS recurrence_index INT;

CREATE INDEX IF NOT EXISTS idx_appointments_recurrence_group ON appointments(recurrence_group_id);
CREATE INDEX IF NOT EXISTS idx_appointments_rescheduled_from ON appointments(rescheduled_from);

-- ============================================================
-- 2. ALTER waiting_list — preferred time, service, notification tracking
-- ============================================================

ALTER TABLE waiting_list
  ADD COLUMN IF NOT EXISTS preferred_time TIME,
  ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES services(id),
  ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_waiting_list_doctor_date ON waiting_list(doctor_id, preferred_date);

-- ============================================================
-- 3. ALTER payments — payment type, gateway, refunds
-- ============================================================

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'full' CHECK (payment_type IN ('deposit', 'full')),
  ADD COLUMN IF NOT EXISTS gateway_session_id TEXT,
  ADD COLUMN IF NOT EXISTS refunded_amount DECIMAL(10,2) DEFAULT 0;

-- ============================================================
-- 4. CREATE emergency_slots table
-- ============================================================

CREATE TABLE IF NOT EXISTS emergency_slots (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id    UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  doctor_id    UUID NOT NULL REFERENCES users(id),
  slot_date    DATE NOT NULL,
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  reason       TEXT,
  is_booked    BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE emergency_slots ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_emergency_slots_clinic ON emergency_slots(clinic_id);
CREATE INDEX IF NOT EXISTS idx_emergency_slots_doctor_date ON emergency_slots(doctor_id, slot_date);

-- ============================================================
-- 5. CREATE appointment_doctors junction table (multi-doctor)
-- ============================================================

CREATE TABLE IF NOT EXISTS appointment_doctors (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id  UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  doctor_id       UUID NOT NULL REFERENCES users(id),
  is_primary      BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(appointment_id, doctor_id)
);

ALTER TABLE appointment_doctors ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_appointment_doctors_appointment ON appointment_doctors(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_doctors_doctor ON appointment_doctors(doctor_id);

-- ============================================================
-- 6. RLS POLICIES for new tables
-- ============================================================

-- Emergency Slots
CREATE POLICY "sa_emergency_slots_all" ON emergency_slots
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "admin_emergency_slots_all" ON emergency_slots
  FOR ALL USING (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('clinic_admin', 'doctor')
  ) WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND get_user_role() IN ('clinic_admin', 'doctor')
  );

CREATE POLICY "read_emergency_slots" ON emergency_slots
  FOR SELECT USING (
    clinic_id = get_user_clinic_id()
  );

-- Appointment Doctors
CREATE POLICY "sa_appointment_doctors_all" ON appointment_doctors
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "staff_appointment_doctors_all" ON appointment_doctors
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.id = appointment_doctors.appointment_id
        AND a.clinic_id = get_user_clinic_id()
    )
    AND get_user_role() IN ('clinic_admin', 'receptionist', 'doctor')
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.id = appointment_doctors.appointment_id
        AND a.clinic_id = get_user_clinic_id()
    )
  );

CREATE POLICY "patient_appointment_doctors_select" ON appointment_doctors
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.id = appointment_doctors.appointment_id
        AND a.patient_id = get_current_user_id()
    )
  );

CREATE POLICY "patient_appointment_doctors_insert" ON appointment_doctors
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.id = appointment_doctors.appointment_id
        AND a.patient_id = get_current_user_id()
    )
  );

-- Waiting list: allow patients to insert and delete their own entries
CREATE POLICY "patient_waiting_list_delete" ON waiting_list
  FOR DELETE USING (
    patient_id = get_current_user_id() AND get_user_role() = 'patient'
  );
