-- A247.4 D+8-30: Audit triggers for payment-related tables.
--
-- Every INSERT / UPDATE / DELETE on payments, invoices, and
-- payment_refunded is logged to activity_logs with the acting user
-- (from the JWT claim `request.jwt.claim.sub`).
--
-- This ensures that even raw SQL updates (e.g. via Supabase Studio or
-- a compromised service-role key) produce an auditable trail.

-- ── Helper function ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION audit_payment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_clinic_id uuid;
  v_action text;
  v_description text;
  v_metadata jsonb;
BEGIN
  -- Resolve the acting user from the JWT; falls back to
  -- '00000000-0000-0000-0000-000000000000' for service-role / cron.
  BEGIN
    v_actor := coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), '')::uuid,
      '00000000-0000-0000-0000-000000000000'::uuid
    );
  EXCEPTION WHEN OTHERS THEN
    v_actor := '00000000-0000-0000-0000-000000000000'::uuid;
  END;

  IF TG_OP = 'DELETE' THEN
    v_clinic_id := OLD.clinic_id;
    v_action    := TG_TABLE_NAME || '_deleted';
    v_description := format('%s row %s deleted', TG_TABLE_NAME, OLD.id);
    v_metadata  := jsonb_build_object('old', to_jsonb(OLD));
  ELSIF TG_OP = 'UPDATE' THEN
    v_clinic_id := NEW.clinic_id;
    v_action    := TG_TABLE_NAME || '_updated';
    v_description := format('%s row %s updated', TG_TABLE_NAME, NEW.id);
    v_metadata  := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  ELSE -- INSERT
    v_clinic_id := NEW.clinic_id;
    v_action    := TG_TABLE_NAME || '_created';
    v_description := format('%s row %s created', TG_TABLE_NAME, NEW.id);
    v_metadata  := jsonb_build_object('new', to_jsonb(NEW));
  END IF;

  INSERT INTO activity_logs (action, type, actor, clinic_id, description, metadata)
  VALUES (v_action, 'financial', v_actor, v_clinic_id, v_description, v_metadata);

  RETURN coalesce(NEW, OLD);
END;
$$;

-- ── Attach triggers ─────────────────────────────────────────────────

DO $$
BEGIN
  -- payments
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments' AND table_schema = 'public') THEN
    DROP TRIGGER IF EXISTS trg_audit_payments ON payments;
    CREATE TRIGGER trg_audit_payments
      AFTER INSERT OR UPDATE OR DELETE ON payments
      FOR EACH ROW EXECUTE FUNCTION audit_payment_change();
  END IF;

  -- invoices
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices' AND table_schema = 'public') THEN
    DROP TRIGGER IF EXISTS trg_audit_invoices ON invoices;
    CREATE TRIGGER trg_audit_invoices
      AFTER INSERT OR UPDATE OR DELETE ON invoices
      FOR EACH ROW EXECUTE FUNCTION audit_payment_change();
  END IF;

  -- payment_refunds (if table exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_refunds' AND table_schema = 'public') THEN
    DROP TRIGGER IF EXISTS trg_audit_payment_refunds ON payment_refunds;
    CREATE TRIGGER trg_audit_payment_refunds
      AFTER INSERT OR UPDATE OR DELETE ON payment_refunds
      FOR EACH ROW EXECUTE FUNCTION audit_payment_change();
  END IF;
END;
$$;
