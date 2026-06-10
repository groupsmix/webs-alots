-- 00178_ai_task_configs.sql
-- Per-task AI model routing: lets super admins pin a specific provider/model
-- for each AI task type (chatbot conversation, summarization, classification,
-- etc.) instead of relying purely on the global provider priority order.
--
-- A NULL pinned_provider means "auto" — the router's normal tier-based
-- selection applies. A pinned task that targets an unavailable provider
-- falls back to auto routing rather than failing the request.

-- ── Table: ai_task_configs ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_task_configs') THEN
    CREATE TABLE ai_task_configs (
      id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      task_type       text NOT NULL UNIQUE
                      CHECK (task_type IN (
                        'classify','summarize','generate','translate',
                        'analyze','reason','code','conversation'
                      )),
      -- NULL = auto (router decides). Must match a provider in the registry.
      pinned_provider text
                      CHECK (pinned_provider IS NULL OR pinned_provider IN (
                        'workers_ai','anthropic','google','deepseek',
                        'groq','openai','mistral','xai'
                      )),
      -- NULL = provider's registry default model. Validated against the
      -- model allowlist at the API layer (single source of truth in code).
      pinned_model    text,
      is_active       boolean NOT NULL DEFAULT true,
      updated_by      uuid,
      created_at      timestamptz NOT NULL DEFAULT now(),
      updated_at      timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END $$;

-- ── Seed: one row per task type, all auto ──
INSERT INTO ai_task_configs (task_type)
VALUES
  ('classify'), ('summarize'), ('generate'), ('translate'),
  ('analyze'), ('reason'), ('code'), ('conversation')
ON CONFLICT (task_type) DO NOTHING;

-- ── RLS: service-role only (no policies — same posture as ai_provider_configs) ──
ALTER TABLE ai_task_configs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ai_task_configs FROM authenticated;
REVOKE ALL ON ai_task_configs FROM anon;

-- ── Updated_at trigger ──
CREATE OR REPLACE FUNCTION update_ai_task_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_task_configs_updated_at ON ai_task_configs;
CREATE TRIGGER trg_ai_task_configs_updated_at
  BEFORE UPDATE ON ai_task_configs
  FOR EACH ROW EXECUTE FUNCTION update_ai_task_configs_updated_at();
