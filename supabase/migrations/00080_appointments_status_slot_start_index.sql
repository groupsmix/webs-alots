-- ============================================================
-- Migration 00073: Add composite index on appointments(status, slot_start)
-- ============================================================
-- Audit Finding #7: The cron/reminders endpoint queries appointments by
-- status IN ('pending', 'confirmed') AND slot_start range. Without an
-- index on this combination, the query becomes a sequential scan at scale.
--
-- This partial index only includes the two statuses the reminders query
-- filters on, keeping the index small and writes fast.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_status_slot_start
  ON appointments(status, slot_start)
  WHERE status IN ('pending', 'confirmed');
