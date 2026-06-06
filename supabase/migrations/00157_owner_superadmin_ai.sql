-- Owner Super Admin AI layer: clinic health, onboarding automation, team support AI.
-- Conflict-aware: extends existing support_tickets instead of recreating it.

-- ── Clinic health scores ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clinic_health_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  score smallint NOT NULL CHECK (score BETWEEN 0 AND 100),
  grade char(1) CHECK (grade IN ('A','B','C','D','F')),
  churn_risk text CHECK (churn_risk IN ('low','medium','high','critical')),
  trend text CHECK (trend IN ('improving','stable','declining')),
  top_risk_signal text,
  top_strength_signal text,
  signals_snapshot jsonb,
  computed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_health_scores_churn
  ON clinic_health_scores(churn_risk, score);

CREATE INDEX IF NOT EXISTS idx_health_scores_clinic
  ON clinic_health_scores(clinic_id, computed_at DESC);

ALTER TABLE clinic_health_scores ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'clinic_health_scores'
      AND policyname = 'clinic_health_scores_super_admin_all'
  ) THEN
    CREATE POLICY clinic_health_scores_super_admin_all
      ON clinic_health_scores
      FOR ALL
      USING (is_super_admin())
      WITH CHECK (is_super_admin());
  END IF;
END
$$;

-- ── Platform alerts ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS platform_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES clinics(id) ON DELETE CASCADE,
  alert_type text NOT NULL,
  message text NOT NULL,
  severity text CHECK (severity IN ('info','warning','critical')),
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, alert_type)
);

CREATE INDEX IF NOT EXISTS idx_platform_alerts_unread
  ON platform_alerts(is_read, severity, created_at DESC)
  WHERE is_read = false;

ALTER TABLE platform_alerts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'platform_alerts'
      AND policyname = 'platform_alerts_super_admin_all'
  ) THEN
    CREATE POLICY platform_alerts_super_admin_all
      ON platform_alerts
      FOR ALL
      USING (is_super_admin())
      WITH CHECK (is_super_admin());
  END IF;
END
$$;

-- ── Clinic onboarding state ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clinic_onboardings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES clinics(id) ON DELETE SET NULL,
  clinic_name text NOT NULL,
  specialty text,
  contact_name text,
  contact_phone text,
  contact_email text,
  current_step text NOT NULL DEFAULT 'clinic_info',
  completed_steps text[] NOT NULL DEFAULT '{}',
  step_entered_at timestamptz NOT NULL DEFAULT now(),
  extracted_legal_data jsonb,
  legal_doc_uploaded boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('pending','in_progress','completed','abandoned')),
  nudge_count smallint NOT NULL DEFAULT 0,
  last_nudge_at timestamptz,
  completion_percentage smallint NOT NULL DEFAULT 0 CHECK (completion_percentage BETWEEN 0 AND 100),
  go_live_message text,
  assigned_account_manager uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboardings_status
  ON clinic_onboardings(status, step_entered_at);

CREATE INDEX IF NOT EXISTS idx_onboardings_clinic
  ON clinic_onboardings(clinic_id);

CREATE INDEX IF NOT EXISTS idx_onboarding_step_time
  ON clinic_onboardings(current_step, step_entered_at);

ALTER TABLE clinic_onboardings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'clinic_onboardings'
      AND policyname = 'clinic_onboardings_super_admin_all'
  ) THEN
    CREATE POLICY clinic_onboardings_super_admin_all
      ON clinic_onboardings
      FOR ALL
      USING (is_super_admin())
      WITH CHECK (is_super_admin());
  END IF;
END
$$;

-- ── Internal team tables ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('support_tech','account_manager','developer','billing','super_admin')),
  is_available boolean NOT NULL DEFAULT true,
  current_ticket_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_members_role_available
  ON team_members(role, is_available, current_ticket_count);

CREATE TABLE IF NOT EXISTS team_briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id uuid REFERENCES team_members(id) ON DELETE CASCADE,
  briefing_date date NOT NULL,
  content text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_member_id, briefing_date)
);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_briefings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'team_members'
      AND policyname = 'team_members_own_or_super_admin'
  ) THEN
    CREATE POLICY team_members_own_or_super_admin
      ON team_members
      FOR ALL
      USING (user_id = auth.uid() OR is_super_admin())
      WITH CHECK (user_id = auth.uid() OR is_super_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'team_briefings'
      AND policyname = 'team_briefings_own_or_super_admin'
  ) THEN
    CREATE POLICY team_briefings_own_or_super_admin
      ON team_briefings
      FOR ALL
      USING (
        is_super_admin()
        OR team_member_id IN (SELECT id FROM team_members WHERE user_id = auth.uid())
      )
      WITH CHECK (
        is_super_admin()
        OR team_member_id IN (SELECT id FROM team_members WHERE user_id = auth.uid())
      );
  END IF;
END
$$;

-- ── Existing support ticket AI columns ──────────────────────────────────────

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS sentiment text CHECK (sentiment IN ('frustrated','neutral','satisfied')),
  ADD COLUMN IF NOT EXISTS ai_draft_response text,
  ADD COLUMN IF NOT EXISTS triaged_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_priority text CHECK (ai_priority IN ('critical','high','medium','low')),
  ADD COLUMN IF NOT EXISTS ai_category text,
  ADD COLUMN IF NOT EXISTS assigned_team_member_id uuid REFERENCES team_members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_priority
  ON support_tickets(priority, status, created_at);

CREATE INDEX IF NOT EXISTS idx_tickets_assigned_team
  ON support_tickets(assigned_team_member_id, status);

-- ── Signal extraction function (aggregate/no PHI) ───────────────────────────

CREATE OR REPLACE FUNCTION get_all_clinic_signals()
RETURNS TABLE (
  "clinicId" uuid,
  "clinicName" text,
  "loginFrequency" numeric,
  "appointmentBookingRate" numeric,
  "noShowRate" numeric,
  "featureAdoption" numeric,
  "paymentHealthy" boolean,
  "negativeSupportRate" numeric,
  "lastLoginDaysAgo" integer,
  "totalAppointments7d" bigint,
  "planTier" text
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.name,
    LEAST(
      1,
      COALESCE((
        SELECT COUNT(*)::numeric / 7
        FROM auth.sessions s
        JOIN users u ON u.auth_id = s.user_id
        WHERE u.clinic_id = c.id
          AND s.created_at > now() - interval '7 days'
      ), 0)
    ) AS login_frequency,
    COALESCE((
      SELECT COUNT(*) FILTER (WHERE a.status IN ('confirmed','completed'))::numeric
        / NULLIF(COUNT(*)::numeric, 0)
      FROM appointments a
      WHERE a.clinic_id = c.id
        AND a.slot_start > now() - interval '7 days'
    ), 0) AS appointment_booking_rate,
    COALESCE((
      SELECT COUNT(*) FILTER (WHERE a.status = 'no_show')::numeric
        / NULLIF(COUNT(*)::numeric, 0)
      FROM appointments a
      WHERE a.clinic_id = c.id
        AND a.slot_start > now() - interval '7 days'
    ), 0) AS no_show_rate,
    LEAST(
      1,
      COALESCE((
        SELECT COUNT(DISTINCT feature_key)::numeric / 6
        FROM ai_usage_logs l
        WHERE l.created_at > now() - interval '30 days'
          AND l.feature_key IS NOT NULL
      ), 0)
    ) AS feature_adoption,
    (c.status = 'active' AND c.is_active = true) AS payment_healthy,
    COALESCE((
      SELECT COUNT(*) FILTER (WHERE st.priority IN ('urgent','high') OR st.sentiment = 'frustrated')::numeric
        / NULLIF(COUNT(*)::numeric, 0)
      FROM support_tickets st
      WHERE st.clinic_id = c.id
        AND st.created_at > now() - interval '30 days'
    ), 0) AS negative_support_rate,
    COALESCE((
      SELECT EXTRACT(DAY FROM now() - MAX(s.created_at))::integer
      FROM auth.sessions s
      JOIN users u ON u.auth_id = s.user_id
      WHERE u.clinic_id = c.id
    ), 999) AS last_login_days_ago,
    COALESCE((
      SELECT COUNT(*)
      FROM appointments a
      WHERE a.clinic_id = c.id
        AND a.slot_start > now() - interval '7 days'
    ), 0) AS total_appointments_7d,
    c.tier
  FROM clinics c
  WHERE c.is_active = true;
END;
$$;

REVOKE ALL ON FUNCTION get_all_clinic_signals() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_all_clinic_signals() TO service_role;
GRANT EXECUTE ON FUNCTION get_all_clinic_signals() TO authenticated;

-- ── Safe SQL execution for Super Admin natural-language queries ─────────────

CREATE OR REPLACE FUNCTION execute_admin_query(p_sql text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result jsonb;
  trimmed text;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  trimmed := trim(p_sql);

  IF trimmed !~* '^SELECT\s' THEN
    RAISE EXCEPTION 'Only SELECT queries allowed';
  END IF;

  IF trimmed ~* '\b(DELETE|UPDATE|INSERT|DROP|TRUNCATE|ALTER|CREATE|EXEC|COPY|GRANT|REVOKE)\b' THEN
    RAISE EXCEPTION 'Dangerous keyword detected';
  END IF;

  IF trimmed !~* '\bLIMIT\s+([1-4]?[0-9]|50)\b' THEN
    trimmed := trimmed || ' LIMIT 50';
  END IF;

  EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || trimmed || ') t' INTO result;
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION execute_admin_query(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION execute_admin_query(text) TO authenticated;
