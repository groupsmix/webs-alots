-- ============================================================
-- Migration 00058: Audit Fixes Batch
--
-- Addresses multiple findings from the security/quality audit:
--
-- IDX-02 (MEDIUM):  Add compound (clinic_id, timestamp) index on activity_logs
-- FK-03  (MEDIUM):  Add ON DELETE CASCADE to prescriptions & consultation_notes FKs
-- RACE-02 (HIGH):   Add concurrency guard for waiting list promotion
-- ============================================================

-- ============================================================
-- IDX-02 (MEDIUM): Compound index on activity_logs
--
-- Queries that filter activity logs by clinic and sort by
-- timestamp benefit from a compound index. The existing
-- single-column indexes (idx_activity_logs_timestamp,
-- idx_activity_logs_type) cannot satisfy both predicates
-- efficiently.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_activity_logs_clinic_timestamp
  ON activity_logs (clinic_id, timestamp DESC);

-- ============================================================
-- FK-03 (MEDIUM): ON DELETE CASCADE for prescriptions & consultation_notes
--
-- When a patient or doctor user is deleted, orphaned rows in
-- prescriptions and consultation_notes block the DELETE and
-- leave stale data. Adding CASCADE ensures cleanup.
--
-- We also add CASCADE on the appointment_id FK so that
-- deleting an appointment cascades to its notes/prescriptions.
-- ============================================================

-- FK-03a: prescriptions.patient_id → users(id) ON DELETE CASCADE
DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT constraint_name INTO fk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  WHERE tc.table_name = 'prescriptions'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'patient_id'
  LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE prescriptions DROP CONSTRAINT %I', fk_name);
  END IF;

  ALTER TABLE prescriptions
    ADD CONSTRAINT prescriptions_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE;
END $$;

-- FK-03b: prescriptions.doctor_id → users(id) ON DELETE CASCADE
DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT constraint_name INTO fk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  WHERE tc.table_name = 'prescriptions'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'doctor_id'
  LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE prescriptions DROP CONSTRAINT %I', fk_name);
  END IF;

  ALTER TABLE prescriptions
    ADD CONSTRAINT prescriptions_doctor_id_fkey
    FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE;
END $$;

-- FK-03c: prescriptions.appointment_id → appointments(id) ON DELETE CASCADE
DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT constraint_name INTO fk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  WHERE tc.table_name = 'prescriptions'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'appointment_id'
  LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE prescriptions DROP CONSTRAINT %I', fk_name);
  END IF;

  ALTER TABLE prescriptions
    ADD CONSTRAINT prescriptions_appointment_id_fkey
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE;
END $$;

-- FK-03d: consultation_notes.patient_id → users(id) ON DELETE CASCADE
DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT constraint_name INTO fk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  WHERE tc.table_name = 'consultation_notes'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'patient_id'
  LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE consultation_notes DROP CONSTRAINT %I', fk_name);
  END IF;

  ALTER TABLE consultation_notes
    ADD CONSTRAINT consultation_notes_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE;
END $$;

-- FK-03e: consultation_notes.doctor_id → users(id) ON DELETE CASCADE
DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT constraint_name INTO fk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  WHERE tc.table_name = 'consultation_notes'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'doctor_id'
  LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE consultation_notes DROP CONSTRAINT %I', fk_name);
  END IF;

  ALTER TABLE consultation_notes
    ADD CONSTRAINT consultation_notes_doctor_id_fkey
    FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE;
END $$;

-- FK-03f: consultation_notes.appointment_id → appointments(id) ON DELETE CASCADE
DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT constraint_name INTO fk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  WHERE tc.table_name = 'consultation_notes'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'appointment_id'
  LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE consultation_notes DROP CONSTRAINT %I', fk_name);
  END IF;

  ALTER TABLE consultation_notes
    ADD CONSTRAINT consultation_notes_appointment_id_fkey
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE;
END $$;

-- ============================================================
-- RACE-02 (HIGH): Concurrency guard for waiting list promotion
--
-- When an appointment is cancelled, the system promotes the
-- first waiting-list entry. Without a guard, two concurrent
-- cancellations for the same doctor/date can both promote
-- the same waiting-list entry.
--
-- We use a PostgreSQL function that acquires an advisory lock
-- scoped to (doctor_id, preferred_date) before selecting and
-- updating the candidate. This serialises concurrent promotions
-- for the same slot.
-- ============================================================

CREATE OR REPLACE FUNCTION promote_waiting_list_entry(
  p_clinic_id UUID,
  p_doctor_id UUID,
  p_preferred_date DATE
)
RETURNS UUID AS $$
DECLARE
  lock_key BIGINT;
  v_entry_id UUID;
BEGIN
  -- Derive a deterministic lock key from doctor_id and date.
  -- We XOR the first 8 bytes of doctor_id with the date's epoch
  -- to produce a unique-enough advisory lock key.
  lock_key := ('x' || left(replace(p_doctor_id::text, '-', ''), 16))::bit(64)::bigint
              # extract(epoch from p_preferred_date)::bigint;

  -- Acquire a transaction-scoped advisory lock.
  -- This blocks concurrent promotions for the same doctor+date
  -- until the current transaction commits.
  PERFORM pg_advisory_xact_lock(lock_key);

  -- Select the oldest waiting entry using FOR UPDATE SKIP LOCKED
  -- as an extra safety net (in case two transactions somehow
  -- acquired different advisory locks for overlapping scenarios).
  SELECT id INTO v_entry_id
  FROM waiting_list
  WHERE clinic_id = p_clinic_id
    AND doctor_id = p_doctor_id
    AND preferred_date = p_preferred_date
    AND status = 'waiting'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_entry_id IS NOT NULL THEN
    UPDATE waiting_list
    SET status = 'notified',
        notified_at = now()
    WHERE id = v_entry_id;
  END IF;

  RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only service_role should call this function
REVOKE EXECUTE ON FUNCTION promote_waiting_list_entry(UUID, UUID, DATE) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION promote_waiting_list_entry(UUID, UUID, DATE) FROM authenticated;
REVOKE EXECUTE ON FUNCTION promote_waiting_list_entry(UUID, UUID, DATE) FROM anon;
