-- 00107_tier1_receptionist_ai.sql
-- Tier 1 Receptionist AI: smart scheduling, automated reminders,
-- waitlist manager enhancements, no-show tracking, dashboard support.

-- ============================================================
-- 1. WAITLIST ENHANCEMENTS
-- ============================================================

-- Add priority/urgency columns to existing waiting_list table
ALTER TABLE waiting_list
  ADD COLUMN IF NOT EXISTS preferred_time TEXT,
  ADD COLUMN IF NOT EXISTS urgency TEXT DEFAULT 'normal'
    CHECK (urgency IN ('low', 'normal', 'high', 'urgent')),
  ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS priority_score INTEGER DEFAULT 0;

-- Index for efficient waitlist queries
CREATE INDEX IF NOT EXISTS idx_waiting_list_clinic_status
  ON waiting_list (clinic_id, status)
  WHERE status = 'waiting';

CREATE INDEX IF NOT EXISTS idx_waiting_list_doctor_date
  ON waiting_list (clinic_id, doctor_id, preferred_date)
  WHERE status = 'waiting';

-- ============================================================
-- 2. NO-SHOW TRACKING
-- ============================================================

CREATE TABLE IF NOT EXISTS no_show_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES users(id),
  appointment_id  UUID NOT NULL REFERENCES appointments(id),
  appointment_date DATE NOT NULL,
  marked_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_no_show_records_clinic_patient
  ON no_show_records (clinic_id, patient_id);

CREATE INDEX IF NOT EXISTS idx_no_show_records_clinic_doctor
  ON no_show_records (clinic_id, doctor_id);

CREATE INDEX IF NOT EXISTS idx_no_show_records_appointment
  ON no_show_records (appointment_id);

-- Aggregate stats per patient per clinic
CREATE TABLE IF NOT EXISTS no_show_stats (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  total_no_shows  INTEGER NOT NULL DEFAULT 0,
  total_appointments INTEGER NOT NULL DEFAULT 0,
  no_show_rate    NUMERIC(5,2) NOT NULL DEFAULT 0,
  is_flagged      BOOLEAN NOT NULL DEFAULT false,
  last_no_show_at TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, patient_id)
);

CREATE INDEX IF NOT EXISTS idx_no_show_stats_flagged
  ON no_show_stats (clinic_id, is_flagged)
  WHERE is_flagged = true;

-- Doctor-level no-show rate for overbooking suggestions
CREATE TABLE IF NOT EXISTS doctor_no_show_stats (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  doctor_id       UUID NOT NULL REFERENCES users(id),
  total_no_shows  INTEGER NOT NULL DEFAULT 0,
  total_appointments INTEGER NOT NULL DEFAULT 0,
  no_show_rate    NUMERIC(5,2) NOT NULL DEFAULT 0,
  suggested_overbooking_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, doctor_id)
);

-- ============================================================
-- 3. APPOINTMENT REMINDERS TRACKING
-- ============================================================

CREATE TABLE IF NOT EXISTS appointment_reminders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  appointment_id  UUID NOT NULL REFERENCES appointments(id),
  reminder_type   TEXT NOT NULL CHECK (reminder_type IN ('24h', '2h')),
  channel         TEXT NOT NULL DEFAULT 'whatsapp'
    CHECK (channel IN ('whatsapp', 'sms', 'email', 'in_app')),
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  scheduled_at    TIMESTAMPTZ NOT NULL,
  sent_at         TIMESTAMPTZ,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointment_reminders_pending
  ON appointment_reminders (clinic_id, scheduled_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_appointment_reminders_appointment
  ON appointment_reminders (appointment_id);

-- ============================================================
-- 4. SMART SCHEDULING METADATA
-- ============================================================

-- Doctor availability slots with buffer time support
CREATE TABLE IF NOT EXISTS doctor_availability (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  doctor_id       UUID NOT NULL REFERENCES users(id),
  day_of_week     INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  slot_duration   INTEGER NOT NULL DEFAULT 30,
  buffer_time     INTEGER NOT NULL DEFAULT 10,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, doctor_id, day_of_week)
);

-- Service type durations for smart scheduling
CREATE TABLE IF NOT EXISTS service_durations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  service_id      UUID NOT NULL REFERENCES services(id),
  doctor_id       UUID REFERENCES users(id),
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  buffer_minutes  INTEGER NOT NULL DEFAULT 10,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, service_id, doctor_id)
);

-- ============================================================
-- 5. RLS POLICIES
-- ============================================================

-- no_show_records
ALTER TABLE no_show_records ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'no_show_records_clinic_isolation'
  ) THEN
    CREATE POLICY no_show_records_clinic_isolation ON no_show_records
      FOR ALL
      USING (clinic_id = (current_setting('app.clinic_id', true))::uuid)
      WITH CHECK (clinic_id = (current_setting('app.clinic_id', true))::uuid);
  END IF;
END $$;

-- no_show_stats
ALTER TABLE no_show_stats ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'no_show_stats_clinic_isolation'
  ) THEN
    CREATE POLICY no_show_stats_clinic_isolation ON no_show_stats
      FOR ALL
      USING (clinic_id = (current_setting('app.clinic_id', true))::uuid)
      WITH CHECK (clinic_id = (current_setting('app.clinic_id', true))::uuid);
  END IF;
END $$;

-- doctor_no_show_stats
ALTER TABLE doctor_no_show_stats ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'doctor_no_show_stats_clinic_isolation'
  ) THEN
    CREATE POLICY doctor_no_show_stats_clinic_isolation ON doctor_no_show_stats
      FOR ALL
      USING (clinic_id = (current_setting('app.clinic_id', true))::uuid)
      WITH CHECK (clinic_id = (current_setting('app.clinic_id', true))::uuid);
  END IF;
END $$;

-- appointment_reminders
ALTER TABLE appointment_reminders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'appointment_reminders_clinic_isolation'
  ) THEN
    CREATE POLICY appointment_reminders_clinic_isolation ON appointment_reminders
      FOR ALL
      USING (clinic_id = (current_setting('app.clinic_id', true))::uuid)
      WITH CHECK (clinic_id = (current_setting('app.clinic_id', true))::uuid);
  END IF;
END $$;

-- doctor_availability
ALTER TABLE doctor_availability ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'doctor_availability_clinic_isolation'
  ) THEN
    CREATE POLICY doctor_availability_clinic_isolation ON doctor_availability
      FOR ALL
      USING (clinic_id = (current_setting('app.clinic_id', true))::uuid)
      WITH CHECK (clinic_id = (current_setting('app.clinic_id', true))::uuid);
  END IF;
END $$;

-- service_durations
ALTER TABLE service_durations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'service_durations_clinic_isolation'
  ) THEN
    CREATE POLICY service_durations_clinic_isolation ON service_durations
      FOR ALL
      USING (clinic_id = (current_setting('app.clinic_id', true))::uuid)
      WITH CHECK (clinic_id = (current_setting('app.clinic_id', true))::uuid);
  END IF;
END $$;
