-- HIGH-1: Fix RLS policies on ai_usage and cmi_callbacks_seen.
--
-- Migrations 00083 and 00084 incorrectly referenced the non-existent
-- session variable 'app.clinic_id'.  The codebase consistently uses
-- 'app.current_clinic_id' (set by set_tenant_context()) and the
-- per-request header read by get_request_clinic_id().  Using the wrong
-- variable name caused the USING clause to always evaluate to NULL,
-- silently rejecting every row under RLS.
--
-- Effects before this fix:
--   - AI cost-cap SELECT returns NULL → cap never triggers → unbounded LLM spend.
--   - ai_usage UPSERT fails silently → no usage tracking.
--   - cmi_callbacks_seen INSERT fails under RLS → replay protection is dead code.
--
-- This migration replaces both policies to use get_request_clinic_id()
-- (which checks the x-clinic-id header first, then falls back to the
-- app.current_clinic_id session variable) and adds WITH CHECK clauses
-- so INSERT/UPDATE are also properly constrained.

-- ── ai_usage ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS ai_usage_tenant_isolation ON ai_usage;

CREATE POLICY ai_usage_tenant_isolation ON ai_usage
  FOR ALL
  USING (
    clinic_id = get_user_clinic_id()
    OR clinic_id = get_request_clinic_id()
  )
  WITH CHECK (
    clinic_id = get_user_clinic_id()
    OR clinic_id = get_request_clinic_id()
  );

-- ── cmi_callbacks_seen ──────────────────────────────────────────────

DROP POLICY IF EXISTS cmi_callbacks_tenant_isolation ON cmi_callbacks_seen;

CREATE POLICY cmi_callbacks_tenant_isolation ON cmi_callbacks_seen
  FOR ALL
  USING (
    clinic_id = get_user_clinic_id()
    OR clinic_id = get_request_clinic_id()
  )
  WITH CHECK (
    clinic_id = get_user_clinic_id()
    OR clinic_id = get_request_clinic_id()
  );
