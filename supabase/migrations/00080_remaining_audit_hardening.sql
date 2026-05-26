-- =============================================================================
-- Migration 00080: Remaining audit hardening
--
-- F-A16-03: CHECK (slot_end > slot_start) on appointments
-- F-A16-04: CHECK (price >= 0) on services
-- =============================================================================

-- F-A16-03: Ensure appointment slot_end is after slot_start
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_slot_end_after_start'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'appointments' AND column_name = 'slot_start'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'appointments' AND column_name = 'slot_end'
    ) THEN
      ALTER TABLE appointments
        ADD CONSTRAINT chk_slot_end_after_start
        CHECK (slot_end > slot_start);
    END IF;
  END IF;
END $$;

-- F-A16-04: Ensure service price is non-negative
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_price_non_negative'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'services' AND column_name = 'price'
    ) THEN
      ALTER TABLE services
        ADD CONSTRAINT chk_price_non_negative
        CHECK (price >= 0);
    END IF;
  END IF;
END $$;
