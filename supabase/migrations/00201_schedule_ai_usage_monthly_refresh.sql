-- ============================================================
-- Migration 00201: Schedule the ai_usage_monthly refresh job
--
-- 00139 created the `ai_usage_monthly` MATERIALIZED VIEW and the
-- `refresh_ai_usage_monthly()` function but only documented the cron schedule
-- as a manual, out-of-band step. Without a registered job the materialized
-- view goes stale, so budget-cap reads (checkClinicAIBudget) drift from the
-- live billing_events. This migration registers the hourly refresh.
--
-- Runs the SECURITY DEFINER refresh function directly (no HTTP needed):
--   REFRESH MATERIALIZED VIEW CONCURRENTLY ai_usage_monthly;
--
-- IDEMPOTENCY: the cron.schedule call is wrapped so that re-running this
-- migration (e.g., after `supabase db reset`) does not fail or duplicate the
-- job. Guarded so it degrades gracefully where pg_cron is unavailable.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove any existing job with this name first (avoids duplicates on reset).
DO $$
BEGIN
  IF to_regprocedure('cron.unschedule(text)') IS NOT NULL THEN
    BEGIN
      PERFORM cron.unschedule('refresh-ai-usage-monthly');
    EXCEPTION
      WHEN OTHERS THEN
        NULL; -- job did not exist yet
    END;
  END IF;
END
$$;

-- Schedule the hourly refresh.
DO $$
BEGIN
  IF to_regprocedure('cron.schedule(text, text, text)') IS NOT NULL THEN
    PERFORM cron.schedule(
      'refresh-ai-usage-monthly',
      '0 * * * *',
      $cron$ SELECT public.refresh_ai_usage_monthly(); $cron$
    );
    RAISE NOTICE '00201: scheduled refresh-ai-usage-monthly (hourly)';
  ELSE
    RAISE NOTICE '00201: pg_cron not available; skipping refresh-ai-usage-monthly schedule';
  END IF;
END
$$;
