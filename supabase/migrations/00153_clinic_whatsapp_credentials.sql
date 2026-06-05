-- ============================================================
-- Migration 00153: Server-only WhatsApp credentials table
--
-- The Meta Cloud API access token is a long-lived secret that must
-- NEVER be readable from a user-scoped Supabase client. Migration
-- 00146 previously co-located it on the `clinics` table, but that
-- table is reachable via RLS by clinic_admin / receptionist / doctor
-- roles, which is an exposure path.
--
-- This migration:
--   1. Moves the column off clinics into a dedicated table.
--   2. Locks the table with a default-deny RLS policy so only the
--      service role (bypassing RLS) can read/write the token.
--   3. Backfills any pre-existing tokens from clinics (defensive —
--      no-op on fresh installs since 00146 no longer creates the
--      column).
--
-- Application code reads credentials via createAdminClient() in
-- src/lib/supabase-server.ts.
-- ============================================================

CREATE TABLE IF NOT EXISTS clinic_whatsapp_credentials (
  clinic_id             UUID        PRIMARY KEY
                                    REFERENCES clinics(id) ON DELETE CASCADE,
  whatsapp_access_token TEXT        NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE clinic_whatsapp_credentials IS
  'Server-only store for per-clinic Meta WhatsApp Business access tokens. '
  'RLS denies all user-scoped access; only the service role may read or write.';

ALTER TABLE clinic_whatsapp_credentials ENABLE ROW LEVEL SECURITY;

-- Default-deny: no authenticated, anon, or PostgREST role may touch this table.
-- The service role bypasses RLS, so server-side admin clients can still operate.
DROP POLICY IF EXISTS "service_role_only" ON clinic_whatsapp_credentials;
CREATE POLICY "service_role_only"
  ON clinic_whatsapp_credentials
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ── Backfill from clinics.whatsapp_access_token, if the column still exists.
-- ── Safe on fresh installs where 00146 already omits the column.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM   information_schema.columns
    WHERE  table_schema = 'public'
      AND  table_name   = 'clinics'
      AND  column_name  = 'whatsapp_access_token'
  ) THEN
    INSERT INTO clinic_whatsapp_credentials (clinic_id, whatsapp_access_token)
    SELECT id, whatsapp_access_token
    FROM   clinics
    WHERE  whatsapp_access_token IS NOT NULL
    ON CONFLICT (clinic_id) DO NOTHING;

    ALTER TABLE clinics DROP COLUMN whatsapp_access_token;
  END IF;
END $$;

-- Maintain updated_at on every write.
CREATE OR REPLACE FUNCTION clinic_whatsapp_credentials_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clinic_whatsapp_credentials_updated_at
  ON clinic_whatsapp_credentials;
CREATE TRIGGER trg_clinic_whatsapp_credentials_updated_at
  BEFORE UPDATE ON clinic_whatsapp_credentials
  FOR EACH ROW EXECUTE FUNCTION clinic_whatsapp_credentials_touch_updated_at();
