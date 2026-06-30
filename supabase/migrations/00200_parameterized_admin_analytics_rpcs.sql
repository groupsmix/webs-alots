-- Replace the general-purpose raw-SQL primitive execute_admin_query(text)
-- (00157, hardened in 00198) with dedicated, typed, parameterized RPCs — one
-- per approved Super-Admin analytics query.
--
-- Why:
--   execute_admin_query accepted an arbitrary SELECT/WITH string, ran it as the
--   definer (RLS-bypassing), and relied on a keyword *blocklist* for safety.
--   Blocklist-based SQL gating is inherently fragile, and a raw-SQL primitive
--   granted to `authenticated` is a broad, AI-reachable surface. The app only
--   ever needs five fixed shapes (see src/lib/ai/owner-analytics.ts), so we
--   express each as a typed function with real parameters (limit, clinic_id).
--   This removes string interpolation of clinic_id, eliminates the
--   SELECT-vs-WITH parsing entirely, and shrinks the attack surface to five
--   audited statements.
--
-- Each function:
--   * is SECURITY DEFINER with a pinned search_path (intra-tenant RLS bypass is
--     intentional — these are platform-wide aggregates for super admins),
--   * is gated by is_super_admin() (raises 'Forbidden' otherwise),
--   * clamps the row limit to [1, 50] internally,
--   * returns a jsonb array (same shape the app already consumes),
--   * is executable by `authenticated` only (never PUBLIC/anon). The Super-Admin
--     API route calls them with a user-scoped client; the is_super_admin() gate
--     is the authorization boundary.
--
-- Supersedes execute_admin_query(text), which is dropped at the end.

-- ── 1. Top at-risk clinics (lowest recent health score) ─────────────────────
CREATE OR REPLACE FUNCTION public.admin_top_at_risk_clinics(
  p_limit     integer DEFAULT 10,
  p_clinic_id uuid    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit  integer := LEAST(GREATEST(COALESCE(p_limit, 10), 1), 50);
  v_result jsonb;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  WITH latest_scores AS (
    SELECT DISTINCT ON (clinic_id)
      clinic_id, score, grade, churn_risk, trend, top_risk_signal, computed_at
    FROM clinic_health_scores
    ORDER BY clinic_id, computed_at DESC
  )
  SELECT jsonb_agg(row_to_json(t)) INTO v_result
  FROM (
    SELECT
      c.id, c.name, c.tier, c.status,
      ls.score, ls.grade, ls.churn_risk, ls.trend, ls.top_risk_signal, ls.computed_at
    FROM latest_scores ls
    JOIN clinics c ON c.id = ls.clinic_id
    WHERE c.deleted_at IS NULL
      AND (p_clinic_id IS NULL OR c.id = p_clinic_id)
    ORDER BY ls.score ASC, ls.computed_at DESC
    LIMIT v_limit
  ) t;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- ── 2. Best performing clinics (highest recent health score) ────────────────
CREATE OR REPLACE FUNCTION public.admin_best_performing_clinics(
  p_limit     integer DEFAULT 10,
  p_clinic_id uuid    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit  integer := LEAST(GREATEST(COALESCE(p_limit, 10), 1), 50);
  v_result jsonb;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  WITH latest_scores AS (
    SELECT DISTINCT ON (clinic_id)
      clinic_id, score, grade, churn_risk, trend, top_strength_signal, computed_at
    FROM clinic_health_scores
    ORDER BY clinic_id, computed_at DESC
  )
  SELECT jsonb_agg(row_to_json(t)) INTO v_result
  FROM (
    SELECT
      c.id, c.name, c.tier, c.status,
      ls.score, ls.grade, ls.churn_risk, ls.trend, ls.top_strength_signal, ls.computed_at
    FROM latest_scores ls
    JOIN clinics c ON c.id = ls.clinic_id
    WHERE c.deleted_at IS NULL
      AND (p_clinic_id IS NULL OR c.id = p_clinic_id)
    ORDER BY ls.score DESC, ls.computed_at DESC
    LIMIT v_limit
  ) t;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- ── 3. Stalled onboardings (>3 days in current step) ────────────────────────
CREATE OR REPLACE FUNCTION public.admin_stalled_onboardings(
  p_limit     integer DEFAULT 10,
  p_clinic_id uuid    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit  integer := LEAST(GREATEST(COALESCE(p_limit, 10), 1), 50);
  v_result jsonb;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT jsonb_agg(row_to_json(t)) INTO v_result
  FROM (
    SELECT
      co.id, co.clinic_id, co.clinic_name, co.specialty, co.status,
      co.current_step, co.completion_percentage, co.nudge_count,
      co.step_entered_at, co.last_nudge_at
    FROM clinic_onboardings co
    WHERE co.status IN ('pending', 'in_progress')
      AND co.step_entered_at < now() - interval '3 days'
      AND (p_clinic_id IS NULL OR co.clinic_id = p_clinic_id)
    ORDER BY co.step_entered_at ASC
    LIMIT v_limit
  ) t;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- ── 4. Critical unread platform alerts ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_critical_platform_alerts(
  p_limit     integer DEFAULT 10,
  p_clinic_id uuid    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit  integer := LEAST(GREATEST(COALESCE(p_limit, 10), 1), 50);
  v_result jsonb;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT jsonb_agg(row_to_json(t)) INTO v_result
  FROM (
    SELECT
      pa.id, pa.clinic_id, c.name AS clinic_name,
      pa.alert_type, pa.severity, pa.created_at
    FROM platform_alerts pa
    LEFT JOIN clinics c ON c.id = pa.clinic_id
    WHERE pa.is_read = false
      AND pa.severity = 'critical'
      AND (p_clinic_id IS NULL OR pa.clinic_id = p_clinic_id)
    ORDER BY pa.created_at DESC
    LIMIT v_limit
  ) t;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- ── 5. Support backlog by internal team member ──────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_support_backlog(
  p_limit integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit  integer := LEAST(GREATEST(COALESCE(p_limit, 10), 1), 50);
  v_result jsonb;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT jsonb_agg(row_to_json(t)) INTO v_result
  FROM (
    SELECT
      tm.id AS team_member_id, tm.name, tm.role, tm.is_available,
      tm.current_ticket_count,
      COUNT(st.id) FILTER (WHERE st.status IN ('open', 'in_progress')) AS open_tickets,
      COUNT(st.id) FILTER (WHERE st.ai_priority IN ('critical', 'high'))  AS urgent_ai_tickets
    FROM team_members tm
    LEFT JOIN support_tickets st ON st.assigned_team_member_id = tm.id
    GROUP BY tm.id, tm.name, tm.role, tm.is_available, tm.current_ticket_count
    ORDER BY open_tickets DESC, tm.current_ticket_count DESC, tm.name ASC
    LIMIT v_limit
  ) t;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- ── Grants: authenticated only (super-admin gate is inside each function) ────
DO $$
DECLARE
  fn text;
  sigs text[] := ARRAY[
    'public.admin_top_at_risk_clinics(integer, uuid)',
    'public.admin_best_performing_clinics(integer, uuid)',
    'public.admin_stalled_onboardings(integer, uuid)',
    'public.admin_critical_platform_alerts(integer, uuid)',
    'public.admin_support_backlog(integer)'
  ];
BEGIN
  FOREACH fn IN ARRAY sigs LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END
$$;

-- ── Drop the superseded raw-SQL primitive ───────────────────────────────────
-- No application code references execute_admin_query after this migration
-- (src/lib/ai/owner-analytics.ts, clinics-query route, and tools.ts now call
-- the typed RPCs above).
DROP FUNCTION IF EXISTS public.execute_admin_query(text);
