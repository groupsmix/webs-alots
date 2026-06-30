-- Fix and harden public.execute_admin_query(text) (originally added in 00157).
--
-- Problems addressed:
--   1. FUNCTIONAL BREAK: the guard `trimmed !~* '^SELECT\s'` rejected any query
--      that begins with a CTE (`WITH ...`). Two of the five approved Super-Admin
--      analytics templates (top_at_risk_clinics, best_performing_clinics in
--      src/lib/ai/owner-analytics.ts) and the inline top_at_risk_clinics query
--      in src/lib/ai/tools.ts all start with `WITH latest_scores AS (...)`, so
--      they always failed with "Only SELECT queries allowed". We now accept both
--      `SELECT` and `WITH` as read-only entry points.
--   2. LIMIT-append bug: `\bLIMIT\s+([1-4]?[0-9]|50)\b` only recognised limits
--      1-50, so a query with `LIMIT 100` would not match and the function would
--      append " LIMIT 50", producing the invalid `... LIMIT 100 LIMIT 50`. The
--      detection now matches any `LIMIT <n>` and only appends when absent.
--   3. Missing search_path: the function is SECURITY DEFINER but was never given
--      a pinned search_path (see 00066 / 00197). Baked into the definition here.
--   4. Defense-in-depth: explicitly reject statement batching (`;`). The subquery
--      wrapping already prevents multi-statement execution, but rejecting `;`
--      up-front makes the intent explicit and avoids surprising parse errors.
--
-- Security model is unchanged: SECURITY DEFINER + an internal is_super_admin()
-- gate, executable only by `authenticated` (the Super-Admin API route calls it
-- with a user-scoped client) and never PUBLIC/anon. The data-modifying keyword
-- blocklist still applies anywhere in the statement, so a data-modifying CTE
-- (e.g. `WITH x AS (DELETE ...)`) is still rejected.

CREATE OR REPLACE FUNCTION public.execute_admin_query(p_sql text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  result  jsonb;
  trimmed text;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- Normalise: drop surrounding whitespace and any trailing semicolons.
  trimmed := regexp_replace(trim(p_sql), ';+\s*$', '');

  -- Only read-only entry points: a bare SELECT or a CTE (WITH ...).
  IF trimmed !~* '^(SELECT|WITH)\s' THEN
    RAISE EXCEPTION 'Only read-only SELECT/WITH queries are allowed';
  END IF;

  -- Block any data-modifying / DDL keyword, including inside CTEs.
  IF trimmed ~* '\b(DELETE|UPDATE|INSERT|MERGE|UPSERT|DROP|TRUNCATE|ALTER|CREATE|EXEC|EXECUTE|CALL|COPY|GRANT|REVOKE|VACUUM|REINDEX|REFRESH)\b' THEN
    RAISE EXCEPTION 'Dangerous keyword detected';
  END IF;

  -- Reject statement batching outright (defense-in-depth on top of the
  -- subquery wrapping below).
  IF position(';' in trimmed) > 0 THEN
    RAISE EXCEPTION 'Multiple statements are not allowed';
  END IF;

  -- Cap result size: only append a default LIMIT when the query has none.
  IF trimmed !~* '\bLIMIT\s+\d+' THEN
    trimmed := trimmed || ' LIMIT 50';
  END IF;

  EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || trimmed || ') t' INTO result;
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- Re-assert the intended grants (matches 00157 / 00185): authenticated only.
REVOKE ALL     ON FUNCTION public.execute_admin_query(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.execute_admin_query(text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.execute_admin_query(text) TO authenticated;
