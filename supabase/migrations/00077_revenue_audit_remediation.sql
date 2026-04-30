-- =============================================================================
-- Migration 00077: Revenue & SOX Audit Remediation (A164, A167, A169)
--
-- Addresses findings from audit batches A164-A170:
--
--   A164-01 (P1): invoice_number is free-form TEXT with no SEQUENCE.
--     Moroccan Direction Generale des Impots requires gap-free sequential
--     numbering per tenant per fiscal year. Fix: invoice_sequences table +
--     next_invoice_number() function + UNIQUE constraint.
--
--   A164-02 (FAIL): No tax exemption tracking on invoices.
--     Fix: tax_exemptions table + FK on invoices.
--
--   A167-02 (FAIL): No DB-layer audit triggers on money tables.
--     Fix: money_audit_log table + triggers on payments and invoices
--     for UPDATE/DELETE capturing actor, before/after, reason.
--
--   A169-01 (FAIL): Refund endpoint has no idempotency key and is
--     vulnerable to double-refund race conditions.
--     Fix: Add version column to payments for optimistic concurrency,
--     add refund_idempotency_keys table for deduplication.
--
--   A169-05 (FAIL): No chargeback correlation table.
--     Fix: chargebacks table with FK to payments.
-- =============================================================================

BEGIN;

-- ============================================================
-- 1. SEQUENTIAL INVOICE NUMBERING (A164-01)
-- ============================================================

-- Sequence tracker: one row per (clinic_id, fiscal_year)
CREATE TABLE IF NOT EXISTS invoice_sequences (
  clinic_id    UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  fiscal_year  INT  NOT NULL CHECK (fiscal_year >= 2020 AND fiscal_year <= 2100),
  last_number  INT  NOT NULL DEFAULT 0 CHECK (last_number >= 0),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (clinic_id, fiscal_year)
);

-- RLS
ALTER TABLE invoice_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sa_invoice_sequences_all" ON invoice_sequences
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "staff_invoice_sequences_all" ON invoice_sequences
  FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());

COMMENT ON TABLE invoice_sequences IS
  'A164-01: Tracks the last allocated invoice number per clinic per fiscal year. '
  'Used by next_invoice_number() to guarantee gap-free monotonic numbering as '
  'required by the Moroccan Direction Generale des Impots.';

-- Function: atomically allocate the next invoice number.
-- Returns a formatted string like "2026-000001".
-- Must be called inside a transaction (the INSERT/UPDATE is self-contained).
CREATE OR REPLACE FUNCTION next_invoice_number(
  p_clinic_id UUID,
  p_fiscal_year INT DEFAULT EXTRACT(YEAR FROM now())::INT
)
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next INT;
BEGIN
  -- UPSERT: increment if exists, insert with 1 if not
  INSERT INTO invoice_sequences (clinic_id, fiscal_year, last_number, updated_at)
  VALUES (p_clinic_id, p_fiscal_year, 1, now())
  ON CONFLICT (clinic_id, fiscal_year)
  DO UPDATE SET
    last_number = invoice_sequences.last_number + 1,
    updated_at = now()
  RETURNING last_number INTO v_next;

  -- Format: YYYY-NNNNNN (6-digit zero-padded)
  RETURN p_fiscal_year::TEXT || '-' || LPAD(v_next::TEXT, 6, '0');
END;
$$;

COMMENT ON FUNCTION next_invoice_number(UUID, INT) IS
  'A164-01: Atomically allocates the next gap-free invoice number for a clinic '
  'in a given fiscal year. Returns format YYYY-NNNNNN. Must be called within '
  'the same transaction as the invoice INSERT for gap-free guarantee.';

-- Add UNIQUE constraint on (clinic_id, invoice_number) if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_invoices_clinic_number'
      AND conrelid = 'invoices'::regclass
  ) THEN
    ALTER TABLE invoices
      ADD CONSTRAINT uq_invoices_clinic_number
      UNIQUE (clinic_id, invoice_number);
    RAISE NOTICE 'A164-01: Added UNIQUE constraint uq_invoices_clinic_number';
  END IF;
END $$;

COMMENT ON CONSTRAINT uq_invoices_clinic_number ON invoices IS
  'A164-01 (added in 00077): Enforces uniqueness of invoice numbers per clinic. '
  'Combined with next_invoice_number() for Moroccan DGI compliance.';


-- ============================================================
-- 2. TAX EXEMPTION TRACKING (A164-02)
-- ============================================================

CREATE TABLE IF NOT EXISTS tax_exemptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id     UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  -- Moroccan exemption types: medical acts, RAMED, diplomatic, etc.
  exemption_type TEXT NOT NULL DEFAULT 'medical_act'
    CHECK (exemption_type IN (
      'medical_act',    -- Certain medical acts exempt from TVA
      'ramed',          -- RAMED beneficiaries
      'diplomatic',     -- Diplomatic exemption
      'export',         -- Export of services
      'other'
    )),
  -- Legal reference (e.g., CGI Article 91-III-1)
  legal_reference TEXT,
  -- Rate override: 0 for full exemption, or a reduced rate
  rate_override   NUMERIC(5,4) CHECK (rate_override >= 0 AND rate_override <= 1),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tax_exemptions_clinic ON tax_exemptions(clinic_id);

ALTER TABLE tax_exemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sa_tax_exemptions_all" ON tax_exemptions
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "staff_tax_exemptions_all" ON tax_exemptions
  FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());

COMMENT ON TABLE tax_exemptions IS
  'A164-02: Tax exemption certificates for Moroccan clinics. Referenced by '
  'invoices to justify zero or reduced TVA rates.';

-- Add exemption_id FK to invoices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'exemption_id'
  ) THEN
    ALTER TABLE invoices
      ADD COLUMN exemption_id UUID REFERENCES tax_exemptions(id) ON DELETE SET NULL;
    RAISE NOTICE 'A164-02: Added exemption_id column to invoices';
  END IF;
END $$;

-- Add fiscal_year column to invoices for partitioning/filtering
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'fiscal_year'
  ) THEN
    ALTER TABLE invoices
      ADD COLUMN fiscal_year INT
        GENERATED ALWAYS AS (EXTRACT(YEAR FROM created_at)::INT) STORED;
    RAISE NOTICE 'A164-01: Added fiscal_year generated column to invoices';
  END IF;
END $$;


-- ============================================================
-- 3. MONEY TABLE AUDIT TRIGGERS (A167-02)
-- ============================================================

-- Audit log table for DB-layer changes to money tables
CREATE TABLE IF NOT EXISTS money_audit_log (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_name    TEXT NOT NULL,
  operation     TEXT NOT NULL CHECK (operation IN ('UPDATE', 'DELETE')),
  row_id        UUID NOT NULL,
  clinic_id     UUID,
  -- Actor: DB role or application user (from request headers if available)
  actor         TEXT,
  -- Before/after snapshots as JSONB
  old_data      JSONB NOT NULL,
  new_data      JSONB,  -- NULL for DELETE
  -- Optional reason (can be set via SET LOCAL before the operation)
  reason        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_money_audit_log_table ON money_audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_money_audit_log_row ON money_audit_log(row_id);
CREATE INDEX IF NOT EXISTS idx_money_audit_log_clinic ON money_audit_log(clinic_id);
CREATE INDEX IF NOT EXISTS idx_money_audit_log_created ON money_audit_log(created_at);

ALTER TABLE money_audit_log ENABLE ROW LEVEL SECURITY;

-- Only super_admin can read audit logs; no one can modify
CREATE POLICY "sa_money_audit_log_select" ON money_audit_log
  FOR SELECT USING (is_super_admin());

-- Deny all modifications via RLS (triggers use SECURITY DEFINER)
CREATE POLICY "deny_money_audit_log_modify" ON money_audit_log
  FOR ALL USING (false) WITH CHECK (false);

-- Allow inserts from the trigger function (SECURITY DEFINER bypasses RLS)
-- but keep the deny policy for interactive sessions

COMMENT ON TABLE money_audit_log IS
  'A167-02: Database-layer audit trail for money tables (payments, invoices). '
  'Captures actor, before/after state, and reason on every UPDATE/DELETE. '
  'Defence-in-depth complement to the application-layer audit log.';

-- Generic trigger function for money table auditing
CREATE OR REPLACE FUNCTION fn_money_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor TEXT;
  v_reason TEXT;
  v_clinic_id UUID;
BEGIN
  -- Try to get the actor from request headers (set by middleware)
  BEGIN
    v_actor := coalesce(
      current_setting('request.jwt.claims', true)::json->>'sub',
      current_setting('request.header.x-actor', true),
      current_user
    );
  EXCEPTION WHEN OTHERS THEN
    v_actor := current_user;
  END;

  -- Try to get reason from session variable
  BEGIN
    v_reason := current_setting('app.audit_reason', true);
  EXCEPTION WHEN OTHERS THEN
    v_reason := NULL;
  END;

  -- Extract clinic_id from the row
  IF TG_OP = 'DELETE' THEN
    v_clinic_id := OLD.clinic_id;
    INSERT INTO money_audit_log (table_name, operation, row_id, clinic_id, actor, old_data, new_data, reason)
    VALUES (TG_TABLE_NAME, 'DELETE', OLD.id, v_clinic_id, v_actor, to_jsonb(OLD), NULL, v_reason);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    v_clinic_id := NEW.clinic_id;
    INSERT INTO money_audit_log (table_name, operation, row_id, clinic_id, actor, old_data, new_data, reason)
    VALUES (TG_TABLE_NAME, 'UPDATE', OLD.id, v_clinic_id, v_actor, to_jsonb(OLD), to_jsonb(NEW), v_reason);
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION fn_money_audit_trigger() IS
  'A167-02: Generic audit trigger for money tables. Captures actor (from JWT '
  'claims or DB role), old/new row state, and optional reason.';

-- Trigger on payments
DROP TRIGGER IF EXISTS trg_payments_audit ON payments;
CREATE TRIGGER trg_payments_audit
  AFTER UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION fn_money_audit_trigger();

-- Trigger on invoices
DROP TRIGGER IF EXISTS trg_invoices_audit ON invoices;
CREATE TRIGGER trg_invoices_audit
  AFTER UPDATE OR DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION fn_money_audit_trigger();


-- ============================================================
-- 4. REFUND RACE SAFETY (A169-01)
-- ============================================================

-- Add version column for optimistic concurrency control
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'version'
  ) THEN
    ALTER TABLE payments ADD COLUMN version INT NOT NULL DEFAULT 1;
    RAISE NOTICE 'A169-01: Added version column to payments for optimistic concurrency';
  END IF;
END $$;

-- Add partially_refunded to the status CHECK if not already there
-- (The original CHECK only allows: pending, completed, refunded, failed)
DO $$
BEGIN
  -- Drop old constraint and add new one with partially_refunded
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payments_status_check'
      AND conrelid = 'payments'::regclass
  ) THEN
    ALTER TABLE payments DROP CONSTRAINT payments_status_check;
  END IF;

  -- Some migrations may have used a different constraint name
  -- The original schema uses inline CHECK which gets an auto-generated name
  -- Try to find and drop it
  PERFORM 1; -- no-op, we handle below
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Recreate with all statuses (idempotent: use NOT VALID + VALIDATE pattern)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payments_status_valid'
      AND conrelid = 'payments'::regclass
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT payments_status_valid
      CHECK (status IN ('pending', 'completed', 'refunded', 'partially_refunded', 'failed'))
      NOT VALID;
    ALTER TABLE payments VALIDATE CONSTRAINT payments_status_valid;
    RAISE NOTICE 'A169-01: Added payments_status_valid CHECK constraint';
  END IF;
END $$;

-- Idempotency key table for refund deduplication
CREATE TABLE IF NOT EXISTS refund_idempotency_keys (
  idempotency_key TEXT NOT NULL,
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  payment_id      UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  refund_amount   NUMERIC NOT NULL,
  result_status   TEXT NOT NULL DEFAULT 'processing'
    CHECK (result_status IN ('processing', 'completed', 'failed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (idempotency_key, clinic_id)
);

CREATE INDEX IF NOT EXISTS idx_refund_idempotency_payment ON refund_idempotency_keys(payment_id);

ALTER TABLE refund_idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sa_refund_idempotency_all" ON refund_idempotency_keys
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "staff_refund_idempotency_all" ON refund_idempotency_keys
  FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());

COMMENT ON TABLE refund_idempotency_keys IS
  'A169-01: Prevents duplicate refund processing. Client supplies an idempotency '
  'key; if a matching key+clinic already exists, the refund is skipped.';

-- Add a CHECK constraint: refunded_amount <= amount
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payments_refund_not_exceed_amount'
      AND conrelid = 'payments'::regclass
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT payments_refund_not_exceed_amount
      CHECK (refunded_amount IS NULL OR refunded_amount <= amount)
      NOT VALID;
    ALTER TABLE payments VALIDATE CONSTRAINT payments_refund_not_exceed_amount;
    RAISE NOTICE 'A169-01: Added payments_refund_not_exceed_amount CHECK constraint';
  END IF;
END $$;


-- ============================================================
-- 5. CHARGEBACK TABLE (A169-05)
-- ============================================================

CREATE TABLE IF NOT EXISTS chargebacks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  payment_id      UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  -- External references
  gateway         TEXT NOT NULL CHECK (gateway IN ('stripe', 'cmi')),
  gateway_dispute_id TEXT,  -- Stripe dispute ID or CMI reference
  -- Amounts
  amount          NUMERIC NOT NULL CHECK (amount > 0),
  currency        CHAR(3) NOT NULL DEFAULT 'MAD' CHECK (currency ~ '^[A-Z]{3}$'),
  fee             NUMERIC NOT NULL DEFAULT 0 CHECK (fee >= 0),
  -- Status tracking
  status          TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'under_review', 'won', 'lost', 'accepted')),
  reason          TEXT,  -- Dispute reason category from gateway
  -- Evidence
  evidence_due_by TIMESTAMPTZ,
  evidence_submitted_at TIMESTAMPTZ,
  -- Resolution
  resolved_at     TIMESTAMPTZ,
  resolution_notes TEXT,
  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chargebacks_clinic ON chargebacks(clinic_id);
CREATE INDEX IF NOT EXISTS idx_chargebacks_payment ON chargebacks(payment_id);
CREATE INDEX IF NOT EXISTS idx_chargebacks_status ON chargebacks(status);
CREATE INDEX IF NOT EXISTS idx_chargebacks_gateway_dispute ON chargebacks(gateway_dispute_id);

ALTER TABLE chargebacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sa_chargebacks_all" ON chargebacks
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "staff_chargebacks_all" ON chargebacks
  FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());

COMMENT ON TABLE chargebacks IS
  'A169-05: Tracks payment disputes/chargebacks from Stripe and CMI gateways. '
  'Correlates with the payments table for financial reconciliation.';

-- Also add an audit trigger on chargebacks
DROP TRIGGER IF EXISTS trg_chargebacks_audit ON chargebacks;
CREATE TRIGGER trg_chargebacks_audit
  AFTER UPDATE OR DELETE ON chargebacks
  FOR EACH ROW EXECUTE FUNCTION fn_money_audit_trigger();

COMMIT;
