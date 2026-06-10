-- 00176_ai_team_tasks.sql
-- Phase C1: Durable AI team tasks with state machine, review cycle, and history events.
-- Replaces the simple ai_agent_tasks with a proper workflow.

-- ── Table: ai_team_tasks ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_team_tasks') THEN
    CREATE TABLE ai_team_tasks (
      id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id       uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
      title           text NOT NULL,
      description     text,
      agent_type      text NOT NULL,
      status          text NOT NULL DEFAULT 'backlog'
                      CHECK (status IN ('backlog','in_progress','review','changes_requested','done','cancelled')),
      reviewer_agent_type text,
      output          jsonb DEFAULT '{}'::jsonb,
      review_comments text,
      review_cycles   integer NOT NULL DEFAULT 0,
      history_events  jsonb[] DEFAULT '{}',
      created_by      uuid,
      source_task_id  uuid REFERENCES ai_team_tasks(id),
      created_at      timestamptz NOT NULL DEFAULT now(),
      updated_at      timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END $$;

-- ── Indexes ──
CREATE INDEX IF NOT EXISTS idx_ai_team_tasks_clinic_status
  ON ai_team_tasks (clinic_id, status);

CREATE INDEX IF NOT EXISTS idx_ai_team_tasks_clinic_agent
  ON ai_team_tasks (clinic_id, agent_type);

CREATE INDEX IF NOT EXISTS idx_ai_team_tasks_source
  ON ai_team_tasks (source_task_id)
  WHERE source_task_id IS NOT NULL;

-- ── RLS ──
ALTER TABLE ai_team_tasks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ai_team_tasks' AND policyname = 'ai_team_tasks_clinic_isolation'
  ) THEN
    CREATE POLICY ai_team_tasks_clinic_isolation ON ai_team_tasks
      USING (clinic_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'clinic_id')::uuid);
  END IF;
END $$;

-- ── Updated_at trigger ──
CREATE OR REPLACE FUNCTION update_ai_team_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_team_tasks_updated_at ON ai_team_tasks;
CREATE TRIGGER trg_ai_team_tasks_updated_at
  BEFORE UPDATE ON ai_team_tasks
  FOR EACH ROW EXECUTE FUNCTION update_ai_team_tasks_updated_at();
