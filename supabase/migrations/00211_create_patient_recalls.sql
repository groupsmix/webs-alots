-- Migration 00211: Create patient_recalls table with tenant-scoped RLS
--
-- The recall engine (dental differentiator) brings patients back for
-- recurring care — détartrage every ~6 months, monthly orthodontic
-- follow-ups, implant controls. A recall row is generated when an
-- appointment for a recall-eligible service is completed, and a
-- WhatsApp message is dispatched once `due_date` is reached.
--
-- The table references patient/appointment/service IDs (Lane-A personal
-- data, no clinical content) so it must be created with clinic_id tenant
-- isolation, mirroring 00210_create_rebooking_requests.sql.

BEGIN;

CREATE TABLE IF NOT EXISTS public.patient_recalls (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id             UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id            UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source_appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  booked_appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  service_id            UUID REFERENCES public.services(id) ON DELETE SET NULL,
  recall_type           TEXT NOT NULL,
  due_date              DATE NOT NULL,
  status                TEXT NOT NULL DEFAULT 'pending',
  sent_at               TIMESTAMPTZ,
  notification_queue_id UUID,
  metadata              JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotent generation: one recall per (clinic, source appointment, type).
-- NULLs are distinct, so manually-created recalls (no source appointment)
-- are never blocked by this constraint.
CREATE UNIQUE INDEX IF NOT EXISTS uq_patient_recalls_source
  ON public.patient_recalls (clinic_id, source_appointment_id, recall_type);

CREATE INDEX IF NOT EXISTS idx_patient_recalls_clinic_id  ON public.patient_recalls(clinic_id);
CREATE INDEX IF NOT EXISTS idx_patient_recalls_patient_id ON public.patient_recalls(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_recalls_status     ON public.patient_recalls(status);
CREATE INDEX IF NOT EXISTS idx_patient_recalls_due_date   ON public.patient_recalls(due_date);
CREATE INDEX IF NOT EXISTS idx_patient_recalls_due_dispatch
  ON public.patient_recalls(clinic_id, status, due_date);

ALTER TABLE public.patient_recalls ENABLE ROW LEVEL SECURITY;

-- Service role (cron) is fully privileged once it has resolved the clinic;
-- it always filters by clinic_id in application code.
DROP POLICY IF EXISTS patient_recalls_service_all ON public.patient_recalls;
CREATE POLICY patient_recalls_service_all
  ON public.patient_recalls
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated clinic staff may only access rows belonging to their clinic.
DROP POLICY IF EXISTS patient_recalls_staff_all ON public.patient_recalls;
CREATE POLICY patient_recalls_staff_all
  ON public.patient_recalls
  FOR ALL
  USING (
    clinic_id = get_user_clinic_id()
    AND is_clinic_staff()
  )
  WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND is_clinic_staff()
  );

-- Super-admins can read/modify recalls for support.
DROP POLICY IF EXISTS patient_recalls_super_admin_all ON public.patient_recalls;
CREATE POLICY patient_recalls_super_admin_all
  ON public.patient_recalls
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

COMMENT ON TABLE public.patient_recalls IS
  'Recurring dental recall campaigns (détartrage / orthodontic / implant follow-ups). Generated on appointment completion, dispatched via WhatsApp when due_date is reached.';

COMMIT;
