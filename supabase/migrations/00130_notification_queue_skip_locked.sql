-- Q-21: Atomic queue claim using FOR UPDATE SKIP LOCKED
-- Prevents duplicate delivery when concurrent cron instances race on the same rows.
-- The previous select-then-update pattern could claim the same rows twice.

CREATE OR REPLACE FUNCTION claim_notification_batch(batch_limit INT DEFAULT 50)
RETURNS SETOF notification_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT id
    FROM notification_queue
    WHERE status IN ('pending', 'failed')
      AND next_retry_at <= now()
    ORDER BY next_retry_at ASC
    LIMIT batch_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE notification_queue nq
  SET status = 'processing',
      updated_at = now()
  FROM claimed
  WHERE nq.id = claimed.id
  RETURNING nq.*;
END;
$$;

-- Q-23: Cron advisory lock helper.
-- Each cron job calls this at entry; if another instance already holds the lock
-- the function returns FALSE and the caller should exit early.
CREATE OR REPLACE FUNCTION try_cron_advisory_lock(cron_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN pg_try_advisory_lock(hashtext(cron_name));
END;
$$;
