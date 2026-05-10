-- Migration: 00088_notification_queue_atomic_claim.sql
-- A44.2: Atomic claim for notification queue processing.
--
-- Problem: The notification queue processor does SELECT then UPDATE,
-- creating a TOCTOU race. Two concurrent cron workers can fetch the
-- same pending items before either marks them 'processing', causing
-- duplicate notifications.
--
-- Fix: A SECURITY DEFINER RPC that uses SELECT ... FOR UPDATE SKIP LOCKED
-- inside the same transaction as the UPDATE, guaranteeing that each item
-- is claimed by exactly one worker.

CREATE OR REPLACE FUNCTION claim_notification_batch(p_limit INT DEFAULT 50)
RETURNS SETOF notification_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE notification_queue
  SET
    status = 'processing',
    updated_at = NOW()
  WHERE id IN (
    SELECT id
    FROM notification_queue
    WHERE status IN ('pending', 'failed')
      AND next_retry_at <= NOW()
    ORDER BY next_retry_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  RETURNING *;
END;
$$;

-- Grant execute to authenticated and service_role so the cron handler can call it
GRANT EXECUTE ON FUNCTION claim_notification_batch(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION claim_notification_batch(INT) TO service_role;

-- Update the partial index to include 'processing' status for the claim query
-- (The existing index idx_notification_queue_status_retry already covers pending+failed)
