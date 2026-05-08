-- Migration: 00082_money_audit_triggers.sql
-- F-A167: Database-level audit triggers on financial tables.
--
-- Problem: A super_admin running raw SQL (Supabase Studio, psql) bypasses
-- application-layer logAuditEvent() calls, leaving no audit trail for
-- financial operations.  Moroccan Law 09-08 and DGI both require an
-- immutable, complete audit trail for all payment/invoice mutations.
--
-- Solution: AFTER INSERT OR UPDATE OR DELETE triggers on:
--   - payments
--   - invoices
--   - billing_events
-- Each trigger inserts a row into activity_logs (the same table that
-- the application-layer logAuditEvent() writes to), attributing the
-- event to the current DB role and JWT sub claim where available.

-- ── Helper: resolve the acting principal ─────────────────────────────
-- Returns the JWT `sub` claim if a Supabase session is active, or falls
-- back to the postgres role name for direct DB connections.
CREATE OR REPLACE FUNCTION _audit_actor()
RETURNS TEXT
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claim.sub', true),
    current_user::TEXT
  );
$$;

-- ── Generic financial audit writer ───────────────────────────────────
CREATE OR REPLACE FUNCTION _log_financial_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id UUID;
  v_record    JSON;
  v_action    TEXT;
BEGIN
  -- Determine the clinic_id from the affected row
  IF TG_OP = 'DELETE' THEN
    v_clinic_id := OLD.clinic_id;
    v_record    := row_to_json(OLD);
    v_action    := TG_TABLE_NAME || '.deleted';
  ELSE
    v_clinic_id := NEW.clinic_id;
    v_record    := row_to_json(NEW);
    v_action    := TG_TABLE_NAME || '.' || lower(TG_OP);
  END IF;

  -- Skip if clinic_id is null (should not happen — safeguard)
  IF v_clinic_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Write to activity_logs (same sink as application-layer audit events)
  INSERT INTO activity_logs (
    action,
    type,
    actor,
    clinic_id,
    description,
    metadata,
    timestamp
  ) VALUES (
    v_action,
    'payment',
    _audit_actor(),
    v_clinic_id,
    'DB-level financial audit: ' || TG_TABLE_NAME || ' ' || TG_OP,
    jsonb_build_object(
      'table',     TG_TABLE_NAME,
      'operation', TG_OP,
      'record_id', COALESCE(
        (v_record->>'id')::TEXT,
        '(no id)'
      ),
      'source',    CASE
        WHEN current_setting('request.jwt.claim.sub', true) IS NOT NULL
          AND current_setting('request.jwt.claim.sub', true) <> ''
        THEN 'api'
        ELSE 'direct_db'
      END
    ),
    NOW()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ── Attach triggers ───────────────────────────────────────────────────

-- payments table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
    DROP TRIGGER IF EXISTS trg_payments_audit ON payments;
    CREATE TRIGGER trg_payments_audit
      AFTER INSERT OR UPDATE OR DELETE ON payments
      FOR EACH ROW EXECUTE FUNCTION _log_financial_audit();
  END IF;
END;
$$;

-- invoices table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices') THEN
    DROP TRIGGER IF EXISTS trg_invoices_audit ON invoices;
    CREATE TRIGGER trg_invoices_audit
      AFTER INSERT OR UPDATE OR DELETE ON invoices
      FOR EACH ROW EXECUTE FUNCTION _log_financial_audit();
  END IF;
END;
$$;

-- billing_events table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'billing_events') THEN
    DROP TRIGGER IF EXISTS trg_billing_events_audit ON billing_events;
    CREATE TRIGGER trg_billing_events_audit
      AFTER INSERT OR UPDATE OR DELETE ON billing_events
      FOR EACH ROW EXECUTE FUNCTION _log_financial_audit();
  END IF;
END;
$$;

-- Grant execute rights
GRANT EXECUTE ON FUNCTION _audit_actor() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION _log_financial_audit() TO service_role;
