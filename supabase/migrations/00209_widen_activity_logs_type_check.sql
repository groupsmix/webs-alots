-- Migration 00209: Widen the activity_logs.type CHECK constraint
--
-- Audit findings F1 / F2 / C4:
--   The previous CHECK in migration 00005 only permitted
--   ('clinic', 'billing', 'feature', 'announcement', 'template', 'auth').
--   The application writes ('booking', 'patient', 'payment', 'admin',
--   'auth', 'config', 'security'), so most audit inserts were rejected.
--
-- This migration drops the old narrow constraint and replaces it with one
-- that covers every value the application emits, preserving the legacy
-- values for backward compatibility.

BEGIN;

-- Drop the existing CHECK constraint on activity_logs.type.  The constraint
-- was created unnamed, so its auto-generated name may vary.  We locate it by
-- inspecting pg_constraint for a check constraint whose definition references
-- the "type" column.
DO $$
DECLARE
  con_name text;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'public.activity_logs'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%type%';

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.activity_logs DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

-- New constraint covers every AuditEventType used by src/lib/audit-log.ts,
-- plus the legacy values already allowed by the previous CHECK.
ALTER TABLE public.activity_logs
  ADD CONSTRAINT activity_logs_type_check
  CHECK (type IN (
    'admin',
    'announcement',
    'auth',
    'billing',
    'booking',
    'clinic',
    'config',
    'feature',
    'patient',
    'payment',
    'security',
    'template'
  ));

COMMIT;
