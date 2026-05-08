-- Migration: 00087_missing_constraints.sql
-- A16-03: appointments CHECK (slot_end > slot_start)
-- A16-04: services.price CHECK (price >= 0)
-- A16-05: time_slots UNIQUE (doctor_id, day_of_week, start_time)
-- A29-03: payments.amount CHECK (amount >= 0)
-- A16-08: confirm FK indexes on hot join columns

-- ── A16-03: appointment time ordering ────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'slot_end'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'slot_start'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.check_constraints
      WHERE constraint_name = 'appointments_slot_end_after_start'
    ) THEN
      ALTER TABLE appointments
        ADD CONSTRAINT appointments_slot_end_after_start
        CHECK (slot_end > slot_start);
    END IF;
  END IF;
END;
$$;

-- ── A16-04: non-negative service price ───────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'price'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.check_constraints
      WHERE constraint_name = 'services_price_non_negative'
    ) THEN
      ALTER TABLE services
        ADD CONSTRAINT services_price_non_negative
        CHECK (price >= 0);
    END IF;
  END IF;
END;
$$;

-- ── A16-05: no duplicate time slots per doctor ────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'time_slots'
  ) THEN
    -- Only add if all three columns exist
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'time_slots' AND column_name = 'doctor_id'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'time_slots' AND column_name = 'day_of_week'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'time_slots' AND column_name = 'start_time'
    ) THEN
      -- Use a partial unique index (not a constraint) so we can scope to
      -- active slots and avoid errors on soft-deleted or inactive rows
      CREATE UNIQUE INDEX IF NOT EXISTS idx_time_slots_doctor_day_start_unique
        ON time_slots (doctor_id, day_of_week, start_time)
        WHERE (is_active IS NULL OR is_active = true);
    END IF;
  END IF;
END;
$$;

-- ── A29-03: non-negative payment amount ───────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'amount'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.check_constraints
      WHERE constraint_name = 'payments_amount_non_negative'
    ) THEN
      ALTER TABLE payments
        ADD CONSTRAINT payments_amount_non_negative
        CHECK (amount >= 0);
    END IF;
  END IF;
END;
$$;

-- ── A16-08: FK indexes on hot join columns ────────────────────────────
-- appointments.patient_id
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id
  ON appointments (patient_id)
  WHERE patient_id IS NOT NULL;

-- appointments.doctor_id
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id
  ON appointments (doctor_id)
  WHERE doctor_id IS NOT NULL;

-- appointments.service_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'service_id'
  ) THEN
    EXECUTE $sql$
      CREATE INDEX IF NOT EXISTS idx_appointments_service_id
        ON appointments (service_id)
        WHERE service_id IS NOT NULL;
    $sql$;
  END IF;
END;
$$;

-- activity_logs: (clinic_id, timestamp DESC) for fast audit queries
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'activity_logs'
  ) THEN
    EXECUTE $sql$
      CREATE INDEX IF NOT EXISTS idx_activity_logs_clinic_timestamp
        ON activity_logs (clinic_id, timestamp DESC);
    $sql$;
  END IF;
END;
$$;

-- ── A17-04: directory query composite index ───────────────────────────
-- Covers: role + clinic_id + is_active for patient listing
CREATE INDEX IF NOT EXISTS idx_users_role_clinic_active
  ON users (clinic_id, role, is_active)
  WHERE deleted_at IS NULL;
