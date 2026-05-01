-- ============================================================
-- Migration 00072: Add clinic_id to notifications table
-- ============================================================
-- Audit Finding #5: The notifications table lacked a clinic_id column,
-- making it impossible to apply tenant-scoped RLS and risking
-- cross-tenant notification leaks in a multi-tenant healthcare platform.
--
-- This migration:
--   1. Adds a nullable clinic_id FK column
--   2. Backfills from the users table
--   3. Makes the column NOT NULL after backfill
--   4. Adds an index for tenant-scoped queries
--   5. Enables RLS with a tenant-scoped policy

-- Step 1: Add nullable column (safe for zero-downtime deploy)
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE;

-- Step 2: Backfill clinic_id from the users table
UPDATE notifications n
SET clinic_id = u.clinic_id
FROM users u
WHERE n.user_id = u.id
  AND n.clinic_id IS NULL
  AND u.clinic_id IS NOT NULL;

-- Step 3: Make NOT NULL after backfill (only if all rows are filled)
-- Guard: skip if any rows still have NULL clinic_id (e.g. orphaned records)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM notifications WHERE clinic_id IS NULL
  ) THEN
    ALTER TABLE notifications ALTER COLUMN clinic_id SET NOT NULL;
  END IF;
END $$;

-- Step 4: Add index for tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_notifications_clinic_id
  ON notifications(clinic_id);

-- Step 5: Enable RLS if not already enabled
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Step 6: Add tenant-scoped RLS policies
-- Allow users to see their own notifications within their clinic
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications' AND policyname = 'notifications_tenant_isolation'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY notifications_tenant_isolation ON notifications
        FOR ALL
        USING (
          clinic_id = COALESCE(
            current_setting('request.header.x-clinic-id', true)::uuid,
            (SELECT clinic_id FROM users WHERE auth_id = auth.uid())
          )
        )
    $policy$;
  END IF;
END $$;
