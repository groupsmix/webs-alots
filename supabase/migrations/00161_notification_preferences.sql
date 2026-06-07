-- Persisted user notification preferences for in-app, email, and WhatsApp delivery.

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  whatsapp_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT true,
  in_app_enabled boolean NOT NULL DEFAULT true,
  appointment_reminders boolean NOT NULL DEFAULT true,
  booking_confirmations boolean NOT NULL DEFAULT true,
  payment_receipts boolean NOT NULL DEFAULT true,
  prescription_updates boolean NOT NULL DEFAULT true,
  marketing_updates boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_preferences_user_id_key UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_clinic_id
  ON public.notification_preferences(clinic_id);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.update_notification_preferences_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notification_preferences_updated_at ON public.notification_preferences;
CREATE TRIGGER trg_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_notification_preferences_updated_at();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notification_preferences'
      AND policyname = 'super_admin_notification_preferences_all'
  ) THEN
    CREATE POLICY super_admin_notification_preferences_all
      ON public.notification_preferences
      FOR ALL
      TO authenticated
      USING (is_super_admin())
      WITH CHECK (is_super_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notification_preferences'
      AND policyname = 'user_own_notification_preferences'
  ) THEN
    CREATE POLICY user_own_notification_preferences
      ON public.notification_preferences
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.users u
          WHERE u.id = notification_preferences.user_id
            AND u.auth_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.users u
          WHERE u.id = notification_preferences.user_id
            AND u.auth_id = auth.uid()
        )
      );
  END IF;
END
$$;
