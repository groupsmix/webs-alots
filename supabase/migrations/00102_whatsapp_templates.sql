-- WhatsApp template storage for per-clinic custom templates
-- Allows clinics to manage their own WhatsApp message templates
-- with fallback to hardcoded defaults when no custom template exists.

CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  template_name text NOT NULL,
  language text NOT NULL DEFAULT 'ar',
  body_template text NOT NULL,
  variables jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  meta_template_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for efficient per-clinic template lookups
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_clinic_id
  ON whatsapp_templates(clinic_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_templates_clinic_name_lang
  ON whatsapp_templates(clinic_id, template_name, language);

-- Enable RLS
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can only access templates belonging to their clinic
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'whatsapp_templates'
      AND policyname = 'whatsapp_templates_clinic_isolation'
  ) THEN
    CREATE POLICY whatsapp_templates_clinic_isolation
      ON whatsapp_templates
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

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_whatsapp_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_whatsapp_templates_updated_at ON whatsapp_templates;
CREATE TRIGGER trg_whatsapp_templates_updated_at
  BEFORE UPDATE ON whatsapp_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_templates_updated_at();
