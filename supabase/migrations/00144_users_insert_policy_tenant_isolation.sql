-- ============================================================
-- Migration 00144: Close cross-tenant INSERT hole on `users`
--
-- PROBLEM
-- -------
-- Migration 00028 (CRITICAL-04) replaced the WITH CHECK (TRUE) policy on
-- `users` with a tighter `users_insert_self_only` policy:
--
--   FOR INSERT WITH CHECK (
--     auth.uid() IS NULL
--     OR (auth_id = auth.uid() AND role = 'patient')
--   )
--
-- The first branch was intended to allow the SECURITY DEFINER auth trigger
-- (`handle_new_auth_user`) to insert profiles. The author assumed
-- `auth.uid() IS NULL` uniquely identifies the trigger context.
--
-- It does not. Any unauthenticated request made with the public anon key
-- *also* has `auth.uid() = NULL`, because PostgREST resolves
-- `auth.uid()` from the JWT's `sub` claim and the anon JWT has no `sub`.
--
-- This means any anon client could INSERT arbitrary rows into `users`
-- with any `clinic_id` and `role = 'patient'`, bypassing tenant isolation.
-- The RLS integration suite catches this with two failing assertions:
--
--   - rls-assertions.test.ts:213
--     "should prevent Clinic A from inserting users into Clinic B"
--   - cross-tenant-api.test.ts:196
--     "Cross-tenant INSERT — users: Clinic X anon inserts clinic_id=Y must fail"
--
-- This is the same class of bug fixed by migration 00031 for SELECT
-- policies (chatbot_config, chatbot_faqs, collection_points, lab_tests,
-- blog_posts). The `users` INSERT path was missed in that pass.
--
-- FIX
-- ---
-- Replace `auth.uid() IS NULL` with a check against `current_user`. The
-- SECURITY DEFINER auth trigger runs as its function owner (a privileged
-- database role); the anon and authenticated PostgREST roles cannot
-- masquerade as those roles. This precisely identifies the trigger
-- context without conflating it with anonymous HTTP requests.
--
-- Privileged inserts (admin-create user, register_new_clinic) continue
-- to go through the service_role JWT, which bypasses RLS at the role
-- level. The `service_role` entry in the allowlist is belt-and-braces.
--
-- References: F-A99-02, S0-08-02, PR #956 review
-- ============================================================

DROP POLICY IF EXISTS "users_insert_self_only" ON users;

CREATE POLICY "users_insert_self_only" ON users
  FOR INSERT WITH CHECK (
    -- Privileged path: SECURITY DEFINER trigger and service-role inserts.
    -- These run as a privileged DB role, not as anon/authenticated.
    current_user IN (
      'postgres',
      'supabase_admin',
      'supabase_auth_admin',
      'service_role'
    )
    OR (
      -- Authenticated self-signup as patient (kept for backward compat
      -- with pre-trigger flows). Defense in depth: must own the auth
      -- row, role must be patient, and clinic_id must either be NULL
      -- (pre-clinic-assignment) or match the request's tenant context.
      auth.uid() IS NOT NULL
      AND auth_id = auth.uid()
      AND role = 'patient'
      AND (
        clinic_id IS NULL
        OR clinic_id = get_request_clinic_id()
      )
    )
  );

COMMENT ON POLICY "users_insert_self_only" ON users IS
  'Tenant-safe INSERT policy. Replaces the auth.uid() IS NULL escape hatch '
  'from migration 00028 which allowed anon-key cross-tenant inserts. See '
  'migration 00144 for the full rationale.';
