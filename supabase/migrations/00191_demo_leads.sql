-- 00191: Demo-request leads from the public marketing landing page
--
-- The oltigo landing CTA (src/components/landing/oltigo/.../cta-demo.tsx)
-- collects prospective-clinic demo requests. These are PLATFORM-LEVEL leads:
-- the submitter is not yet a tenant, so the row carries no clinic_id. This
-- mirrors other platform tables (uptime_events, revenue_snapshots) that are
-- intentionally cross-tenant and consumed by super_admins.
--
-- Writes happen server-side via POST /api/leads using the service-role
-- client (RLS-bypassing) after Zod validation; the table is otherwise only
-- readable by super_admins. All operations are idempotent.

CREATE TABLE IF NOT EXISTS public.demo_leads (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_name  TEXT        NOT NULL,
  contact_name TEXT        NOT NULL,
  phone        TEXT        NOT NULL,
  email        TEXT        NOT NULL,
  city         TEXT,
  locale       TEXT,
  source       TEXT        NOT NULL DEFAULT 'landing_demo_cta',
  status       TEXT        NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'rejected')),
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sales triage: newest-first listing of open leads per status.
CREATE INDEX IF NOT EXISTS idx_demo_leads_status_created
  ON public.demo_leads(status, created_at DESC);

-- ── Row-Level Security ──────────────────────────────────────────────────────
-- Service-role inserts (POST /api/leads) bypass RLS. Authenticated access is
-- limited to super_admins, who triage leads from the platform console. There
-- is no anon/clinic policy: prospects never read this table back.

ALTER TABLE public.demo_leads ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'demo_leads' AND policyname = 'super_admin_demo_leads_all'
  ) THEN
    CREATE POLICY super_admin_demo_leads_all
      ON public.demo_leads
      FOR ALL
      TO authenticated
      USING (is_super_admin())
      WITH CHECK (is_super_admin());
  END IF;
END $$;
