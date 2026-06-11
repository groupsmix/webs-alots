-- 00180_clinic_dashboard_stats_rpc.sql
-- PERF-LAT-06: Single-round-trip dashboard aggregates.
--
-- The admin dashboard (getDashboardStats in src/lib/data/dashboard.ts)
-- previously issued 9 PostgREST queries per render: five head-only counts
-- plus THREE unbounded row fetches — every completed payment row (to sum
-- revenue in JS), every review row (to average stars in JS) and every
-- patient row with metadata (to count insurance flags in JS). For a mature
-- clinic that is thousands of rows over the wire to produce eight numbers.
--
-- This function computes all eight aggregates in one database call.
--
-- Security:
--   * SECURITY INVOKER (the default) is used deliberately. RLS policies on
--     users / appointments / payments / reviews apply to the caller exactly
--     as they did for the individual PostgREST queries this replaces, so
--     the function cannot widen data access or leak cross-tenant rows.
--   * EXECUTE is revoked from PUBLIC and anon; dashboard stats are for
--     signed-in staff only. (Even if invoked by anon, RLS would return
--     zeros — the revoke is defense in depth.)
--
-- The application falls back to the legacy multi-query path when this
-- function does not exist yet, so deploying code before this migration is
-- safe (same pattern as avg_clinic_rating).

CREATE OR REPLACE FUNCTION public.get_clinic_dashboard_stats(cid uuid)
RETURNS TABLE (
  total_patients         bigint,
  total_appointments     bigint,
  completed_appointments bigint,
  no_show_count          bigint,
  total_revenue          numeric,
  average_rating         numeric,
  doctor_count           bigint,
  insurance_patients     bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    (SELECT count(*) FROM users
       WHERE clinic_id = cid AND role = 'patient')                  AS total_patients,
    (SELECT count(*) FROM appointments
       WHERE clinic_id = cid)                                       AS total_appointments,
    (SELECT count(*) FROM appointments
       WHERE clinic_id = cid AND status = 'completed')              AS completed_appointments,
    (SELECT count(*) FROM appointments
       WHERE clinic_id = cid AND status = 'no_show')                AS no_show_count,
    (SELECT COALESCE(sum(amount), 0) FROM payments
       WHERE clinic_id = cid AND status = 'completed')              AS total_revenue,
    (SELECT COALESCE(avg(stars), 0) FROM reviews
       WHERE clinic_id = cid)                                       AS average_rating,
    (SELECT count(*) FROM users
       WHERE clinic_id = cid AND role = 'doctor')                   AS doctor_count,
    -- Matches the JS truthy check `metadata?.insurance`: both a JSON
    -- boolean true and the string "true" serialize to 'true' via ->>.
    -- The ->> operator never throws on other value types, unlike a
    -- ::boolean cast.
    (SELECT count(*) FROM users
       WHERE clinic_id = cid AND role = 'patient'
         AND metadata->>'insurance' = 'true')                       AS insurance_patients;
$$;

REVOKE EXECUTE ON FUNCTION public.get_clinic_dashboard_stats(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_clinic_dashboard_stats(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_clinic_dashboard_stats(uuid) TO authenticated;
