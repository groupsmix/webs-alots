-- Performance indexes for hot query paths.
-- Targets: appointment scheduling, patient lookup, recent notes, audit queries.

-- Appointments: clinic + status + slot_start covers scheduling queries.
-- The existing idx_appointments_clinic_active only covers active statuses;
-- this composite serves all status-filtered queries sorted by time.
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_status_slot
  ON appointments (clinic_id, status, slot_start DESC);

-- Appointments: upcoming appointments per doctor (dashboard widget).
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_upcoming
  ON appointments (doctor_id, slot_start)
  WHERE status IN ('pending', 'confirmed', 'checked_in');

-- Users (patients): fast ILIKE patient search by name within a clinic.
-- trigram GIN index supports ILIKE '%pattern%' queries.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_users_name_trgm
  ON users USING GIN (name gin_trgm_ops);

-- Users: clinic + role for role-filtered queries (e.g. list patients).
CREATE INDEX IF NOT EXISTS idx_users_clinic_role
  ON users (clinic_id, role);

-- Consultation notes: recent notes per clinic for dashboard.
CREATE INDEX IF NOT EXISTS idx_consultation_notes_clinic_created
  ON consultation_notes (clinic_id, created_at DESC);

-- Activity logs (audit): clinic + timestamp for audit trail queries.
-- Partial index excludes NULL clinic_id (system-level events).
CREATE INDEX IF NOT EXISTS idx_activity_logs_clinic_timestamp
  ON activity_logs (clinic_id, timestamp DESC)
  WHERE clinic_id IS NOT NULL;

-- Notification queue: dequeue performance (claim_notification_batch RPC).
-- NOTE: the column is next_retry_at (see migration 00050); idx_notification_queue_status_retry
-- (migration 00057) already covers this case. This index is intentionally omitted here
-- to avoid the duplicate and to prevent an error on the non-existent next_attempt_at column.
