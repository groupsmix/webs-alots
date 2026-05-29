-- =============================================================================
-- Migration 00100: Header-based RLS remediation for notification_queue
--
-- AUDIT FINDING (Critical, tenant isolation / broken access control):
-- Same class as 00086 (restaurant) and 00098 (pet_profiles/partner_api_keys).
-- notification_queue (created in 00050) has a single PERMISSIVE SELECT policy
-- that trusts the unsigned `x-tenant-clinic-id` request header with NO
-- auth.uid() / is_clinic_staff() / is_super_admin() gate:
--
--   clinic_id::text = coalesce(
--     current_setting('request.headers', true)::json->>'x-tenant-clinic-id', '')
--
-- The `anon` role holds the default table SELECT grant, so a direct Supabase
-- REST call with the public anon key and a spoofed `x-tenant-clinic-id` header
-- reads any clinic's queued notification bodies — which contain PHI
-- (patient names, appointment details, reminders)
-- (CWE-639 Authorization Bypass Through User-Controlled Key,
--  OWASP A01:2021 Broken Access Control).
--
-- Compatibility:
--   notification_queue is read and written exclusively by server-side code
--   using the service-role admin client (createAdminClient(...) in
--   src/lib/notification-queue.ts, cron and webhook routes). The service role
--   bypasses RLS, so no legitimate client ever relied on the header policy.
--   The header name (`x-tenant-clinic-id`) does not even match the
--   `x-clinic-id` header the app sends, confirming no client read path used it.
--
-- This migration mirrors 00086 / 00098:
--   1. Drops the legacy header-based policy.
--   2. Adds modern auth-aware policies (super admin + clinic staff).
--   3. Revokes anon table privileges (defense-in-depth).
-- =============================================================================

BEGIN;

-- Step 1: Drop the legacy header-only SELECT policy from 00050.
DROP POLICY IF EXISTS "notification_queue_select_own_clinic" ON notification_queue;

-- Step 2: Add modern auth-aware read policies (idempotent).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notification_queue' AND policyname = 'sa_notification_queue_all'
  ) THEN
    CREATE POLICY "sa_notification_queue_all" ON notification_queue FOR ALL
      USING (is_super_admin())
      WITH CHECK (is_super_admin());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notification_queue' AND policyname = 'staff_notification_queue_select'
  ) THEN
    CREATE POLICY "staff_notification_queue_select" ON notification_queue FOR SELECT
      USING (clinic_id = get_user_clinic_id() AND is_clinic_staff());
  END IF;
END $$;

-- Step 3: Defense-in-depth — anon has no business reading queued PHI.
REVOKE ALL ON notification_queue FROM anon;

COMMIT;
