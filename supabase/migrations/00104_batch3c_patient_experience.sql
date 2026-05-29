-- Patient Experience: QR check-in tokens, waiting queue, NPS surveys

-- ── QR Check-in Tokens ─────────────────────────────────────────────────
-- Stores generated QR tokens that patients scan at the clinic entrance.
-- Each token maps to a specific appointment and expires after use or EOD.

CREATE TABLE IF NOT EXISTS qr_checkin_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  token text NOT NULL,
  scanned_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_qr_checkin_tokens_token
  ON qr_checkin_tokens(token);

CREATE INDEX IF NOT EXISTS idx_qr_checkin_tokens_clinic_id
  ON qr_checkin_tokens(clinic_id);

CREATE INDEX IF NOT EXISTS idx_qr_checkin_tokens_appointment_id
  ON qr_checkin_tokens(appointment_id);

ALTER TABLE qr_checkin_tokens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'qr_checkin_tokens'
      AND policyname = 'qr_checkin_tokens_clinic_isolation'
  ) THEN
    CREATE POLICY qr_checkin_tokens_clinic_isolation
      ON qr_checkin_tokens
      FOR ALL
      USING (
        clinic_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'clinic_id')::uuid
      )
      WITH CHECK (
        clinic_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'clinic_id')::uuid
      );
  END IF;
END
$$;

-- ── Waiting Queue ──────────────────────────────────────────────────────
-- Tracks patients in the waiting room with estimated wait times.
-- Used by the live queue display and realtime subscriptions.

CREATE TABLE IF NOT EXISTS waiting_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  doctor_id uuid NOT NULL,
  position integer NOT NULL DEFAULT 0,
  estimated_wait_minutes integer NOT NULL DEFAULT 0,
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  called_at timestamptz,
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'called', 'in_progress', 'completed', 'no_show')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waiting_queue_clinic_id
  ON waiting_queue(clinic_id);

CREATE INDEX IF NOT EXISTS idx_waiting_queue_clinic_status
  ON waiting_queue(clinic_id, status);

CREATE INDEX IF NOT EXISTS idx_waiting_queue_doctor_id
  ON waiting_queue(doctor_id);

ALTER TABLE waiting_queue ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'waiting_queue'
      AND policyname = 'waiting_queue_clinic_isolation'
  ) THEN
    CREATE POLICY waiting_queue_clinic_isolation
      ON waiting_queue
      FOR ALL
      USING (
        clinic_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'clinic_id')::uuid
      )
      WITH CHECK (
        clinic_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'clinic_id')::uuid
      );
  END IF;
END
$$;

-- Enable realtime for live queue display
ALTER PUBLICATION supabase_realtime ADD TABLE waiting_queue;

-- ── NPS Surveys ────────────────────────────────────────────────────────
-- Tracks patient satisfaction (Net Promoter Score) per appointment.
-- Auto-sent via WhatsApp 24h after appointment completion.

CREATE TABLE IF NOT EXISTS nps_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  doctor_id uuid NOT NULL,
  score integer CHECK (score >= 0 AND score <= 10),
  comment text,
  sent_at timestamptz,
  responded_at timestamptz,
  whatsapp_message_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_nps_surveys_appointment_id
  ON nps_surveys(appointment_id);

CREATE INDEX IF NOT EXISTS idx_nps_surveys_clinic_id
  ON nps_surveys(clinic_id);

CREATE INDEX IF NOT EXISTS idx_nps_surveys_doctor_id
  ON nps_surveys(clinic_id, doctor_id);

ALTER TABLE nps_surveys ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'nps_surveys'
      AND policyname = 'nps_surveys_clinic_isolation'
  ) THEN
    CREATE POLICY nps_surveys_clinic_isolation
      ON nps_surveys
      FOR ALL
      USING (
        clinic_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'clinic_id')::uuid
      )
      WITH CHECK (
        clinic_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'clinic_id')::uuid
      );
  END IF;
END
$$;
