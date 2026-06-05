-- ============================================================
-- Migration 00151: Create refund_approvals table (dual-control)
--
-- Refunds above 5 000 MAD require two separate super_admin approvals
-- to prevent unilateral large-sum reversals. The workflow is:
--
--   1. First super_admin submits a refund request via the UI.
--      API inserts a row with status = 'pending_second'.
--   2. A different super_admin reviews and approves or rejects.
--      Self-approval (initiator_id = approver_id) is blocked by
--      the API route, not by a DB constraint, to keep the schema
--      simple while still being enforceable.
--   3. On approval, the application layer triggers the actual CMI
--      refund API call and updates payment_status = 'refunded' on
--      the appointments row.
--
-- Refunds at or below 5 000 MAD are auto-approved (status = 'approved'
-- on INSERT) and do not require a second sign-off.
--
-- Note: amount_mad > 5000 threshold is enforced in the API layer
-- (src/app/api/super-admin/refunds/route.ts), not here, so the
-- threshold can be changed without a schema migration.
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

-- Only super admins can view or modify refund records.
CREATE POLICY "superadmin_all_refunds"
  ON refund_approvals
  FOR ALL
  USING  (is_super_admin())
  WITH CHECK (is_super_admin());

-- Service role bypass for background jobs / webhooks.
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
  'second super_admin approval (status = pending_second). The API route '
  'blocks self-approval (initiator_id = approver_id).';

COMMENT ON COLUMN refund_approvals.payment_order_id IS
  'References appointments.payment_order_id — the CMI order to be refunded.';

COMMENT ON COLUMN refund_approvals.initiator_id IS
  'Super admin who initiated the refund request (first approval).';

COMMENT ON COLUMN refund_approvals.approver_id IS
  'Super admin who gave the second approval or rejection. NULL until resolved.';
