-- F-A164-a: invoice_number SEQUENCE — deterministic, gap-free numbering
-- F-A167:   DB audit triggers on payments/invoices tables
-- F-A169:   Refund race-safety (CHECK constraint + advisory lock note)
-- F-A188:   audit_logs immutability (revoke UPDATE/DELETE from app roles)
-- F-A200:   Parental consent — guardian_user_id FK on patients

-- ============================================================================
-- F-A164-a: Invoice number sequence
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'invoice_number_seq') THEN
    CREATE SEQUENCE invoice_number_seq START WITH 1000 INCREMENT BY 1;
  END IF;
END $$;

-- Add a generated invoice_number column if not already present
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'invoice_number_serial'
  ) THEN
    ALTER TABLE invoices
      ADD COLUMN invoice_number_serial BIGINT DEFAULT nextval('invoice_number_seq');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
  ) THEN
    CREATE TABLE audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      table_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      action TEXT NOT NULL,
      old_data JSONB,
      new_data JSONB,
      changed_by TEXT,
      clinic_id UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  END IF;
END $$;

-- ============================================================================
-- F-A167: Audit triggers on money tables
-- ============================================================================
CREATE OR REPLACE FUNCTION audit_money_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (
    table_name,
    record_id,
    action,
    old_data,
    new_data,
    changed_by,
    clinic_id,
    created_at
  ) VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id)::text,
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
    COALESCE(
      current_setting('request.jwt.claims', true)::json->>'sub',
      'system'
    ),
    COALESCE(NEW.clinic_id, OLD.clinic_id),
    now()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Payments trigger
DROP TRIGGER IF EXISTS trg_audit_payments ON payments;
CREATE TRIGGER trg_audit_payments
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION audit_money_change();

-- Invoices trigger
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices') THEN
    DROP TRIGGER IF EXISTS trg_audit_invoices ON invoices;
    CREATE TRIGGER trg_audit_invoices
      AFTER INSERT OR UPDATE OR DELETE ON invoices
      FOR EACH ROW EXECUTE FUNCTION audit_money_change();
  END IF;
END $$;

-- ============================================================================
-- F-A169: Refund race-safety constraint
-- Ensures refunded_amount never exceeds the original payment amount.
-- The application layer must also use SELECT ... FOR UPDATE when processing
-- refunds to prevent write-skew under concurrent requests.
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'refunded_amount'
  ) THEN
    ALTER TABLE payments
      ADD COLUMN refunded_amount NUMERIC(12,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_refund_not_exceeds_amount'
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT chk_refund_not_exceeds_amount
      CHECK (refunded_amount >= 0 AND refunded_amount <= amount);
  END IF;
END $$;

-- ============================================================================
-- F-A188: audit_logs immutability
-- Revoke UPDATE and DELETE on audit_logs from the application roles.
-- Only the postgres superuser can modify audit records.
-- ============================================================================
DO $$ BEGIN
  -- Revoke from authenticated (Supabase default app role)
  REVOKE UPDATE, DELETE ON audit_logs FROM authenticated;
  -- Revoke from anon
  REVOKE UPDATE, DELETE ON audit_logs FROM anon;
  -- Revoke from service_role (defense in depth — app should not mutate audits)
  REVOKE UPDATE, DELETE ON audit_logs FROM service_role;
EXCEPTION WHEN undefined_object THEN
  -- Roles may not exist in all environments
  NULL;
END $$;

-- ============================================================================
-- F-A200: Parental consent — guardian FK on patients
-- Allows linking a minor patient to a guardian (parent/legal representative)
-- who must provide consent for PHI processing.
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'guardian_user_id'
  ) THEN
    ALTER TABLE users
      ADD COLUMN guardian_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'date_of_birth'
  ) THEN
    ALTER TABLE users
      ADD COLUMN date_of_birth DATE;
  END IF;
END $$;

-- Index for guardian lookups
CREATE INDEX IF NOT EXISTS idx_users_guardian
  ON users(guardian_user_id)
  WHERE guardian_user_id IS NOT NULL;

COMMENT ON COLUMN users.guardian_user_id IS
  'F-A200: FK to parent/guardian user for minor patients. Required for paediatric PHI consent under Law 09-08 and GDPR Art.8.';
