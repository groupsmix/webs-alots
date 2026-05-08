-- Add Arabic name column to users table for bilingual prescriptions.
-- Doctors can optionally set their name in Arabic so it appears on the
-- Arabic column of the prescription PDF.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS name_ar TEXT;

COMMENT ON COLUMN public.users.name_ar IS 'Optional Arabic name for bilingual documents (prescriptions, certificates)';
