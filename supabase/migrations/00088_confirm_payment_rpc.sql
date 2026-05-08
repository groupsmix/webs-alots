-- Migration: 00088_confirm_payment_rpc.sql
-- A18-02: Atomic payment confirmation + appointment status update.
-- The previous application-layer code ran two sequential UPDATE statements.
-- If the second UPDATE (appointment) failed, payment would be marked
-- "completed" but the appointment would remain "pending" — divergent state.
-- This RPC wraps both mutations in a single transaction, ensuring atomicity.

CREATE OR REPLACE FUNCTION confirm_payment_and_appointment(
  p_payment_id   UUID,
  p_clinic_id    UUID,
  p_confirmed_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER  -- Runs as the calling role; RLS policies still apply
AS $$
DECLARE
  v_payment        RECORD;
  v_appointment_id UUID;
  v_result         JSONB;
BEGIN
  -- 1. Fetch and lock the payment row (prevents concurrent double-confirms)
  SELECT id, status, appointment_id
  INTO   v_payment
  FROM   payments
  WHERE  id = p_payment_id
    AND  clinic_id = p_clinic_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Payment not found', 'code', 'NOT_FOUND');
  END IF;

  IF v_payment.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Payment is not in pending state', 'code', 'WRONG_STATE');
  END IF;

  -- 2. Mark payment as completed
  UPDATE payments
  SET    status = 'completed',
         updated_at = now()
  WHERE  id = p_payment_id
    AND  clinic_id = p_clinic_id;

  -- 3. Confirm the associated appointment (if linked)
  v_appointment_id := v_payment.appointment_id;
  IF v_appointment_id IS NOT NULL THEN
    UPDATE appointments
    SET    status = 'confirmed',
           updated_at = now()
    WHERE  id = v_appointment_id
      AND  clinic_id = p_clinic_id
      AND  status IN ('pending', 'scheduled');
    -- If the appointment was already confirmed/cancelled, silently skip.
    -- The payment confirmation is still valid in that case.
  END IF;

  RETURN jsonb_build_object(
    'ok',             true,
    'payment_id',     p_payment_id,
    'appointment_id', v_appointment_id
  );

EXCEPTION WHEN OTHERS THEN
  -- Any error causes the entire transaction to roll back automatically.
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM, 'code', 'INTERNAL_ERROR');
END;
$$;

-- Grant execution to authenticated users (application connects as `authenticated` role)
GRANT EXECUTE ON FUNCTION confirm_payment_and_appointment(UUID, UUID, UUID)
  TO authenticated;

COMMENT ON FUNCTION confirm_payment_and_appointment IS
  'A18-02: Atomically confirm a payment and the associated appointment status.
   Both mutations are in a single transaction — either both succeed or both roll back.
   The payment row is locked with SELECT FOR UPDATE to prevent concurrent double-confirms.';
