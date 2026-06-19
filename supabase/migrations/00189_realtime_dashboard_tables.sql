-- 00189_realtime_dashboard_tables.sql
--
-- Enable Supabase Realtime for the admin & doctor dashboards.
--
-- The dashboards subscribe to `appointments` (bookings + status changes) and
-- `payments` (revenue) through postgres_changes, scoped per clinic by RLS
-- and a `clinic_id=eq.<id>` filter. Before this migration only
-- `patient_vitals` and `waiting_queue` were members of the
-- `supabase_realtime` publication, so appointment/payment changes were never
-- broadcast — the receptionist waiting room's `appointments` subscription
-- silently received nothing.
--
-- Idempotent: `ALTER PUBLICATION ... ADD TABLE` raises if the table is
-- already a member, so each add is guarded by a membership check. Safe to
-- re-run.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'appointments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'payments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
  END IF;
END $$;
