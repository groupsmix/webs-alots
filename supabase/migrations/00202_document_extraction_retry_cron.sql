-- ============================================================================
-- 00202: Re-drive stuck / failed medical-document extractions (BUGFIX)
-- ============================================================================
--
-- The parse-medical-document edge function is invoked by a database webhook
-- on INSERT into patient_files. On a transient error it sets
-- extraction_status back to 'pending' (until extraction_retry_count reaches
-- MAX_RETRIES = 3, after which it becomes the terminal 'failed'). 00165 even
-- added a partial index "for the background worker" — but no worker existed,
-- so a 'pending' row was never re-processed and the file stayed stuck forever.
--
-- This migration supplies that missing worker: a pg_cron job that every
-- 5 minutes re-posts the webhook-shaped payload to the edge function for a
-- bounded batch of rows still awaiting a (re)try. The edge function
-- immediately flips the row to 'processing', so the next tick will not pick
-- it up again; a genuinely transient failure resets it to 'pending' and it is
-- retried on a later tick until it succeeds or exhausts its retry budget.
--
-- Reuses the same Vault secrets as the reminder cron (00147):
--   edge_function_url   e.g. https://<project-ref>.supabase.co/functions/v1
--   service_role_key    the service-role JWT (webhook auth)
--
-- Idempotent: safe to re-run and safe under `supabase db reset`.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── Worker function ─────────────────────────────────────────────────────────
-- SECURITY DEFINER + empty search_path with fully-qualified names, matching
-- the hardening convention in 00066. Bounded batch keeps each tick cheap and
-- avoids flooding the edge function / Anthropic when a backlog builds up.
CREATE OR REPLACE FUNCTION public.retry_pending_document_extractions(p_batch_size INT DEFAULT 25)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_url        TEXT;
  v_key        TEXT;
  v_row        RECORD;
  v_count      INT := 0;
BEGIN
  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'edge_function_url';

  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'service_role_key';

  -- Without configured secrets there is nothing we can call; bail out quietly
  -- rather than raising every 5 minutes.
  IF v_url IS NULL OR v_key IS NULL THEN
    RETURN 0;
  END IF;

  FOR v_row IN
    SELECT id, clinic_id, patient_id, r2_key, file_type, extraction_retry_count
    FROM   public.patient_files
    WHERE  extraction_status = 'pending'
      AND  COALESCE(extraction_retry_count, 0) < 3
    ORDER  BY created_at
    LIMIT  p_batch_size FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM net.http_post(
      url     := v_url || '/parse-medical-document',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body    := jsonb_build_object(
        'type',   'RETRY',
        'record', jsonb_build_object(
          'id',                     v_row.id,
          'clinic_id',              v_row.clinic_id,
          'patient_id',             v_row.patient_id,
          'r2_key',                 v_row.r2_key,
          'file_type',              v_row.file_type,
          'extraction_retry_count', COALESCE(v_row.extraction_retry_count, 0)
        )
      )
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Only the service role / cron owner should be able to trigger a re-drive.
REVOKE ALL ON FUNCTION public.retry_pending_document_extractions(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.retry_pending_document_extractions(INT) FROM anon;
REVOKE ALL ON FUNCTION public.retry_pending_document_extractions(INT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.retry_pending_document_extractions(INT) TO service_role;

-- ── Schedule (idempotent wrapper, mirrors 00147) ────────────────────────────
DO $$
BEGIN
  PERFORM cron.unschedule('retry-document-extractions');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END
$$;

SELECT cron.schedule(
  'retry-document-extractions',
  '*/5 * * * *',
  $$ SELECT public.retry_pending_document_extractions(); $$
);
