-- Add performance indexes for status page, audit-logs, and super-admin notifications.
-- All indexes are on public tables and use IF NOT EXISTS for idempotent deployment.

CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_sent_at ON notifications(user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_uptime_events_occurred_at ON uptime_events(occurred_at DESC);
