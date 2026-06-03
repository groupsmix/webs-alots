-- Migration: Sequential Invoices for Moroccan Tax Compliance
-- Description: Ensures gap-free, sequential invoice numbering per clinic.

-- 1. Create table for tracking invoice sequences
CREATE TABLE IF NOT EXISTS invoice_sequences (
  clinic_id UUID PRIMARY KEY REFERENCES clinics(id) ON DELETE CASCADE,
  next_number INTEGER NOT NULL DEFAULT 1,
  prefix TEXT NOT NULL DEFAULT 'CLN',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for sequences
ALTER TABLE invoice_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their clinic's sequence"
  ON invoice_sequences FOR SELECT
  TO authenticated
  USING (
    clinic_id = (SELECT current_setting('request.header.x-clinic-id', true)::uuid)
  );

-- Only service_role can update sequences directly, application logic will use the function
CREATE POLICY "Service role full access"
  ON invoice_sequences FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- 2. Create function to generate sequential invoice number safely
CREATE OR REPLACE FUNCTION generate_invoice_number(target_clinic_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  seq_record RECORD;
  new_number INTEGER;
  year_str TEXT;
  invoice_num TEXT;
BEGIN
  -- Lock the row for this clinic to prevent race conditions
  -- If row doesn't exist, this will skip the lock and fall through to the INSERT
  SELECT * INTO seq_record 
  FROM invoice_sequences 
  WHERE clinic_id = target_clinic_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Initialize sequence for new clinic
    INSERT INTO invoice_sequences (clinic_id, next_number)
    VALUES (target_clinic_id, 2)
    RETURNING * INTO seq_record;
    
    new_number := 1;
  ELSE
    new_number := seq_record.next_number;
    
    UPDATE invoice_sequences
    SET next_number = next_number + 1,
        updated_at = NOW()
    WHERE clinic_id = target_clinic_id;
  END IF;

  year_str := to_char(NOW(), 'YYYY');
  -- Format: CLN-2026-000042
  invoice_num := seq_record.prefix || '-' || year_str || '-' || LPAD(new_number::TEXT, 6, '0');
  
  RETURN invoice_num;
END;
$$;

-- 3. Trigger to auto-assign invoice_number if not provided on INSERT to invoices table
-- Note: Assuming the invoices table exists. If it doesn't, this trigger will need to be created when the table is created.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices') THEN
    -- We use an anonymous block because 'invoices' table existence might vary during migrations
    EXECUTE '
      CREATE OR REPLACE FUNCTION trigger_set_invoice_number()
      RETURNS TRIGGER AS $inner$
      BEGIN
        IF NEW.invoice_number IS NULL THEN
          NEW.invoice_number := generate_invoice_number(NEW.clinic_id);
        END IF;
        RETURN NEW;
      END;
      $inner$ LANGUAGE plpgsql;
      
      DROP TRIGGER IF EXISTS trg_set_invoice_number ON invoices;
      CREATE TRIGGER trg_set_invoice_number
      BEFORE INSERT ON invoices
      FOR EACH ROW
      EXECUTE FUNCTION trigger_set_invoice_number();
    ';
  END IF;
END $$;
