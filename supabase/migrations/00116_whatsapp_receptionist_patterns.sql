-- Migration: WhatsApp Receptionist Patterns
-- Adds tables for: voice transcription pipeline, GDPR/consent management,
-- enhanced WABA routing, and booking state machine.
-- All tables scoped by clinic_id with RLS policies.

-- ============================================================
-- 1. WhatsApp Consent Table (GDPR/Loi 09-08)
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_consent (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id     uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  patient_phone text NOT NULL,
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('granted', 'revoked', 'pending', 'expired')),
  granted_at    timestamptz,
  revoked_at    timestamptz,
  ip_address    text,
  consent_method text NOT NULL DEFAULT 'web_form'
                  CHECK (consent_method IN ('whatsapp_reply', 'web_form', 'in_person', 'api')),
  consent_version text NOT NULL DEFAULT '1.0',
  data_categories jsonb NOT NULL DEFAULT '["appointment_notifications","prescription_alerts","lab_results","payment_reminders","general_communications"]'::jsonb,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (clinic_id, patient_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_consent_clinic
  ON whatsapp_consent (clinic_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_consent_patient
  ON whatsapp_consent (clinic_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_consent_phone
  ON whatsapp_consent (clinic_id, patient_phone);

-- RLS
ALTER TABLE whatsapp_consent ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'whatsapp_consent' AND policyname = 'whatsapp_consent_clinic_isolation'
  ) THEN
    CREATE POLICY whatsapp_consent_clinic_isolation ON whatsapp_consent
      USING (clinic_id = current_setting('app.clinic_id', true)::uuid);
  END IF;
END
$$;

-- ============================================================
-- 2. WhatsApp Voice Transcriptions Table
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_voice_transcriptions (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id         uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_phone     text NOT NULL,
  patient_id        uuid REFERENCES users(id) ON DELETE SET NULL,
  transcription_text text NOT NULL,
  language          text NOT NULL DEFAULT 'fr',
  confidence        real NOT NULL DEFAULT 0,
  stt_provider      text NOT NULL DEFAULT 'openai'
                      CHECK (stt_provider IN ('openai', 'elevenlabs')),
  booking_created   boolean DEFAULT false,
  created_at        timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_voice_transcriptions_clinic
  ON whatsapp_voice_transcriptions (clinic_id);
CREATE INDEX IF NOT EXISTS idx_voice_transcriptions_patient
  ON whatsapp_voice_transcriptions (clinic_id, patient_id);

-- RLS
ALTER TABLE whatsapp_voice_transcriptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'whatsapp_voice_transcriptions'
      AND policyname = 'voice_transcriptions_clinic_isolation'
  ) THEN
    CREATE POLICY voice_transcriptions_clinic_isolation ON whatsapp_voice_transcriptions
      USING (clinic_id = current_setting('app.clinic_id', true)::uuid);
  END IF;
END
$$;

-- ============================================================
-- 3. WABA Phone Number Mapping (enhanced routing)
-- ============================================================
-- Add whatsapp_phone_number_id to clinics if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clinics' AND column_name = 'whatsapp_phone_number_id'
  ) THEN
    ALTER TABLE clinics ADD COLUMN whatsapp_phone_number_id text;
  END IF;
END
$$;

-- Add whatsapp_display_number to clinics if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clinics' AND column_name = 'whatsapp_display_number'
  ) THEN
    ALTER TABLE clinics ADD COLUMN whatsapp_display_number text;
  END IF;
END
$$;

-- Add whatsapp_business_account_id to clinics if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clinics' AND column_name = 'whatsapp_business_account_id'
  ) THEN
    ALTER TABLE clinics ADD COLUMN whatsapp_business_account_id text;
  END IF;
END
$$;

-- Unique index on whatsapp_phone_number_id for routing lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_clinics_waba_phone_number
  ON clinics (whatsapp_phone_number_id) WHERE whatsapp_phone_number_id IS NOT NULL;

-- ============================================================
-- 4. Booking State Machine — enhance whatsapp_conversations
-- ============================================================
-- Add booking_state to whatsapp_conversations if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_conversations' AND column_name = 'booking_state'
  ) THEN
    ALTER TABLE whatsapp_conversations ADD COLUMN booking_state text DEFAULT 'idle'
      CHECK (booking_state IN (
        'idle', 'awaiting_service', 'awaiting_doctor',
        'awaiting_date', 'awaiting_time', 'confirming',
        'completed', 'cancelled', 'escalated'
      ));
  END IF;
END
$$;

-- Add booking_context to whatsapp_conversations if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_conversations' AND column_name = 'booking_context'
  ) THEN
    ALTER TABLE whatsapp_conversations ADD COLUMN booking_context jsonb DEFAULT '{}'::jsonb;
  END IF;
END
$$;

-- Add escalation_reason for human handoff
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_conversations' AND column_name = 'escalation_reason'
  ) THEN
    ALTER TABLE whatsapp_conversations ADD COLUMN escalation_reason text;
  END IF;
END
$$;

-- ============================================================
-- 5. Add booking_source 'whatsapp_voice' to appointments if check exists
-- ============================================================
-- Only add if there is a check constraint on booking_source that needs updating.
-- Most setups use free-text booking_source, so this is a no-op guard.
DO $$
DECLARE
  constraint_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name LIKE '%booking_source%'
  ) INTO constraint_exists;

  -- If no constraint, 'whatsapp_voice' is already valid as a free text value.
  -- No action needed.
END
$$;

-- ============================================================
-- 6. Consent audit helper view
-- ============================================================
CREATE OR REPLACE VIEW whatsapp_consent_audit AS
SELECT
  wc.id,
  wc.clinic_id,
  wc.patient_id,
  wc.patient_phone,
  wc.status,
  wc.consent_method,
  wc.consent_version,
  wc.granted_at,
  wc.revoked_at,
  wc.data_categories,
  u.name AS patient_name,
  c.name AS clinic_name
FROM whatsapp_consent wc
LEFT JOIN users u ON u.id = wc.patient_id
LEFT JOIN clinics c ON c.id = wc.clinic_id;
