-- ============================================================
-- Migration 00068: Add index on notification_log.message_id
--
-- MED-02 FIX: The WhatsApp webhook handler (POST /api/webhooks)
-- queries notification_log by message_id to update delivery status.
-- Without an index, this becomes a full table scan as the log grows,
-- causing webhook timeouts and missed status updates.
--
-- This index enables O(log n) lookups for message_id queries.
-- ============================================================

-- Create index on message_id for fast webhook status updates
CREATE INDEX IF NOT EXISTS idx_notification_log_message_id
  ON notification_log (message_id)
  WHERE message_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON INDEX idx_notification_log_message_id IS 
  'MED-02 FIX: Speeds up WhatsApp webhook status updates by message_id';
