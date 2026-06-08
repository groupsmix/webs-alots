-- 00166: AI-generated daily clinic briefings for executive analytics
-- Supports Feature 4: Executive Clinic Analytics

-- Create clinic_ai_briefings table
CREATE TABLE IF NOT EXISTS clinic_ai_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  briefing_date DATE NOT NULL,
  content TEXT NOT NULL,
  metrics_snapshot JSONB,
  overall_sentiment TEXT CHECK (overall_sentiment IN ('positive', 'neutral', 'concerning', 'critical')),
  ai_model TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(clinic_id, briefing_date)
);

-- Index for efficient date-based queries per clinic
CREATE INDEX IF NOT EXISTS idx_clinic_ai_briefings_clinic_date
  ON clinic_ai_briefings(clinic_id, briefing_date DESC);

-- Enable Row Level Security
ALTER TABLE clinic_ai_briefings ENABLE ROW LEVEL SECURITY;

-- Clinic admins can read their own clinic's briefings
DO $$ BEGIN
  CREATE POLICY "clinic_ai_briefings_clinic_admin_select"
    ON clinic_ai_briefings FOR SELECT
    USING (
      clinic_id = get_request_clinic_id()
      AND auth.role() = 'authenticated'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Super admins can read all briefings (global context — no clinic_id filter needed)
DO $$ BEGIN
  CREATE POLICY "clinic_ai_briefings_super_admin_select"
    ON clinic_ai_briefings FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
          AND users.role = 'super_admin'
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Service role handles inserts from cron job
-- (service_role bypasses RLS by default)

COMMENT ON TABLE clinic_ai_briefings IS
  'AI-generated daily executive briefings per clinic. Generated at 6:00 Africa/Casablanca by the ai-clinic-briefings cron job.';

COMMENT ON COLUMN clinic_ai_briefings.metrics_snapshot IS
  'Raw clinic metrics used to generate this briefing (aggregate numbers only, no PHI)';

COMMENT ON COLUMN clinic_ai_briefings.overall_sentiment IS
  'AI-assessed overall clinic performance sentiment for the day';
