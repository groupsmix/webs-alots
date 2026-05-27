-- API-008 / COST-002: Notification dedup constraint.
--
-- The reminder cron runs every 15 minutes. Without a unique constraint
-- on (appointment_id, trigger, channel), a race or retry can produce
-- duplicate WhatsApp/SMS sends — doubling the per-message cost and
-- annoying patients.
--
-- This adds a partial unique index that prevents duplicate sends for
-- the same appointment + trigger + channel combination, but only for
-- rows with status 'sent' or 'delivered' (so a failed attempt can be
-- retried).

CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_log_dedup
  ON notification_log (appointment_id, trigger, channel)
  WHERE status IN ('sent', 'delivered', 'pending');

COMMENT ON INDEX uq_notification_log_dedup IS 'API-008: Prevent duplicate notification sends per appointment/trigger/channel';
