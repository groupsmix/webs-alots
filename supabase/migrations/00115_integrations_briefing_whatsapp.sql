-- Migration: 00114_integrations_briefing_whatsapp
-- Adds tables for daily briefing preferences and WhatsApp conversation state.

-- ── Daily Briefing Preferences ──────────────────────────────────────────
-- Per-clinic settings for the morning WhatsApp briefing (cron/daily-briefing).
-- Each clinic can enable/disable the briefing and choose recipients.

CREATE TABLE IF NOT EXISTS daily_briefing_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  send_hour integer NOT NULL DEFAULT 7,
  timezone text NOT NULL DEFAULT 'Africa/Casablanca',
  recipient_roles text[] NOT NULL DEFAULT ARRAY['receptionist', 'clinic_admin'],
  include_appointments boolean NOT NULL DEFAULT true,
  include_cancellations boolean NOT NULL DEFAULT true,
  include_waitlist boolean NOT NULL DEFAULT true,
  include_overdue_payments boolean NOT NULL DEFAULT true,
  include_birthdays boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_briefing_config_clinic_unique UNIQUE (clinic_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_briefing_config_clinic
  ON daily_briefing_config(clinic_id);

ALTER TABLE daily_briefing_config ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'daily_briefing_config'
      AND policyname = 'daily_briefing_config_clinic_isolation'
  ) THEN
    CREATE POLICY daily_briefing_config_clinic_isolation
      ON daily_briefing_config
      FOR ALL
      USING (clinic_id = get_user_clinic_id() AND is_clinic_staff());
  END IF;
END $$;

-- ── Daily Briefing Log ──────────────────────────────────────────────────
-- Tracks which briefings have been sent to prevent duplicate sends.

CREATE TABLE IF NOT EXISTS daily_briefing_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  briefing_date date NOT NULL,
  recipient_user_id uuid NOT NULL,
  recipient_phone text NOT NULL,
  message_id text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT daily_briefing_log_unique UNIQUE (clinic_id, briefing_date, recipient_user_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_briefing_log_clinic_date
  ON daily_briefing_log(clinic_id, briefing_date);

ALTER TABLE daily_briefing_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'daily_briefing_log'
      AND policyname = 'daily_briefing_log_clinic_isolation'
  ) THEN
    CREATE POLICY daily_briefing_log_clinic_isolation
      ON daily_briefing_log
      FOR ALL
      USING (clinic_id = get_user_clinic_id() AND is_clinic_staff());
  END IF;
END $$;

-- ── WhatsApp Conversation State ─────────────────────────────────────────
-- Tracks multi-turn WhatsApp conversation state for each patient.
-- Used by the WhatsApp-first interaction handler to manage context.

CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_phone text NOT NULL,
  patient_id uuid,
  current_intent text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_conversations_clinic_phone
  ON whatsapp_conversations(clinic_id, patient_phone);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_expires
  ON whatsapp_conversations(expires_at)
  WHERE current_intent IS NOT NULL;

ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'whatsapp_conversations'
      AND policyname = 'whatsapp_conversations_clinic_isolation'
  ) THEN
    CREATE POLICY whatsapp_conversations_clinic_isolation
      ON whatsapp_conversations
      FOR ALL
      USING (clinic_id = get_user_clinic_id() AND is_clinic_staff());
  END IF;
END $$;

-- ── Prescription Renewal Requests ───────────────────────────────────────
-- Tracks prescription renewal requests submitted via WhatsApp.

CREATE TABLE IF NOT EXISTS prescription_renewal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  patient_phone text NOT NULL,
  medication_name text,
  status text NOT NULL DEFAULT 'pending',
  doctor_id uuid,
  notes text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prescription_renewal_clinic
  ON prescription_renewal_requests(clinic_id);

CREATE INDEX IF NOT EXISTS idx_prescription_renewal_status
  ON prescription_renewal_requests(clinic_id, status)
  WHERE status = 'pending';

ALTER TABLE prescription_renewal_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'prescription_renewal_requests'
      AND policyname = 'prescription_renewal_clinic_isolation'
  ) THEN
    CREATE POLICY prescription_renewal_clinic_isolation
      ON prescription_renewal_requests
      FOR ALL
      USING (clinic_id = get_user_clinic_id() AND is_clinic_staff());
  END IF;
END $$;
