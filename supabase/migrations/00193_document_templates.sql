-- Migration 00193: Global document templates managed by super_admin.
-- Used by the super-admin/templates page to persist templates across sessions.

CREATE TABLE IF NOT EXISTS document_templates (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  description  TEXT,
  type         TEXT        NOT NULL CHECK (type IN (
                 'prescription','invoice','report','certificate','consent','letter')),
  clinic_type  TEXT        NOT NULL DEFAULT 'all' CHECK (clinic_type IN (
                 'all','doctor','dentist','pharmacy')),
  content      TEXT        NOT NULL DEFAULT '',
  usage_count  INT         NOT NULL DEFAULT 0,
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;

-- Super admins can do everything.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'document_templates'
    AND policyname = 'super_admin_all_document_templates'
  ) THEN
    CREATE POLICY "super_admin_all_document_templates" ON document_templates
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE auth_id = auth.uid() AND role = 'super_admin'
        )
      );
  END IF;
END $$;

-- Authenticated users can read active templates (for clinic-side use).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'document_templates'
    AND policyname = 'authenticated_read_document_templates'
  ) THEN
    CREATE POLICY "authenticated_read_document_templates" ON document_templates
      FOR SELECT USING (is_active = true AND auth.uid() IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_document_templates_type
  ON document_templates(type);
CREATE INDEX IF NOT EXISTS idx_document_templates_active
  ON document_templates(is_active);
