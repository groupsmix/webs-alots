-- Migration: 00083_refund_safety.sql
-- F-A169: Make the refund flow race-safe and add idempotency support.
--
-- Problem: The application-layer refund route:
--   1. Has no SELECT ... FOR UPDATE, so two concurrent refund requests can
--      both pass the "refunded_amount <= amount" check before either commits.
--   2. Has no idempotency key, so a Stripe retry can create a duplicate refund.
--   3. Has no DB-level CHECK constraint, so an application bug could write
--      refunded_amount > total_amount directly.
--
-- Solution:
--   1. Add CHECK (refunded_amount <= total_amount) to payments table.
--   2. Add idempotency_key column (unique per clinic) to prevent duplicate
--      refund processing.
--   3. Add a safe_refund() RPC that uses SELECT ... FOR UPDATE inside a
--      transaction to prevent double-refund races.

-- ── 1. DB-level over-refund guard ─────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN

    -- Add refunded_amount column if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'payments' AND column_name = 'refunded_amount'
    ) THEN
      ALTER TABLE payments ADD COLUMN refunded_amount NUMERIC(10,2) NOT NULL DEFAULT 0
        CHECK (refunded_amount >= 0);
    END IF;

    -- CHECK: refunded_amount must not exceed total amount
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.check_constraints
      WHERE constraint_name = 'payments_refunded_not_exceed_amount'
    ) THEN
      ALTER TABLE payments
        ADD CONSTRAINT payments_refunded_not_exceed_amount
        CHECK (refunded_amount <= amount);
    END IF;

    -- Idempotency key: unique (clinic_id, idempotency_key) to prevent duplicate refunds
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'payments' AND column_name = 'refund_idempotency_key'
    ) THEN
      ALTER TABLE payments ADD COLUMN refund_idempotency_key TEXT;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_name = 'payments'
        AND constraint_name = 'payments_refund_idempotency_unique'
    ) THEN
      -- Partial unique index: only enforce uniqueness when key is set
      CREATE UNIQUE INDEX IF NOT EXISTS payments_refund_idempotency_unique
        ON payments (clinic_id, refund_idempotency_key)
        WHERE refund_idempotency_key IS NOT NULL;
    END IF;

  END IF;
END;
$$;

-- ── 2. Safe refund RPC ────────────────────────────────────────────────
-- Performs a refund atomically with SELECT ... FOR UPDATE to prevent races.
-- Returns:
--   'ok'           - refund processed
--   'already_done' - idempotency key already exists (duplicate request)
--   'over_refund'  - requested amount would exceed total
--   'not_found'    - payment not found in clinic
CREATE OR REPLACE FUNCTION safe_refund(
  p_clinic_id       UUID,
  p_payment_id      UUID,
  p_refund_amount   NUMERIC,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment RECORD;
BEGIN
  -- Idempotency check (fast path, no lock needed)
  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM payments
      WHERE clinic_id = p_clinic_id
        AND refund_idempotency_key = p_idempotency_key
    ) THEN
      RETURN 'already_done';
    END IF;
  END IF;

  -- Lock the payment row to prevent concurrent refunds
  SELECT * INTO v_payment
  FROM payments
  WHERE id = p_payment_id
    AND clinic_id = p_clinic_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  -- Validate the refund amount
  IF p_refund_amount <= 0 THEN
    RETURN 'over_refund';
  END IF;

  IF (v_payment.refunded_amount + p_refund_amount) > v_payment.amount THEN
    RETURN 'over_refund';
  END IF;

  -- Apply the refund
  UPDATE payments
  SET
    refunded_amount       = refunded_amount + p_refund_amount,
    refund_idempotency_key = COALESCE(p_idempotency_key, refund_idempotency_key),
    updated_at            = NOW()
  WHERE id = p_payment_id
    AND clinic_id = p_clinic_id;

  RETURN 'ok';
END;
$$;

GRANT EXECUTE ON FUNCTION safe_refund(UUID, UUID, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION safe_refund(UUID, UUID, NUMERIC, TEXT) TO service_role;
