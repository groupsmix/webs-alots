-- A247.4 D+8-30: Per-clinic per-year invoice numbering.
--
-- Ensures each clinic gets a gap-free, sequential invoice number per
-- calendar year. The UNIQUE constraint prevents duplicates even under
-- concurrent inserts.
--
-- Column: invoices.invoice_number (text, e.g. "INV-2026-00042")
-- Sequence: derived from a per-clinic counter stored in clinic_invoice_counters.

-- ── Counter table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clinic_invoice_counters (
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  year      int  NOT NULL CHECK (year >= 2020 AND year <= 2100),
  counter   int  NOT NULL DEFAULT 0 CHECK (counter >= 0),
  PRIMARY KEY (clinic_id, year)
);

-- RLS: only service-role / SECURITY DEFINER functions should touch this.
ALTER TABLE clinic_invoice_counters ENABLE ROW LEVEL SECURITY;

-- ── UNIQUE constraint on invoices ───────────────────────────────────

DO $$
BEGIN
  -- Add invoice_number column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'invoice_number' AND table_schema = 'public'
  ) THEN
    ALTER TABLE invoices ADD COLUMN invoice_number text;
  END IF;

  -- Add year column if missing (derived from created_at)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'invoice_year' AND table_schema = 'public'
  ) THEN
    ALTER TABLE invoices ADD COLUMN invoice_year int
      GENERATED ALWAYS AS (extract(year from created_at)::int) STORED;
  END IF;

  -- Unique constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_invoices_clinic_year_number'
  ) THEN
    ALTER TABLE invoices
      ADD CONSTRAINT uq_invoices_clinic_year_number
      UNIQUE (clinic_id, invoice_year, invoice_number);
  END IF;
END;
$$;

-- ── Function to allocate the next invoice number ────────────────────

CREATE OR REPLACE FUNCTION next_invoice_number(p_clinic_id uuid, p_year int DEFAULT extract(year from now())::int)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next int;
BEGIN
  INSERT INTO clinic_invoice_counters (clinic_id, year, counter)
  VALUES (p_clinic_id, p_year, 1)
  ON CONFLICT (clinic_id, year)
  DO UPDATE SET counter = clinic_invoice_counters.counter + 1
  RETURNING counter INTO v_next;

  RETURN format('INV-%s-%s', p_year, lpad(v_next::text, 5, '0'));
END;
$$;
