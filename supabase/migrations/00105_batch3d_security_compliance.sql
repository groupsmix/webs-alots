-- Data retention policy tracking for Moroccan Law 09-08 compliance.
-- Morocco mandates medical records be retained for 5 years (1826 days).
-- This table tracks per-clinic retention status and flags records
-- approaching their retention expiry for admin review.

-- Archived records ledger: tracks which records have been archived
-- and when they become eligible for permanent deletion.
CREATE TABLE IF NOT EXISTS archived_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  patient_id uuid REFERENCES users(id) ON DELETE SET NULL,
  archived_at timestamptz NOT NULL DEFAULT now(),
  retention_expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'archived' CHECK (status IN ('archived', 'pending_deletion', 'deleted')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_archived_records_clinic_id
  ON archived_records(clinic_id);

CREATE INDEX IF NOT EXISTS idx_archived_records_status
  ON archived_records(status);

CREATE INDEX IF NOT EXISTS idx_archived_records_retention_expires
  ON archived_records(retention_expires_at);

CREATE INDEX IF NOT EXISTS idx_archived_records_source
  ON archived_records(source_table, source_id);

-- Enable RLS
ALTER TABLE archived_records ENABLE ROW LEVEL SECURITY;

-- RLS policy: clinic isolation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'archived_records'
      AND policyname = 'archived_records_clinic_isolation'
  ) THEN
    CREATE POLICY archived_records_clinic_isolation
      ON archived_records
      FOR ALL
      USING (
        clinic_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'clinic_id')::uuid
        OR
        clinic_id::text = current_setting('request.header.x-clinic-id', true)
      );
  END IF;
END
$$;

-- Data retention configuration per clinic
CREATE TABLE IF NOT EXISTS retention_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  table_name text NOT NULL,
  retention_days integer NOT NULL DEFAULT 1826, -- 5 years (Moroccan law)
  auto_archive boolean NOT NULL DEFAULT true,
  notify_before_days integer NOT NULL DEFAULT 90, -- notify 90 days before expiry
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(clinic_id, table_name)
);

CREATE INDEX IF NOT EXISTS idx_retention_policies_clinic_id
  ON retention_policies(clinic_id);

-- Enable RLS
ALTER TABLE retention_policies ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'retention_policies'
      AND policyname = 'retention_policies_clinic_isolation'
  ) THEN
    CREATE POLICY retention_policies_clinic_isolation
      ON retention_policies
      FOR ALL
      USING (
        clinic_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'clinic_id')::uuid
        OR
        clinic_id::text = current_setting('request.header.x-clinic-id', true)
      );
  END IF;
END
$$;
