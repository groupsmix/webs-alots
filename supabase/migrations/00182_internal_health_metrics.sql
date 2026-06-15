-- Internal health metrics RPC for /api/health/internal.
--
-- Exposes safe operational metadata to the service_role only:
--   - PostgreSQL version
--   - Current / active / idle / waiting connection counts
--   - max_connections and utilization percentage
--
-- This lets the internal health endpoint surface pool pressure and Postgres
-- version changes without granting broad catalog access to anon/authenticated.

CREATE OR REPLACE FUNCTION internal_health_metrics()
RETURNS TABLE (
  postgres_version TEXT,
  postgres_version_major INTEGER,
  max_connections INTEGER,
  current_connections INTEGER,
  active_connections INTEGER,
  idle_connections INTEGER,
  waiting_connections INTEGER,
  pool_utilization_pct NUMERIC(5,2)
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  WITH settings AS (
    SELECT
      current_setting('server_version') AS postgres_version,
      split_part(current_setting('server_version'), '.', 1)::INTEGER AS postgres_version_major,
      COALESCE(NULLIF(current_setting('max_connections', true), ''), '0')::INTEGER AS max_connections
  ),
  activity AS (
    SELECT
      COUNT(*) FILTER (WHERE datname = current_database())::INTEGER AS current_connections,
      COUNT(*) FILTER (
        WHERE datname = current_database()
          AND state = 'active'
      )::INTEGER AS active_connections,
      COUNT(*) FILTER (
        WHERE datname = current_database()
          AND state = 'idle'
      )::INTEGER AS idle_connections,
      COUNT(*) FILTER (
        WHERE datname = current_database()
          AND state = 'active'
          AND wait_event_type IS NOT NULL
      )::INTEGER AS waiting_connections
    FROM pg_stat_activity
  )
  SELECT
    settings.postgres_version,
    settings.postgres_version_major,
    settings.max_connections,
    activity.current_connections,
    activity.active_connections,
    activity.idle_connections,
    activity.waiting_connections,
    CASE
      WHEN settings.max_connections > 0
        THEN ROUND((activity.current_connections::NUMERIC / settings.max_connections::NUMERIC) * 100, 2)
      ELSE NULL
    END AS pool_utilization_pct
  FROM settings
  CROSS JOIN activity;
$$;

COMMENT ON FUNCTION internal_health_metrics() IS
  'Internal-only operational health metrics for /api/health/internal. Returns Postgres version and connection pressure counters. service_role only.';

REVOKE ALL ON FUNCTION internal_health_metrics() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION internal_health_metrics() TO service_role;
