-- =============================================================================
-- Migration 00095: Enforce soft-delete filter in public_clinic_directory view
--
-- S1-A27-01: The `deleted_at` column was added to `clinics` in migration
-- 00071 but no query (including this view) filters by `deleted_at IS NULL`.
-- A soft-deleted clinic still resolves via subdomain and can accept bookings.
--
-- This migration:
--   1. Recreates `public_clinic_directory` with `deleted_at IS NULL`
--   2. Adds NUMERIC(12,2) precision to bare money columns (S1-A29-01)
--   3. Adds CHECK constraints on monetary non-negativity (S1-A29-07)
-- =============================================================================

BEGIN;

-- ── 1. Soft-delete enforcement on public_clinic_directory ──────────────────

DROP VIEW IF EXISTS public_clinic_directory;

CREATE VIEW public_clinic_directory AS
SELECT id, name, subdomain, type, tier, status, patient_message_locale
FROM clinics
WHERE status = 'active'
  AND deleted_at IS NULL;

GRANT SELECT ON public_clinic_directory TO anon;

-- ── 2. Fix bare NUMERIC columns on invoices / invoice_items / lab_tests ────
-- S1-A29-01 / S1-A16-01: Unbounded NUMERIC wastes index space and is
-- inconsistent with NUMERIC(10,2) / NUMERIC(12,2) used elsewhere.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices') THEN
    ALTER TABLE invoices ALTER COLUMN amount TYPE NUMERIC(12,2);
    ALTER TABLE invoices ALTER COLUMN tax TYPE NUMERIC(12,2);
    ALTER TABLE invoices ALTER COLUMN total TYPE NUMERIC(12,2);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoice_items') THEN
    ALTER TABLE invoice_items ALTER COLUMN quantity TYPE NUMERIC(12,2);
    ALTER TABLE invoice_items ALTER COLUMN unit_price TYPE NUMERIC(12,2);
    ALTER TABLE invoice_items ALTER COLUMN total TYPE NUMERIC(12,2);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lab_tests') THEN
    ALTER TABLE lab_tests ALTER COLUMN price TYPE NUMERIC(12,2);
  END IF;
END $$;

-- ── 3. Monetary non-negativity CHECK constraints ──────────────────────────
-- S1-A29-07 / S1-A10-06: Prevent negative refund amounts at DB level.

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'refunded_amount'
  ) THEN
    ALTER TABLE payments
      DROP CONSTRAINT IF EXISTS chk_refunded_amount_non_negative,
      ADD CONSTRAINT chk_refunded_amount_non_negative CHECK (refunded_amount >= 0);
  END IF;
END $$;

COMMIT;
