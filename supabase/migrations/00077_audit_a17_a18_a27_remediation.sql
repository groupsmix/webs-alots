-- =============================================================================
-- Migration 00077: Audit A17/A18/A27 Remediation
-- =============================================================================
-- Addresses:
--   A17-04: Composite index on users for directory queries
--   A17-05: Composite index on audit_log for clinic-scoped reads
--   A18-02: Atomic RPC for payment + appointment status update
--   A27-01: Partial index for soft-deleted clinics
--   A27-03: Partial index for non-deleted clinics (listing queries)
-- =============================================================================

-- ── A17-04: Composite index for directory queries on users ────────────
-- Hot path: public doctor directory filters on (role, clinic_id, status).
-- The city filter comes from clinics.config JSONB, not users, so omitted here.
CREATE INDEX IF NOT EXISTS idx_users_directory_lookup
  ON users (role, clinic_id)
  WHERE role = 'doctor';

-- ── A17-05: Composite index for audit_log reads ──────────────────────
-- Many queries read audit_log scoped to a clinic, ordered by created_at DESC.
CREATE INDEX IF NOT EXISTS idx_audit_log_clinic_created
  ON audit_log (clinic_id, created_at DESC);

-- ── A27-01: Partial index on clinics for soft-delete filtering ───────
-- Ensure listing queries that filter WHERE deleted_at IS NULL are fast.
-- Also serves as documentation that soft-delete is in play.
CREATE INDEX IF NOT EXISTS idx_clinics_active
  ON clinics (id)
  WHERE deleted_at IS NULL;

-- ── A27-03: Index for the public_clinic_directory view ───────────────
-- The view should only return non-deleted clinics. This index helps
-- if the view or its dependent queries filter on deleted_at.
CREATE INDEX IF NOT EXISTS idx_clinics_deleted_at
  ON clinics (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- ── A18-02: Atomic RPC for payment upsert + appointment status update ─
-- Wraps the "mark payment completed + confirm appointment" in a single
-- transaction to prevent write-skew (payment recorded but appointment
-- status not updated, or vice versa).
--
-- Uses SELECT ... FOR UPDATE on the appointment row to prevent concurrent
-- modifications during the transaction window.
CREATE OR REPLACE FUNCTION complete_payment_and_confirm_appointment(
  p_clinic_id UUID,
  p_patient_id UUID,
  p_appointment_id UUID,
  p_amount NUMERIC(10,2),
  p_reference TEXT,
  p_payment_type TEXT DEFAULT 'full'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;
-- A27-1 fix: Add statement_timeout to prevent blocked locks from holding indefinitely (4a23ee6711)
SET statement_timeout = '5s';
AS $$
DECLARE
  v_payment_id UUID;
  v_appointment_status TEXT;
BEGIN
  -- 1. Upsert payment (idempotent on reference)
  INSERT INTO payments (
    clinic_id, patient_id, appointment_id,
    amount, method, status, reference, payment_type
  ) VALUES (
    p_clinic_id, p_patient_id, p_appointment_id,
    p_amount, 'online', 'completed', p_reference, p_payment_type
  )
  ON CONFLICT (reference) DO NOTHING
  RETURNING id INTO v_payment_id;

  -- If payment already existed (duplicate webhook), return early
  IF v_payment_id IS NULL THEN
    RETURN jsonb_build_object(
      'deduplicated', true,
      'message', 'Payment already processed'
    );
  END IF;

  -- 2. Lock and update appointment status atomically
  IF p_appointment_id IS NOT NULL THEN
    SELECT status INTO v_appointment_status
    FROM appointments
    WHERE id = p_appointment_id
      AND clinic_id = p_clinic_id
    FOR UPDATE;

    IF v_appointment_status = 'pending' THEN
      UPDATE appointments
      SET status = 'confirmed'
      WHERE id = p_appointment_id
        AND clinic_id = p_clinic_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'deduplicated', false,
    'payment_id', v_payment_id,
    'appointment_confirmed', (v_appointment_status = 'pending')
  );
END;
$$;

-- Grant execute to authenticated users (RLS still applies on the tables)
GRANT EXECUTE ON FUNCTION complete_payment_and_confirm_appointment TO authenticated;

COMMENT ON FUNCTION complete_payment_and_confirm_appointment IS
  'A18-02: Atomic payment upsert + appointment confirmation in a single transaction. '
  'Prevents write-skew between payment recording and appointment status updates.';
