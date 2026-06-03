-- Add 'reminded' to appointments status check constraint
DO $$
DECLARE
    c_name text;
BEGIN
    SELECT constraint_name INTO c_name
    FROM information_schema.constraint_column_usage
    WHERE table_name = 'appointments' AND column_name = 'status';

    IF c_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE appointments DROP CONSTRAINT ' || c_name;
    END IF;
END $$;

ALTER TABLE appointments ADD CONSTRAINT appointments_status_check
CHECK (status IN ('pending', 'confirmed', 'reminded', 'checked_in', 'in_progress', 'completed', 'no_show', 'cancelled', 'rescheduled'));
