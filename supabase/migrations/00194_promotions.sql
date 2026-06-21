-- Migration 00194: Global promotions managed by super_admin.
-- Used by the super-admin/pricing "Promotions" tab to persist promotional
-- discounts across sessions and operators (previously localStorage-only).
-- Platform-wide table: NO clinic_id column (promotions target subscription
-- tiers via the `tiers` array, not individual clinics).

CREATE TABLE IF NOT EXISTS promotions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT        NOT NULL,
  discount_percent INT         NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  tiers            TEXT[]      NOT NULL DEFAULT '{}',
  start_date       DATE,
  end_date         DATE,
  enabled          BOOLEAN     NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

-- Super admins can do everything.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'promotions'
    AND policyname = 'super_admin_all_promotions'
  ) THEN
    CREATE POLICY "super_admin_all_promotions" ON promotions
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE auth_id = auth.uid() AND role = 'super_admin'
        )
      );
  END IF;
END $$;

-- Authenticated users can read enabled promotions (for clinic-side display).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'promotions'
    AND policyname = 'authenticated_read_promotions'
  ) THEN
    CREATE POLICY "authenticated_read_promotions" ON promotions
      FOR SELECT USING (enabled = true AND auth.uid() IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_promotions_enabled ON promotions(enabled);
CREATE INDEX IF NOT EXISTS idx_promotions_created ON promotions(created_at DESC);
