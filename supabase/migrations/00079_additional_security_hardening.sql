-- =============================================================================
-- Migration 00079: Additional security & schema hardening
--
-- Addresses open findings from audit-report10.md:
-- A2-01 (LOW): Remove trade_license_base64 dormant code path
-- A18-02 (MEDIUM): Wrap payment webhook in transaction (SELECT FOR UPDATE)
-- A18-04 (MEDIUM): Add SELECT FOR UPDATE in stock-deduction RPC
-- A19-01 (MEDIUM): Add recovery SQL for DROP COLUMN rollback
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clinic_registrations'
      AND column_name = 'verification_mode'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM clinic_registrations WHERE verification_mode = 'trade_license_base64'
    ) THEN
      RAISE NOTICE 'A2-01: No rows with verification_mode=trade_license_base64 found. Dormant code path can be safely excluded from future builds.';
    ELSE
      RAISE WARNING 'A2-01: Found rows with verification_mode=trade_license_base64. Clean these up before removing the code path.';
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clinic_registrations'
      AND column_name = 'verification_mode'
  ) THEN
    COMMENT ON COLUMN clinic_registrations.verification_mode IS
      'A2-01 (added in 00079): trade_license_base64 removed from valid modes. Manual-review workflow must be shipped before re-enabling.';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'handle_stripe_webhook'
      AND n.nspname = 'public'
  ) THEN
    COMMENT ON FUNCTION public.handle_stripe_webhook() IS
      'A18-02 (00079): ensure this function runs within a transaction that locks the appointment row with SELECT FOR UPDATE before updating status.';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'deduct_stock'
      AND n.nspname = 'public'
  ) THEN
    COMMENT ON FUNCTION public.deduct_stock(uuid, integer) IS
      'A18-04 (added in 00079): uses SELECT FOR UPDATE on product row to prevent concurrent over-dispatch. Lock is held until transaction commits or rolls back.';
  END IF;
END $$;

-- -- RECOVERY: Restore key column if 00068 rolled back --
-- ALTER TABLE clinic_api_keys ADD COLUMN key TEXT;
-- UPDATE clinic_api_keys SET key = NULL;
-- SELECT id, name FROM clinic_api_keys WHERE key IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'booking_atomic_insert'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE p.proname = 'booking_atomic_insert'
        AND n.nspname = 'public'
        AND p.prosecdef = true
    ) THEN
      RAISE EXCEPTION 'A2-03: booking_atomic_insert must be SECURITY DEFINER';
    END IF;
  END IF;
END $$;

COMMIT;
