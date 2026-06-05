-- ============================================================
-- Migration 00149: Create doctor_exceptions table
--
-- Doctors and clinic admins can mark specific calendar dates as
-- unavailable (vacations, sick days, public holidays). The slot
-- generation engine (src/lib/slots.ts) checks this table before
-- returning bookable slots and returns [] for exception dates.
--
-- The UNIQUE constraint on (doctor_id, date) ensures each doctor
-- can only have one exception record per calendar day.
-- ============================================================

CREATE TABLE IF NOT EXISTS doctor_exceptions (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id  UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  clinic_id  UUID    NOT NULL REFERENCES clinics(id),
  date       DATE    NOT NULL,
  reason     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One exception entry per doctor per day.
  UNIQUE (doctor_id, date)
);

ALTER TABLE doctor_exceptions ENABLE ROW LEVEL SECURITY;

-- Clinic admins can manage all exceptions for their clinic.
CREATE POLICY "clinic_admin_manage_exceptions"
  ON doctor_exceptions
  FOR ALL
  USING  (is_clinic_admin(clinic_id))
  WITH CHECK (is_clinic_admin(clinic_id));

-- Doctors can manage their own exceptions only.
CREATE POLICY "doctor_manage_own_exceptions"
  ON doctor_exceptions
  FOR ALL
  USING (
    is_clinic_staff()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid()
        AND id      = doctor_exceptions.doctor_id
        AND role    = 'doctor'
    )
  )
  WITH CHECK (
    is_clinic_staff()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid()
        AND id      = doctor_exceptions.doctor_id
        AND role    = 'doctor'
    )
  );

-- Super admins have full access.
CREATE POLICY "superadmin_all_exceptions"
  ON doctor_exceptions
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Optimise the slot engine lookup: (doctor_id, date) for point queries.
CREATE INDEX IF NOT EXISTS idx_doctor_exceptions_doctor_date
  ON doctor_exceptions(doctor_id, date);

COMMENT ON TABLE doctor_exceptions IS
  'Calendar dates on which a doctor is unavailable. '
  'The slot generation engine returns an empty array for any date '
  'that has a matching exception record.';

COMMENT ON COLUMN doctor_exceptions.reason IS
  'Optional human-readable reason (vacation, sick leave, holiday, etc.). '
  'Displayed to clinic staff; not shown to patients.';
