-- Migration: 00124_dual_control_refunds.sql
--
-- Issue #673 (Audit A169-02): Add two-person approval workflow for
-- refunds exceeding 5 000 MAD. A single admin initiates a refund request;
-- a second admin of equal or higher privilege approves it. Only after
-- approval does the actual payment status update execute.
--
-- Tables:
--   refund_requests  — pending / approved / rejected / expired refund records
--
-- The existing payments.refunded_amount + CHECK constraint remain the
-- final financial safety net; this table adds the human-approval layer.

-- ── refund_requests ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refund_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  payment_id          UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,

  -- Who initiated the refund and how much
  initiator_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  amount              NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  reason              TEXT,

  -- Approval workflow
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'approved', 'rejected', 'executed', 'expired')),
  approver_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at         TIMESTAMPTZ,
  rejection_reason    TEXT,

  -- Execution receipt (populated once the refund is actually applied)
  executed_at         TIMESTAMPTZ,
  executed_by         UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Timestamps
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at          TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent the same payment from having multiple pending requests at once.
-- A previously rejected/expired/executed request does not block a new one.
CREATE UNIQUE INDEX IF NOT EXISTS refund_requests_payment_pending_uniq
  ON refund_requests (payment_id)
  WHERE status = 'pending';

-- Performance: look up pending requests by clinic quickly
CREATE INDEX IF NOT EXISTS refund_requests_clinic_status_idx
  ON refund_requests (clinic_id, status, created_at DESC);

-- ── updated_at trigger ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_refund_requests_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refund_requests_updated_at ON refund_requests;
CREATE TRIGGER trg_refund_requests_updated_at
  BEFORE UPDATE ON refund_requests
  FOR EACH ROW EXECUTE FUNCTION update_refund_requests_updated_at();

-- ── Auto-expire stale pending requests (called by cron) ─────────────────
CREATE OR REPLACE FUNCTION expire_stale_refund_requests()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE refund_requests
     SET status = 'expired', updated_at = NOW()
   WHERE status = 'pending'
     AND expires_at < NOW();
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$;

-- ── RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE refund_requests ENABLE ROW LEVEL SECURITY;

-- Clinic admins and super_admins can see all requests for their clinic
CREATE POLICY "Admins can view own clinic refund_requests"
  ON refund_requests FOR SELECT
  USING (
    clinic_id = get_request_clinic_id()
    AND EXISTS (
      SELECT 1 FROM users u
       WHERE u.auth_id = auth.uid()
         AND u.clinic_id = refund_requests.clinic_id
         AND u.role IN ('clinic_admin', 'super_admin')
    )
  );

-- Only admins can insert (initiate) refund requests for their own clinic
CREATE POLICY "Admins can initiate refund_requests"
  ON refund_requests FOR INSERT
  WITH CHECK (
    clinic_id = get_request_clinic_id()
    AND EXISTS (
      SELECT 1 FROM users u
       WHERE u.auth_id = auth.uid()
         AND u.clinic_id = refund_requests.clinic_id
         AND u.role IN ('clinic_admin', 'super_admin')
    )
  );

-- Only a DIFFERENT admin (not the initiator) can approve/reject
CREATE POLICY "Different admin can approve/reject refund_requests"
  ON refund_requests FOR UPDATE
  USING (
    clinic_id = get_request_clinic_id()
    AND status = 'pending'
    AND EXISTS (
      SELECT 1 FROM users u
       WHERE u.auth_id = auth.uid()
         AND u.clinic_id = refund_requests.clinic_id
         AND u.role IN ('clinic_admin', 'super_admin')
         AND u.id <> refund_requests.initiator_id -- must be a different person
    )
  );

-- Super-admin can see all refund requests across all clinics (override)
CREATE POLICY "Super admins can manage all refund_requests"
  ON refund_requests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
       WHERE u.auth_id = auth.uid()
         AND u.role = 'super_admin'
    )
  );

-- ── Comments ─────────────────────────────────────────────────────────────
COMMENT ON TABLE refund_requests IS
  'Two-person approval workflow for refunds > 5000 MAD (Audit Issue #673). '
  'Status: pending → approved → executed | rejected | expired. '
  'Initiator and approver must be different users.';

COMMENT ON COLUMN refund_requests.expires_at IS
  'Pending requests automatically expire after 24 hours via expire_stale_refund_requests() cron.';
