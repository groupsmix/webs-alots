-- DB-007: Composite index for cron reminder queries
--
-- The reminder cron runs every 30 minutes and filters appointments on
-- (status, slot_start). Without this index, the query does a full table scan
-- that grows linearly with appointment volume.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_status_slot_start
  ON appointments(status, slot_start)
  WHERE status IN ('pending', 'confirmed');
