-- M-8 / 1.2: Add scopes column to clinic_api_keys for scope enforcement.
-- Allows API keys to be restricted to specific operation types (e.g. "read", "write").
-- Existing keys get NULL scopes which means "unrestricted" (backward-compatible).

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clinic_api_keys' AND column_name = 'scopes'
  ) THEN
    ALTER TABLE clinic_api_keys ADD COLUMN scopes TEXT[] DEFAULT NULL;
    RAISE NOTICE 'M-8: Added scopes column to clinic_api_keys';
  END IF;
END $$;
