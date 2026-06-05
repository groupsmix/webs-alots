-- ============================================================
-- Migration 00146: Add per-clinic WhatsApp Business API columns
--
-- Each clinic can have its own Meta WhatsApp Business phone number,
-- enabling per-tenant message sending (appointment reminders, waitlist
-- notifications, prescription delivery).
--
-- SECURITY NOTE: whatsapp_access_token stores a long-lived access token.
-- In production this value should be encrypted at rest using Supabase Vault:
--   INSERT INTO vault.secrets (name, secret)
--   VALUES ('clinic_{id}_wa_token', '<token>');
-- The application layer (src/lib/whatsapp.ts) is responsible for
-- fetching the decrypted value before making API calls.
--
-- No new RLS policies are needed: the clinics table already has
-- policies that restrict writes to clinic_admin and super_admin roles.
-- ============================================================

ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS whatsapp_phone_id    TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_access_token TEXT;

COMMENT ON COLUMN clinics.whatsapp_phone_id IS
  'Meta WhatsApp Business phone number ID for this clinic. Used as the '
  'sender identifier in the Cloud API endpoint path.';

COMMENT ON COLUMN clinics.whatsapp_access_token IS
  'Meta Cloud API access token for this clinic''s phone number. '
  'Treat as a secret — store via Supabase Vault in production. '
  'Only present in plain text in local dev / staging.';
