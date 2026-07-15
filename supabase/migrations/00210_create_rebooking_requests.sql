-- Migration 00210: Create rebooking_requests table with tenant-scoped RLS
--
-- Audit finding F4: the application references `rebooking_requests` in
-- src/app/api/webhooks/route.ts, src/app/api/doctor-unavailability/route.ts,
-- and src/app/api/cron/rebooking-reminders/route.ts, but no migration or
-- versioned RLS policy existed for the table.  It stores PHI-referencing
-- appointment/patient/doctor IDs, so it must be created with clinic_id
-- tenant isolation.

BEGIN;

CREATE TABLE IF NOT EXISTS public.rebooking_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id    UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  unavailability_id UUID,
  clinic_id         UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  doctor_id         UUID REFERENCES public.users(id) ON DELETE SET NULL,
  patient_id        UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status            TEXT NOT NULL DEFAULT 'pending',
  alternatives      JSONB,
  selected_option   INTEGER,
  sent_at           TIMESTAMPTZ,
  reminded_at       TIMESTAMPTZ,
  rebooked_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rebooking_requests_clinic_id     ON public.rebooking_requests(clinic_id);
CREATE INDEX IF NOT EXISTS idx_rebooking_requests_appointment_id ON public.rebooking_requests(appointment_id);
CREATE INDEX IF NOT EXISTS idx_rebooking_requests_doctor_id     ON public.rebooking_requests(doctor_id);
CREATE INDEX IF NOT EXISTS idx_rebooking_requests_patient_id    ON public.rebooking_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_rebooking_requests_status        ON public.rebooking_requests(status);
CREATE INDEX IF NOT EXISTS idx_rebooking_requests_created_at    ON public.rebooking_requests(created_at DESC);

ALTER TABLE public.rebooking_requests ENABLE ROW LEVEL SECURITY;

-- Service role (cron, webhooks) is fully privileged once it has resolved the
-- clinic; it always filters by clinic_id in application code.
CREATE POLICY IF NOT EXISTS rebooking_requests_service_all
  ON public.rebooking_requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated clinic staff may only access rows belonging to their clinic.
CREATE POLICY IF NOT EXISTS rebooking_requests_staff_all
  ON public.rebooking_requests
  FOR ALL
  USING (
    clinic_id = get_user_clinic_id()
    AND is_clinic_staff()
  )
  WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND is_clinic_staff()
  );

-- Super-admins can read/modify rebooking requests for support.
CREATE POLICY IF NOT EXISTS rebooking_requests_super_admin_all
  ON public.rebooking_requests
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

COMMENT ON TABLE public.rebooking_requests IS
  'Tracks alternative slots offered to patients when a doctor becomes unavailable, and their rebooking responses.';

COMMIT;
