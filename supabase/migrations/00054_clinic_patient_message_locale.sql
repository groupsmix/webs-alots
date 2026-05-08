-- Add patient_message_locale to clinics table
-- Controls which language templates are used for patient-facing
-- WhatsApp / SMS notifications: 'fr' (French), 'ar' (Arabic), 'darija' (Moroccan Arabic).
-- Defaults to 'fr' to match existing behaviour.

ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS patient_message_locale TEXT NOT NULL DEFAULT 'fr'
    CHECK (patient_message_locale IN ('fr', 'ar', 'darija'));

COMMENT ON COLUMN clinics.patient_message_locale IS
  'Locale for patient-facing WhatsApp messages: fr | ar | darija';
