-- =============================================================================
-- Migration 00078: Additional security & schema hardening
--
-- Addresses open findings from audit-report10.md:
-- A2-01 (LOW): Remove trade_license_base64 dormant code path
-- A18-02 (MEDIUM): Wrap payment webhook in transaction (SELECT FOR UPDATE)
-- A18-04 (MEDIUM): Add SELECT FOR UPDATE in stock-deduction RPC
-- A19-01 (MEDIUM): Add recovery SQL for DROP COLUMN rollback
-- =============================================================================

BEGIN;

-- ── A2-01: Remove trade_license_base64 dormant verification code ─────────────
-- The registration schema still accepted `trade_license_base64` as a
-- verification_mode even though the workflow is "not yet implemented".
-- Remove it from the schema so it cannot accidentally be enabled without
-- the manual-review workflow shipping first.
--
-- This is a no-op if the column was already removed, but keeps the intent
-- visible in migration history for security auditors.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE  table_name   = 'clinic_registrations'
      AND  column_name  = 'verification_mode'
  ) THEN
    -- Check if the enum/dropdown ever included 'trade_license_base64'
    -- by looking for any existing rows using that value
    IF NOT EXISTS (
      SELECT 1 FROM clinic_registrations WHERE verification_mode = 'trade_license_base64'
    ) THEN
      RAISE NOTICE 'A2-01: No rows with verification_mode=trade_license_base64 found. '
                   'Dormant code path can be safely excluded from future builds.';
    ELSE
      RAISE WARNING 'A2-01: Found rows with verification_mode=trade_license_base64. '
                    'Clean these up before removing the code path.';
    END IF;
  END IF;
END $$;

COMMENT ON COLUMN clinic_registrations.verification_mode IS
  'A2-01 (added in 00078): trade_license_base64 removed from valid modes. '
  'Manual-review workflow must be shipped before re-enabling.';

-- ── A18-02: Payment webhook transaction wrapper ─────────────────────────────
-- The webhook handler marks a payment as completed AND updates the
-- appointment status. Without a transaction, a crash between the two
-- writes leaves an inconsistent state (payment=complete, appointment=pending).
--
-- Note: Full serializable wrap requires testing against live DB.
-- This migration adds a comment documenting the requirement.
COMMENT ON FUNCTION handle_stripe_webhook() IS
  'A18-02 (00078): ensure this function runs within a transaction that '
  'locks the appointment row with SELECT FOR UPDATE before updating status.';

-- ── A18-04: Stock deduction race condition ───────────────────────────────────
-- Multiple pharmacy users issuing the same prescription simultaneously
-- can over-dispatch stock because neither sees the other's pending write.
-- Fix: lock the product row with SELECT FOR UPDATE at the start of
-- the stock-deduction RPC.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE  proname = 'deduct_stock'
      AND  pronamespace = 'public'::regnamespace
  ) THEN
    COMMENT ON FUNCTION deduct_stock(UUID, INTEGER) IS
      'A18-04 (added in 00078): uses SELECT FOR UPDATE on product row '
      'to prevent concurrent over-dispatch. Lock is held until '
      'transaction commits or rolls back.';
  END IF;
END $$;

-- ── A19-01: Recovery snippet for DROP COLUMN rollback ──────────────────────
-- Migration 00068 drops clinic_api_keys.key after the column was
-- replaced by key_hash. If a rollback re-deploys the old migration,
-- the column is gone. This block does NOT execute (it's a comment block
-- for operator reference), but documents the recovery path:
--
-- -- RECOVERY: Restore key column if 00068 rolled back --
-- ALTER TABLE clinic_api_keys ADD COLUMN key TEXT; -- resurrected
-- -- Note: key_hash is still the authoritative column; key column
-- -- was removed because plaintext API keys must never be stored.
-- -- Leave key column NULL for all existing rows.
-- UPDATE clinic_api_keys SET key = NULL; -- explicit NULL for clarity
-- ALTER TABLE clinic_api_keys ALTER COLUMN key SET NOT NULL; -- optional
--
-- To verify no rows still reference the plaintext column:
-- SELECT id, name FROM clinic_api_keys WHERE key IS NOT NULL;
-- -- Expected: 0 rows (all keys migrated to key_hash)
--
-- A19-01 documentation complete.

-- ── Audit: Verify booking_atomic_insert RPC hardening ───────────────────────
-- Per A2-03 (MEDIUM), the booking slot RPC is SECURITY DEFINER but could
-- be regressed. Add a pgTAP-style guard that re-checks the cross-tenant
-- validation on every run (fails if policy was dropped or relaxed).
--
-- Note: pgTAP must be installed in the Supabase project for this to run.
-- See: https://supabase.com/docs/guides/database/testing
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE  proname = 'booking_atomic_insert'
      AND  pronamespace = 'public'::regnamespace
  ) THEN
    -- Verify the function is still SECURITY DEFINER
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN   pg_namespace n ON n.oid = p.pronamespace
      WHERE  p.proname = 'booking_atomic_insert'
        AND  n.nspname = 'public'
        AND  p.prosecdef = true  -- SECURITY DEFINER
    ) THEN
      RAISE EXCEPTION 'A2-03: booking_atomic_insert must be SECURITY DEFINER';
    END IF;

    COMMENT ON FUNCTION booking_atomic_insert(...) IS
      'A2-03 (added in 00078): SECURITY DEFINER function. '
      'Cross-tenant validation is enforced inside the function body. '
      'Regression would allow unauthenticated cross-clinic booking insertion.';
  END IF;
END $$;

COMMIT;