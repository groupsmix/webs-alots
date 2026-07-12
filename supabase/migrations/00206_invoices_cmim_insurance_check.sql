-- Allow CMIM (mutuelle / complementary insurance) on invoices.
-- The invoice creation schema already accepts CMIM, but the DB check constraint
-- from migration 00108 was missing it.

DO $$ DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'invoices'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%insurance_type%'
    AND pg_get_constraintdef(oid) LIKE '%CNSS%'
    AND pg_get_constraintdef(oid) LIKE '%CNOPS%'
    AND pg_get_constraintdef(oid) LIKE '%AMO%'
    AND pg_get_constraintdef(oid) LIKE '%RAMED%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE invoices DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_insurance_type_check
  CHECK (insurance_type IS NULL OR insurance_type IN ('CNSS', 'CNOPS', 'AMO', 'RAMED', 'CMIM'));
