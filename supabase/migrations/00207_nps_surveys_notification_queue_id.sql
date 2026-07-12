-- ============================================================
-- Migration 00207: Link nps_surveys to notification_queue
--
-- NPS surveys are now sent through the persistent notification queue
-- so the row needs a reference back to the queue entry for delivery
-- status, retry, and analytics.
-- ============================================================

ALTER TABLE nps_surveys
  ADD COLUMN IF NOT EXISTS notification_queue_id UUID REFERENCES notification_queue(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_nps_surveys_notification_queue_id
  ON nps_surveys(notification_queue_id);
