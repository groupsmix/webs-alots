-- DB-002: Enforce NOT NULL on notifications.clinic_id
--
-- The column was added in 00019 and RLS policies in 00029 already use it,
-- but it remains nullable. Rows without clinic_id bypass tenant scoping.
--
-- Step 1: Backfill any NULL clinic_id from the user's clinic assignment.
-- Step 2: Delete orphaned rows that cannot be resolved (no user or user has no clinic).
-- Step 3: Add NOT NULL constraint.

-- Backfill from users table
UPDATE notifications n
SET clinic_id = u.clinic_id
FROM users u
WHERE n.user_id = u.id
  AND n.clinic_id IS NULL
  AND u.clinic_id IS NOT NULL;

-- Remove orphans that cannot be attributed to a tenant
DELETE FROM notifications
WHERE clinic_id IS NULL;

-- Enforce NOT NULL going forward
ALTER TABLE notifications
  ALTER COLUMN clinic_id SET NOT NULL;

-- Add index for tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_notifications_clinic_id
  ON notifications(clinic_id);
