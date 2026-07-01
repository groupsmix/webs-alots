-- ============================================================================
-- 00201: Bind authenticated RLS to the JWT-derived clinic, not the request
--        header (SECURITY — cross-tenant read hardening)
-- ============================================================================
--
-- BACKGROUND
-- ----------
-- get_request_clinic_id() (00041/00042) resolves the tenant from the
-- client-supplied `x-clinic-id` request header. That is the correct source
-- for ANONYMOUS/public traffic (public directory, booking pages), where the
-- header is the only tenant signal and the exposed rows are non-sensitive
-- showcase data. For that reason the public policies in 00041 gate the header
-- path behind `auth.uid() IS NULL` and fall back to get_user_clinic_id() for
-- authenticated users.
--
-- Several later tables instead granted AUTHENTICATED access with:
--
--     clinic_id = get_request_clinic_id() AND auth.role() = 'authenticated'
--
-- The `x-clinic-id` header is fully attacker-controllable, and
-- `auth.role() = 'authenticated'` is satisfied by ANY logged-in user, so a
-- user belonging to clinic A could issue a request carrying
-- `x-clinic-id: <clinic B>` and read clinic B's rows. On the PHI tables
-- (patient_files, medical_alerts) this is a cross-tenant PHI exposure.
--
-- FIX
-- ---
-- Key authenticated access on get_user_clinic_id() (00002), which is derived
-- from the caller's own users row (WHERE auth_id = auth.uid()) and therefore
-- cannot be spoofed via a header. get_user_clinic_id() returns NULL for
-- anonymous callers, so `clinic_id = get_user_clinic_id()` is also implicitly
-- authenticated-only and the `auth.role()` check becomes redundant.
--
-- Super-admin console reads continue to run through the service role (which
-- bypasses RLS); where a super-admin SELECT policy already existed it is
-- retained/corrected to use is_super_admin() (00002) instead of the
-- `users.id = auth.uid()` comparison, which compared the wrong column
-- (auth.uid() maps to users.auth_id, not users.id) and never matched.
--
-- Idempotent: every policy is dropped-if-exists and recreated.
-- ============================================================================

-- ── PHI: patient_files (was 00180) ─────────────────────────────────────────
DROP POLICY IF EXISTS "patient_files_clinic_access" ON patient_files;
CREATE POLICY "patient_files_clinic_access"
  ON patient_files FOR ALL
  USING (clinic_id = get_user_clinic_id())
  WITH CHECK (clinic_id = get_user_clinic_id());

-- ── PHI: medical_alerts (was 00165) ────────────────────────────────────────
DROP POLICY IF EXISTS "medical_alerts_clinic_access" ON medical_alerts;
CREATE POLICY "medical_alerts_clinic_access"
  ON medical_alerts FOR ALL
  USING (clinic_id = get_user_clinic_id())
  WITH CHECK (clinic_id = get_user_clinic_id());

-- ── clinic_ai_briefings (was 00166) ────────────────────────────────────────
DROP POLICY IF EXISTS "clinic_ai_briefings_clinic_admin_select" ON clinic_ai_briefings;
CREATE POLICY "clinic_ai_briefings_clinic_admin_select"
  ON clinic_ai_briefings FOR SELECT
  USING (clinic_id = get_user_clinic_id());

-- Correct the super-admin policy: is_super_admin() resolves via users.auth_id,
-- the previous `users.id = auth.uid()` predicate never matched.
DROP POLICY IF EXISTS "clinic_ai_briefings_super_admin_select" ON clinic_ai_briefings;
CREATE POLICY "clinic_ai_briefings_super_admin_select"
  ON clinic_ai_briefings FOR SELECT
  USING (is_super_admin());

-- ── subscription_history / usage_snapshots (was 00167) ─────────────────────
DROP POLICY IF EXISTS "sub_history_clinic_access" ON subscription_history;
CREATE POLICY "sub_history_clinic_access"
  ON subscription_history FOR SELECT
  USING (clinic_id = get_user_clinic_id());

DROP POLICY IF EXISTS "usage_snapshots_clinic_select" ON usage_snapshots;
CREATE POLICY "usage_snapshots_clinic_select"
  ON usage_snapshots FOR SELECT
  USING (clinic_id = get_user_clinic_id());

-- ── referral_codes / referral_events / referral_credits (was 00168) ────────
DROP POLICY IF EXISTS "referral_codes_clinic_select" ON referral_codes;
CREATE POLICY "referral_codes_clinic_select"
  ON referral_codes FOR SELECT
  USING (clinic_id = get_user_clinic_id());

DROP POLICY IF EXISTS "referral_events_clinic_select" ON referral_events;
CREATE POLICY "referral_events_clinic_select"
  ON referral_events FOR SELECT
  USING (referrer_clinic_id = get_user_clinic_id());

DROP POLICY IF EXISTS "referral_credits_clinic_select" ON referral_credits;
CREATE POLICY "referral_credits_clinic_select"
  ON referral_credits FOR SELECT
  USING (beneficiary_clinic_id = get_user_clinic_id());

-- ── ai_traces (was 00178) ──────────────────────────────────────────────────
-- Read: own clinic (JWT-derived) or platform super-admin.
DROP POLICY IF EXISTS ai_traces_clinic_read ON public.ai_traces;
CREATE POLICY ai_traces_clinic_read
  ON public.ai_traces FOR SELECT
  USING (
    clinic_id = get_user_clinic_id()
    OR is_super_admin()
  );

-- Write: service role only. The previous `WITH CHECK (true)` had no role
-- restriction, so anon/authenticated callers could insert arbitrary trace
-- rows (cost-metric poisoning / log spam). service_role bypasses RLS, so
-- scoping the policy TO service_role denies all user-scoped inserts while
-- leaving the legitimate service-role writer unaffected.
DROP POLICY IF EXISTS ai_traces_insert_service ON public.ai_traces;
CREATE POLICY ai_traces_insert_service
  ON public.ai_traces FOR INSERT TO service_role
  WITH CHECK (true);

-- ── upload_policies (was 00170) ────────────────────────────────────────────
-- SELECT was header-only; bind to the JWT clinic. Writes already required an
-- admin users row, but compared users.id = auth.uid() (wrong column) so the
-- EXISTS never matched — clinic admins could not manage their own policies via
-- an authenticated session. Rebuild all four policies on get_user_clinic_id()
-- and the correct users.auth_id = auth.uid() join.
DROP POLICY IF EXISTS "upload_policies_select_own_clinic" ON upload_policies;
CREATE POLICY "upload_policies_select_own_clinic"
  ON upload_policies FOR SELECT TO authenticated
  USING (clinic_id = get_user_clinic_id());

DROP POLICY IF EXISTS "upload_policies_insert_clinic_admin" ON upload_policies;
CREATE POLICY "upload_policies_insert_clinic_admin"
  ON upload_policies FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
        AND users.clinic_id = get_user_clinic_id()
        AND users.role IN ('clinic_admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "upload_policies_update_clinic_admin" ON upload_policies;
CREATE POLICY "upload_policies_update_clinic_admin"
  ON upload_policies FOR UPDATE TO authenticated
  USING (
    clinic_id = get_user_clinic_id()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
        AND users.clinic_id = get_user_clinic_id()
        AND users.role IN ('clinic_admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "upload_policies_delete_clinic_admin" ON upload_policies;
CREATE POLICY "upload_policies_delete_clinic_admin"
  ON upload_policies FOR DELETE TO authenticated
  USING (
    clinic_id = get_user_clinic_id()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
        AND users.clinic_id = get_user_clinic_id()
        AND users.role IN ('clinic_admin', 'super_admin')
    )
  );
