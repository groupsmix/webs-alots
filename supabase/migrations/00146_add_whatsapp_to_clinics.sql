-- ============================================================
-- Migration 00146: Add per-clinic WhatsApp Business phone number ID
--
-- Each clinic can have its own Meta WhatsApp Business phone number,
-- enabling per-tenant message sending (appointment reminders, waitlist
-- notifications, prescription delivery).
--
-- SECURITY NOTE: only the *non-secret* phone number ID lives on this
-- table because the clinics table is reachable from user-scoped RLS
-- policies (clinic_admin, receptionist, doctor). The long-lived access
-- token is stored in the separate, service-role-only
-- `clinic_whatsapp_credentials` table created in migration 00153.
--
-- No new RLS policies are needed: the clinics table already has
-- policies that restrict writes to clinic_admin and super_admin roles.
-- ============================================================

ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS whatsapp_phone_id TEXT;

COMMENT ON COLUMN clinics.whatsapp_phone_id IS
  'Meta WhatsApp Business phone number ID for this clinic. Used as the '
  'sender identifier in the Cloud API endpoint path. NOT a secret — the '
  'access token lives in clinic_whatsapp_credentials.';
