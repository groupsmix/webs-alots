-- ============================================================
-- Migration 00147: Schedule pg_cron job for appointment reminders
--
-- Creates a cron job that fires every 15 minutes and calls the
-- `send-appointment-reminders` Supabase Edge Function via pg_net.
--
-- The Edge Function URL and service role key are stored in Supabase Vault
-- (not hardcoded here). Before running this migration, add the secrets:
--
--   supabase secrets set --env-file .env.local
--
--   Or via the Supabase Dashboard → Settings → Vault:
--     Name: edge_function_url
--     Value: https://<project-ref>.supabase.co/functions/v1
--
--     Name: service_role_key
--     Value: <your-service-role-key>
--
-- IDEMPOTENCY: The cron.schedule call is wrapped so that re-running this
-- migration (e.g., after `supabase db reset`) does not fail if the job
-- already exists.
-- ============================================================

-- Enable required extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the reminder job (idempotent wrapper)
DO $$
BEGIN
  -- Remove any existing job with this name before re-creating, so that
  -- `supabase db reset` does not duplicate the schedule.
  PERFORM cron.unschedule('appointment-reminders');
EXCEPTION
  WHEN OTHERS THEN
    -- Job did not exist yet — continue normally.
    NULL;
END
$$;

SELECT cron.schedule(
  'appointment-reminders',
  '*/15 * * * *',
  $$
    SELECT net.http_post(
      url     := (
        SELECT decrypted_secret
        FROM   vault.decrypted_secrets
        WHERE  name = 'edge_function_url'
      ) || '/send-appointment-reminders',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret
          FROM   vault.decrypted_secrets
          WHERE  name = 'service_role_key'
        )
      ),
      body    := '{}'::jsonb
    );
  $$
);
