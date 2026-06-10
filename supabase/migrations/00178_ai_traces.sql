-- 00178: AI per-request tracing table (Phase E1)
-- Metadata only — NO prompt/response bodies (PHI risk).

CREATE TABLE IF NOT EXISTS public.ai_traces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id),
  feature text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  fallback_chain jsonb DEFAULT '[]',
  input_tokens int DEFAULT 0,
  output_tokens int DEFAULT 0,
  latency_ms int DEFAULT 0,
  ttft_ms int,
  status text NOT NULL DEFAULT 'ok'
    CHECK (status IN ('ok','validation_failed','all_providers_failed','rate_limited','error')),
  error_code text,
  cost_cents numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Indexes for admin queries
CREATE INDEX IF NOT EXISTS idx_ai_traces_clinic_created
  ON public.ai_traces(clinic_id, created_at DESC)
  WHERE clinic_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_traces_feature_created
  ON public.ai_traces(feature, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_traces_provider_status
  ON public.ai_traces(provider, status, created_at DESC);

-- RLS: clinic-scoped read for admins, super-admin reads all
ALTER TABLE public.ai_traces ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_traces_clinic_read ON public.ai_traces
  FOR SELECT
  USING (
    clinic_id = get_request_clinic_id()
    OR is_super_admin()
  );

CREATE POLICY ai_traces_insert_service ON public.ai_traces
  FOR INSERT
  WITH CHECK (true);

-- 90-day retention: old rows cleaned by maintenance cron
-- (The cron route will DELETE WHERE created_at < now() - interval '90 days')
