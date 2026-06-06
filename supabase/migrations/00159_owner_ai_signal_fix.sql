-- Owner AI follow-up fixes
-- 1. Ensure clinic health feature adoption is scoped per clinic

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
        SELECT COUNT(DISTINCT l.feature_key)::numeric / 6
        FROM ai_usage_logs l
        JOIN users u2 ON u2.id = l.user_id
        WHERE u2.clinic_id = c.id
          AND l.created_at > now() - interval '30 days'
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
