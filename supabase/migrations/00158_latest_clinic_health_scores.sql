-- Latest clinic health helper for Super Admin analytics.
-- Returns the most recent health score row per clinic, with optional clinic filter.

CREATE OR REPLACE FUNCTION get_latest_clinic_health_scores(p_clinic_id uuid DEFAULT NULL)
RETURNS TABLE (
  clinic_id uuid,
  score smallint,
  grade char(1),
  churn_risk text,
  trend text,
  top_risk_signal text,
  top_strength_signal text,
  signals_snapshot jsonb,
  computed_at timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT DISTINCT ON (chs.clinic_id)
    chs.clinic_id,
    chs.score,
    chs.grade,
    chs.churn_risk,
    chs.trend,
    chs.top_risk_signal,
    chs.top_strength_signal,
    chs.signals_snapshot,
    chs.computed_at
  FROM clinic_health_scores chs
  JOIN clinics c ON c.id = chs.clinic_id
  WHERE c.deleted_at IS NULL
    AND (p_clinic_id IS NULL OR chs.clinic_id = p_clinic_id)
  ORDER BY chs.clinic_id, chs.computed_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION get_latest_clinic_health_scores(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_latest_clinic_health_scores(uuid) TO authenticated;
