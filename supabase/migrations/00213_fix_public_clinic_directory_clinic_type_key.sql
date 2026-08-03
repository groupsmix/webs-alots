-- Use the normalized clinic_type_key as the canonical type exposed by
-- public_clinic_directory. The legacy `clinics.type` column is kept as a
-- fallback for clinics that have not been migrated yet.
CREATE OR REPLACE VIEW public.public_clinic_directory AS
SELECT id,
       name,
       subdomain,
       COALESCE(clinic_type_key, type) AS type,
       tier,
       status,
       patient_message_locale
FROM public.clinics
WHERE status = 'active'
  AND deleted_at IS NULL;
