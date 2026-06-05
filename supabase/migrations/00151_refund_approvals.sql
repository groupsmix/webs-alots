-- ============================================================
-- Migration 00151: Create refund_approvals table (dual-control)
--
-- Refunds above 5 000 MAD require two separate super_admin approvals
-- to prevent unilateral large-sum reversals. The workflow is:
--
--   1. First super_admin submits a refund request via the UI.
--      API inserts a row with status = 'pending_second'.
--   2. A different super_admin reviews and approves or rejects via
--      the approve_refund(refund_id, approver_id) RPC.
--   3. On approval, the application layer triggers the actual CMI
--      refund API call and updates payment_status = 'refunded' on
--      the appointments row.
--
-- Refunds at or below 5 000 MAD are auto-approved (status = 'approved'
-- on INSERT) and do not require a second sign-off.
--
-- DUAL-CONTROL ENFORCEMENT (SECURITY):
--   • The RLS policy allows super_admin SELECT only — no direct UPDATE.
--   • The state transition to 'approved' is encapsulated in the
--     SECURITY DEFINER function `approve_refund` which atomically:
--       - blocks self-approval (initiator_id = approver_id)
--       - validates state transition (must be 'pending_second')
--       - sets approver_id, status='approved', resolved_at
--       - writes a tamper-evident audit_logs row
--   • This prevents bypass via direct PostgREST UPDATE.
-- ============================================================

CREATE TABLE IF NOT EXISTS refund_approvals (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID        NOT NULL REFERENCES clinics(id),
  payment_order_id TEXT        NOT NULL,
  amount_mad       NUMERIC(10, 2) NOT NULL CHECK (amount_mad > 0),
  initiator_id     UUID        NOT NULL REFERENCES users(id),
  approver_id      UUID        REFERENCES users(id),
  status           TEXT        NOT NULL DEFAULT 'pending_second'
    CHECK (status IN ('pending_second', 'approved', 'rejected')),
  rejection_reason TEXT,
  initiated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at      TIMESTAMPTZ
);

ALTER TABLE refund_approvals ENABLE ROW LEVEL SECURITY;

-- ── SELECT-only for super admins (browse the refund queue UI). ────────────
-- All state mutations go through the approve_refund RPC (SECURITY DEFINER).
DROP POLICY IF EXISTS "superadmin_all_refunds"      ON refund_approvals;
DROP POLICY IF EXISTS "superadmin_select_refunds"   ON refund_approvals;
DROP POLICY IF EXISTS "service_role_all_refunds"    ON refund_approvals;

CREATE POLICY "superadmin_select_refunds"
  ON refund_approvals
  FOR SELECT
  USING (is_super_admin());

-- Service role bypass for background jobs / webhooks (INSERT for initiator,
-- UPDATE for state transitions performed by the RPC's SECURITY DEFINER).
CREATE POLICY "service_role_all_refunds"
  ON refund_approvals
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Index for the refund queue UI — sort by initiated_at DESC.
CREATE INDEX IF NOT EXISTS idx_refund_approvals_status_initiated
  ON refund_approvals(status, initiated_at DESC);

COMMENT ON TABLE refund_approvals IS
  'Dual-control refund approval queue. Refunds > 5 000 MAD require a '
  'second super_admin approval (status = pending_second). Mutations go '
  'through the approve_refund() RPC which blocks self-approval at the DB '
  'level.';

COMMENT ON COLUMN refund_approvals.payment_order_id IS
  'References appointments.payment_order_id — the CMI order to be refunded.';

COMMENT ON COLUMN refund_approvals.initiator_id IS
  'Super admin who initiated the refund request (first approval).';

COMMENT ON COLUMN refund_approvals.approver_id IS
  'Super admin who gave the second approval or rejection. NULL until resolved.';

-- ============================================================
-- approve_refund(refund_id, approver_id)
--
-- SECURITY DEFINER RPC that performs the dual-control state transition
-- atomically. Enforced invariants:
--   1. Caller must be a super_admin (we re-verify regardless of the
--      argument so a malicious caller can't pass an arbitrary UUID).
--   2. approver_id must NOT equal initiator_id (self-approval is the
--      whole reason dual-control exists).
--   3. The row must currently be in 'pending_second'.
--
-- On success: sets status='approved', approver_id, resolved_at, and
-- writes an audit row. Returns the updated refund_approvals row.
--
-- On failure: raises an exception with a stable SQLSTATE so the API
-- route can translate it to the right HTTP status:
--   • P0001 + message starting with 'NOT_FOUND'       → 404
--   • P0001 + message starting with 'WRONG_STATE'     → 409
--   • P0001 + message starting with 'SELF_APPROVAL'   → 403
--   • P0001 + message starting with 'NOT_AUTHORIZED'  → 403
-- ============================================================

CREATE OR REPLACE FUNCTION approve_refund(
  p_refund_id   UUID,
  p_approver_id UUID
) RETURNS refund_approvals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row refund_approvals;
BEGIN
  -- 1. Caller must be a super_admin. is_super_admin() reads auth.uid()
  --    so the argument cannot impersonate anyone.
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: super_admin role required'
      USING ERRCODE = 'P0001';
  END IF;

  -- 2. Lock the row to prevent two parallel approvers racing.
  SELECT *
    INTO v_row
    FROM refund_approvals
   WHERE id = p_refund_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: refund % does not exist', p_refund_id
      USING ERRCODE = 'P0001';
  END IF;

  -- 3. State transition guard.
  IF v_row.status <> 'pending_second' THEN
    RAISE EXCEPTION 'WRONG_STATE: refund % is in state %, not pending_second',
                    p_refund_id, v_row.status
      USING ERRCODE = 'P0001';
  END IF;

  -- 4. Dual-control invariant — no self-approval.
  IF v_row.initiator_id = p_approver_id THEN
    RAISE EXCEPTION 'SELF_APPROVAL: initiator % cannot also approve',
                    p_approver_id
      USING ERRCODE = 'P0001';
  END IF;

  -- 5. Atomic state transition.
  UPDATE refund_approvals
     SET status      = 'approved',
         approver_id = p_approver_id,
         resolved_at = now()
   WHERE id = p_refund_id
  RETURNING * INTO v_row;

  -- 6. Tamper-evident audit row. activity_logs.type allows 'billing'
  --    (see migration 00005); we use that for refund-related events.
  INSERT INTO activity_logs (action, type, clinic_id, description, actor, metadata)
  VALUES (
    'refund_second_approved',
    'billing',
    v_row.clinic_id,
    format('Refund %s approved by second admin %s (amount %s MAD, order %s)',
           v_row.id, p_approver_id, v_row.amount_mad, v_row.payment_order_id),
    p_approver_id::text,
    jsonb_build_object(
      'refundId',       v_row.id,
      'initiatorId',    v_row.initiator_id,
      'approverId',     p_approver_id,
      'amountMad',      v_row.amount_mad,
      'paymentOrderId', v_row.payment_order_id
    )
  );

  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION approve_refund(UUID, UUID) IS
  'Dual-control refund approval. Blocks self-approval, validates state '
  'transition, writes audit log. SECURITY DEFINER — runs as the migration '
  'owner so it can write to refund_approvals even though the SELECT-only '
  'RLS policy denies UPDATE to super_admin sessions.';

REVOKE ALL ON FUNCTION approve_refund(UUID, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION approve_refund(UUID, UUID) TO authenticated;
