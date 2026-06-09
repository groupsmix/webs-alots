-- F-16: Enforceable per-clinic, per-category upload size limits.
--
-- Previously, the `maxSize` parameter in `getPresignedUploadPost()` was
-- advisory-only (presigned PUTs cannot enforce content-length-range like S3
-- presigned POSTs can). The authoritative enforcement is the PUT /api/upload
-- confirm step. This table stores per-clinic overrides for those caps so
-- clinic admins can tighten limits below the platform defaults without a
-- code deploy.
--
-- Lookup order in application code:
--   1. upload_policies row for (clinic_id, category)  → use max_upload_bytes
--   2. Hardcoded LIMITS_BY_CATEGORY platform defaults  → fallback
--   3. DEFAULT_UPLOAD_LIMIT (10 MB)                   → last resort
--
-- The application layer caps all values at MAX_UPLOAD_BYTES (25 MB) regardless
-- of what is stored here.

CREATE TABLE IF NOT EXISTS upload_policies (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  -- Normalized category name (matches normalizePhiCategory output)
  category         text NOT NULL,
  -- Limit in bytes; must be > 0 and <= 26214400 (25 MiB platform ceiling)
  max_upload_bytes bigint NOT NULL
    CHECK (max_upload_bytes > 0 AND max_upload_bytes <= 26214400),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT upload_policies_clinic_category_unique UNIQUE (clinic_id, category)
);

CREATE INDEX IF NOT EXISTS idx_upload_policies_clinic_id
  ON upload_policies(clinic_id);

ALTER TABLE upload_policies ENABLE ROW LEVEL SECURITY;

-- Clinic staff can read their own clinic's policies
CREATE POLICY "upload_policies_select_own_clinic"
  ON upload_policies FOR SELECT TO authenticated
  USING (clinic_id = get_request_clinic_id());

-- Only clinic_admin (and super_admin via service role) may insert
CREATE POLICY "upload_policies_insert_clinic_admin"
  ON upload_policies FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = get_request_clinic_id()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.clinic_id = get_request_clinic_id()
        AND users.role IN ('clinic_admin', 'super_admin')
    )
  );

-- Only clinic_admin may update
CREATE POLICY "upload_policies_update_clinic_admin"
  ON upload_policies FOR UPDATE TO authenticated
  USING (
    clinic_id = get_request_clinic_id()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.clinic_id = get_request_clinic_id()
        AND users.role IN ('clinic_admin', 'super_admin')
    )
  );

-- Only clinic_admin may delete
CREATE POLICY "upload_policies_delete_clinic_admin"
  ON upload_policies FOR DELETE TO authenticated
  USING (
    clinic_id = get_request_clinic_id()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.clinic_id = get_request_clinic_id()
        AND users.role IN ('clinic_admin', 'super_admin')
    )
  );
