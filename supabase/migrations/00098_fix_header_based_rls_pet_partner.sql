-- =============================================================================
-- Migration 00098: Complete header-based RLS remediation
--                  (pet_profiles + partner_api_keys)
--
-- AUDIT FINDING (Critical, tenant isolation / broken access control):
-- The same class of vulnerability that was fixed for the restaurant vertical
-- in 00086_drop_legacy_restaurant_rls.sql still affects two tables:
--
--   * pet_profiles    (created in 00061_veterinary_vertical.sql)
--   * partner_api_keys (created in 00068_consolidated_audit_fixes.sql)
--
-- Both define PERMISSIVE RLS policies that trust the unsigned `x-clinic-id`
-- request header with NO auth.uid() / is_clinic_staff() / is_super_admin()
-- gate, e.g.:
--
--   clinic_id::text = current_setting('request.headers', true)::json->>'x-clinic-id'
--   clinic_id       = (current_setting('request.header.x-clinic-id', true))::uuid
--
-- PostgreSQL PERMISSIVE policies are OR-combined, so the modern auth-aware
-- policies (00063 for pet_profiles; the staff/SA policies for clinic_api_keys)
-- do NOT override these loose ones. A direct Supabase REST call using the
-- public anon key with a spoofed `x-clinic-id` header bypasses Next.js
-- middleware entirely and can read/write any clinic's rows
-- (CWE-639 Authorization Bypass Through User-Controlled Key,
--  OWASP A01:2021 Broken Access Control).
--
-- This migration mirrors 00086:
--   1. Drops the legacy header-based policies.
--   2. Ensures the modern auth-aware policies exist (idempotent).
--   3. Revokes anon table privileges (defense-in-depth).
--
-- Compatibility:
--   * pet_profiles is only accessed via authenticated API routes
--     (src/app/api/pets/**, all wrapped in withAuth), which use the
--     `authenticated` role + get_user_clinic_id()/is_clinic_staff().
--     No anonymous/public surface reads pet_profiles.
--   * partner_api_keys has no application code path; locking anon access
--     cannot break any current flow.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 1: pet_profiles
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1: Drop the legacy header-based / auth.uid()-mismatched policies from
-- 00061. (The owner policies used `owner_id = auth.uid()`, comparing the
-- users.id PK against the auth UUID — they never matched anyway. The secure
-- owner read policy is owner_pet_profiles_read, recreated below.)
DROP POLICY IF EXISTS "pet_profiles_select_clinic_staff" ON pet_profiles;
DROP POLICY IF EXISTS "pet_profiles_insert_staff" ON pet_profiles;
DROP POLICY IF EXISTS "pet_profiles_update_staff" ON pet_profiles;
DROP POLICY IF EXISTS "pet_profiles_delete_staff" ON pet_profiles;
DROP POLICY IF EXISTS "pet_profiles_select_owner" ON pet_profiles;
DROP POLICY IF EXISTS "pet_profiles_insert_owner" ON pet_profiles;
DROP POLICY IF EXISTS "pet_profiles_update_owner" ON pet_profiles;

-- Step 2: Ensure the modern auth-aware policies from 00063 exist (idempotent).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pet_profiles' AND policyname = 'sa_pet_profiles_all'
  ) THEN
    CREATE POLICY "sa_pet_profiles_all" ON pet_profiles FOR ALL
      USING (is_super_admin())
      WITH CHECK (is_super_admin());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pet_profiles' AND policyname = 'staff_pet_profiles'
  ) THEN
    CREATE POLICY "staff_pet_profiles" ON pet_profiles FOR ALL
      USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
      WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pet_profiles' AND policyname = 'owner_pet_profiles_read'
  ) THEN
    CREATE POLICY "owner_pet_profiles_read" ON pet_profiles FOR SELECT
      USING (owner_id = get_my_user_id());
  END IF;
END $$;

-- Step 3: Defense-in-depth — anon has no business touching pet PII.
REVOKE ALL ON pet_profiles FROM anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 2: partner_api_keys
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1: Drop the header-only FOR ALL policy from 00068.
DROP POLICY IF EXISTS "partner_api_keys_clinic_scope" ON partner_api_keys;

-- Step 2: Add modern auth-aware policies (super admin + clinic staff scoped).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'partner_api_keys' AND policyname = 'sa_partner_api_keys_all'
  ) THEN
    CREATE POLICY "sa_partner_api_keys_all" ON partner_api_keys FOR ALL
      USING (is_super_admin())
      WITH CHECK (is_super_admin());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'partner_api_keys' AND policyname = 'staff_partner_api_keys'
  ) THEN
    CREATE POLICY "staff_partner_api_keys" ON partner_api_keys FOR ALL
      USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
      WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
  END IF;
END $$;

-- Step 3: Defense-in-depth — anon must never read API key material.
REVOKE ALL ON partner_api_keys FROM anon;

COMMIT;
