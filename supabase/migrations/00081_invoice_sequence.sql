-- Migration: 00081_invoice_sequence.sql
-- F-A164: Enforce monotonic invoice number sequences per clinic per year.
--
-- Moroccan DGI (Direction Générale des Impôts) requires that invoice numbers:
--   1. Are strictly sequential (no gaps, no reuse).
--   2. Are unique per fiscal year per clinic.
--   3. Cannot be backdated or renumbered.
--
-- Implementation: per-clinic per-year counter table protected by
-- Postgres advisory locks so concurrent inserts never collide.
-- The invoice_number column is given a GENERATED format:
--   FAC-{YYYY}-{NNNNN}  e.g. FAC-2025-00001

-- ── 1. Counter table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_sequences (
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  fiscal_year INT  NOT NULL CHECK (fiscal_year >= 2024),
  last_number INT  NOT NULL DEFAULT 0 CHECK (last_number >= 0),
  PRIMARY KEY (clinic_id, fiscal_year)
);

-- RLS: only service-role and the issuing clinic can read/write
ALTER TABLE invoice_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoice_sequences_clinic_admin" ON invoice_sequences;
CREATE POLICY "invoice_sequences_clinic_admin"
  ON invoice_sequences
  FOR ALL
  USING (
    auth.uid() IS NOT NULL
    AND (
      -- Service role bypasses RLS
      current_setting('request.jwt.claim.role', true) = 'service_role'
      OR clinic_id = (
        SELECT clinic_id FROM users WHERE auth_id = auth.uid() LIMIT 1
      )
    )
  );

-- ── 2. Sequence-generating RPC ───────────────────────────────────────
-- Returns the next formatted invoice number for a clinic/year.
-- Uses a transaction-level advisory lock keyed on (clinic_id, fiscal_year)
-- so concurrent calls never produce the same number.
CREATE OR REPLACE FUNCTION next_invoice_number(p_clinic_id UUID, p_year INT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INT := COALESCE(p_year, EXTRACT(YEAR FROM NOW())::INT);
  v_seq  INT;
  v_lock_key BIGINT;
BEGIN
  -- Derive a stable advisory lock key from the UUID + year
  -- (hash to BIGINT, no cross-clinic collision risk)
  v_lock_key := hashtext(p_clinic_id::TEXT || '-' || v_year::TEXT);

  -- Acquire a transaction-level advisory lock
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Upsert the counter and atomically increment
  INSERT INTO invoice_sequences (clinic_id, fiscal_year, last_number)
    VALUES (p_clinic_id, v_year, 1)
  ON CONFLICT (clinic_id, fiscal_year)
  DO UPDATE SET last_number = invoice_sequences.last_number + 1
  RETURNING last_number INTO v_seq;

  -- Format: FAC-YYYY-NNNNN  (zero-padded to 5 digits)
  RETURN 'FAC-' || v_year || '-' || LPAD(v_seq::TEXT, 5, '0');
END;
$$;

-- ── 3. Constrain the invoices table ──────────────────────────────────
-- Add generated-format check so raw TEXT inserts cannot bypass the RPC.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices') THEN
    -- Unique constraint: (clinic_id, invoice_number) — no reuse, no cross-tenant collision
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_name = 'invoices'
        AND constraint_name = 'invoices_clinic_invoice_number_unique'
    ) THEN
      ALTER TABLE invoices
        ADD CONSTRAINT invoices_clinic_invoice_number_unique
        UNIQUE (clinic_id, invoice_number);
    END IF;

    -- Check constraint: enforce FAC-YYYY-NNNNN format
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.check_constraints
      WHERE constraint_name = 'invoices_invoice_number_format'
    ) THEN
      ALTER TABLE invoices
        ADD CONSTRAINT invoices_invoice_number_format
        CHECK (invoice_number ~ '^FAC-[0-9]{4}-[0-9]{5}$');
    END IF;
  END IF;
END;
$$;

-- Grant EXECUTE to authenticated role so app layer can call via RPC
GRANT EXECUTE ON FUNCTION next_invoice_number(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION next_invoice_number(UUID, INT) TO service_role;
