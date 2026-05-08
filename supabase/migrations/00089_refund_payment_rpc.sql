-- Migration: 00089_refund_payment_rpc.sql
-- A18-03: Race-safe refund RPC.
-- The previous application-layer refund flow read refunded_amount, computed
-- the new total, then ran an UPDATE — a classic TOCTOU race. Two concurrent
-- refund requests for the same payment could both read refunded_amount=0,
-- both compute newTotal=X, and both commit — resulting in a double-refund.
--
-- This RPC locks the payment row with SELECT FOR UPDATE before reading
-- refunded_amount, ensuring only one refund can proceed at a time.

CREATE OR REPLACE FUNCTION process_payment_refund(
  p_payment_id   UUID,
  p_clinic_id    UUID,
  p_amount       NUMERIC  -- requested refund amount (NULL = full remaining)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_payment         RECORD;
  v_refund_amount   NUMERIC;
  v_already_refunded NUMERIC;
  v_remaining       NUMERIC;
  v_new_total       NUMERIC;
  v_new_status      TEXT;
BEGIN
  -- 1. Lock the payment row — prevents concurrent double-refunds
  SELECT id, status, amount, COALESCE(refunded_amount, 0) AS refunded_amount
  INTO   v_payment
  FROM   payments
  WHERE  id = p_payment_id
    AND  clinic_id = p_clinic_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Payment not found', 'code', 'NOT_FOUND');
  END IF;

  IF v_payment.status NOT IN ('completed', 'partially_refunded') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Only completed or partially refunded payments can be refunded',
      'code', 'WRONG_STATE'
    );
  END IF;

  v_already_refunded := v_payment.refunded_amount;
  v_remaining        := v_payment.amount - v_already_refunded;

  -- Default to full remaining amount
  v_refund_amount := COALESCE(p_amount, v_remaining);

  IF v_refund_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Refund amount must be positive', 'code', 'INVALID_AMOUNT');
  END IF;

  IF v_refund_amount > v_remaining THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', format('Refund amount (%s) exceeds remaining refundable amount (%s)',
                      v_refund_amount, v_remaining),
      'code', 'EXCEEDS_REMAINING'
    );
  END IF;

  v_new_total  := v_already_refunded + v_refund_amount;
  v_new_status := CASE WHEN v_new_total >= v_payment.amount THEN 'refunded'
                       ELSE 'partially_refunded'
                  END;

  -- 2. Apply the refund atomically
  UPDATE payments
  SET    status          = v_new_status,
         refunded_amount = v_new_total,
         updated_at      = now()
  WHERE  id         = p_payment_id
    AND  clinic_id  = p_clinic_id;

  RETURN jsonb_build_object(
    'ok',             true,
    'payment_id',     p_payment_id,
    'refund_amount',  v_refund_amount,
    'new_total',      v_new_total,
    'new_status',     v_new_status
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM, 'code', 'INTERNAL_ERROR');
END;
$$;

GRANT EXECUTE ON FUNCTION process_payment_refund(UUID, UUID, NUMERIC)
  TO authenticated;

COMMENT ON FUNCTION process_payment_refund IS
  'A18-03: Race-safe refund RPC. Uses SELECT FOR UPDATE to lock the payment row,
   preventing concurrent double-refunds. Validates remaining refundable amount
   inside the transaction, eliminating the TOCTOU race in the previous app-layer code.';
