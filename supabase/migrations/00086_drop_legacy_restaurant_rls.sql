-- =============================================================================
-- Migration 00083: Drop legacy restaurant RLS policies + harden anon access
--
-- AUDIT FINDING #1 (P0 Critical): The restaurant-vertical RLS policies
-- added in 00062_restaurant_vertical.sql trust the unsigned
-- `x-clinic-id` request header via:
--
--   current_setting('request.headers', true)::json->>'x-clinic-id'
--
-- No auth-role check, no auth.uid() check, no is_clinic_staff().
-- PostgreSQL PERMISSIVE policies are OR-combined, so the secure policies
-- added in 00064_restaurant_tables.sql do not override the loose ones.
-- Direct Supabase REST calls with a spoofed x-clinic-id header bypass
-- Next.js middleware entirely and read/write any clinic's data.
--
-- This migration:
--   1. Drops all legacy header-based policies from 00062
--   2. Adds modern auth-aware policies on `orders` (00064 covered
--      menus/menu_items/restaurant_tables but not orders)
--   3. Revokes all anon privileges on restaurant tables (defense-in-depth)
--   4. Re-grants only SELECT on menus/menu_items for public menu display
--
-- See also: 00064_restaurant_tables.sql for the modern policies on
-- menus, menu_items, and restaurant_tables.
-- =============================================================================

BEGIN;

-- ─── Step 1: Drop legacy header-based policies from 00062 ─────────────────

DROP POLICY IF EXISTS "menus_all_staff" ON menus;
DROP POLICY IF EXISTS "menu_items_all_staff" ON menu_items;
DROP POLICY IF EXISTS "restaurant_tables_all_staff" ON restaurant_tables;
DROP POLICY IF EXISTS "orders_select_clinic" ON orders;
DROP POLICY IF EXISTS "orders_insert_clinic" ON orders;
DROP POLICY IF EXISTS "orders_update_clinic" ON orders;
DROP POLICY IF EXISTS "orders_delete_clinic" ON orders;

-- ─── Step 2: Add modern auth-aware policies on `orders` ───────────────────
-- These follow the same pattern as 00064's menus/menu_items/restaurant_tables
-- policies: require authenticated role + clinic_id match via helper functions.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'sa_orders_all' AND tablename = 'orders'
  ) THEN
    CREATE POLICY "sa_orders_all" ON orders FOR ALL
      USING (is_super_admin())
      WITH CHECK (is_super_admin());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'staff_orders' AND tablename = 'orders'
  ) THEN
    CREATE POLICY "staff_orders" ON orders FOR ALL
      USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
      WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
  END IF;
END $$;

-- ─── Step 3: Revoke all anon access on restaurant tables ──────────────────
-- Defense-in-depth: even if a future migration accidentally creates a
-- permissive anon policy, the REVOKE ensures anon has no table-level
-- privileges to exploit.

REVOKE ALL ON menus, menu_items, restaurant_tables, orders FROM anon;

-- ─── Step 4: Re-grant only what the public booking/menu surface needs ─────
-- Public (unauthenticated) visitors can view menus but not modify them.
-- No public access to orders or restaurant_tables.

GRANT SELECT ON menus, menu_items TO anon;

COMMIT;
