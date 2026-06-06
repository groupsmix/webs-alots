-- Site Team Agent: role-based AI assistant conversations, messages and config.
-- Adapted from the Supabase chatbot history schema with Oltigo tenant isolation.

-- ── Agent conversations ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_type text NOT NULL CHECK (agent_type IN (
    'doctor', 'secretary', 'receptionist', 'clinic_admin', 'super_admin', 'patient'
  )),
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_conversations_clinic
  ON agent_conversations(clinic_id, agent_type);

CREATE INDEX IF NOT EXISTS idx_agent_conversations_user
  ON agent_conversations(clinic_id, user_id, updated_at DESC);

ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'agent_conversations'
      AND policyname = 'agent_conversations_super_admin_all'
  ) THEN
    CREATE POLICY agent_conversations_super_admin_all
      ON agent_conversations
      FOR ALL
      USING (is_super_admin())
      WITH CHECK (is_super_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'agent_conversations'
      AND policyname = 'agent_conversations_user_own'
  ) THEN
    CREATE POLICY agent_conversations_user_own
      ON agent_conversations
      FOR ALL
      USING (
        user_id = get_my_user_id()
        AND clinic_id = get_user_clinic_id()
        AND clinic_id = get_request_clinic_id()
        AND (
          agent_type = get_user_role()
          OR (get_user_role() = 'receptionist' AND agent_type IN ('secretary', 'receptionist'))
        )
      )
      WITH CHECK (
        user_id = get_my_user_id()
        AND clinic_id = get_user_clinic_id()
        AND clinic_id = get_request_clinic_id()
        AND (
          agent_type = get_user_role()
          OR (get_user_role() = 'receptionist' AND agent_type IN ('secretary', 'receptionist'))
        )
      );
  END IF;
END
$$;

-- ── Agent messages ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content text NOT NULL,
  tool_name text,
  tool_result jsonb,
  tokens_used integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_messages_conv
  ON agent_messages(conversation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_agent_messages_clinic
  ON agent_messages(clinic_id, created_at DESC);

ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'agent_messages'
      AND policyname = 'agent_messages_super_admin_all'
  ) THEN
    CREATE POLICY agent_messages_super_admin_all
      ON agent_messages
      FOR ALL
      USING (is_super_admin())
      WITH CHECK (is_super_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'agent_messages'
      AND policyname = 'agent_messages_user_own_conversation'
  ) THEN
    CREATE POLICY agent_messages_user_own_conversation
      ON agent_messages
      FOR ALL
      USING (
        clinic_id = get_user_clinic_id()
        AND clinic_id = get_request_clinic_id()
        AND EXISTS (
          SELECT 1
          FROM agent_conversations c
          WHERE c.id = agent_messages.conversation_id
            AND c.clinic_id = agent_messages.clinic_id
            AND c.user_id = get_my_user_id()
        )
      )
      WITH CHECK (
        clinic_id = get_user_clinic_id()
        AND clinic_id = get_request_clinic_id()
        AND EXISTS (
          SELECT 1
          FROM agent_conversations c
          WHERE c.id = agent_messages.conversation_id
            AND c.clinic_id = agent_messages.clinic_id
            AND c.user_id = get_my_user_id()
        )
      );
  END IF;
END
$$;

-- ── Per-clinic agent configuration ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clinic_agent_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  agent_type text NOT NULL CHECK (agent_type IN (
    'doctor', 'secretary', 'receptionist', 'clinic_admin', 'super_admin', 'patient'
  )),
  is_enabled boolean NOT NULL DEFAULT true,
  model text NOT NULL DEFAULT 'claude-sonnet-4-20250514',
  custom_prompt text,
  tools_enabled text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, agent_type)
);

CREATE INDEX IF NOT EXISTS idx_clinic_agent_configs_clinic
  ON clinic_agent_configs(clinic_id, agent_type);

ALTER TABLE clinic_agent_configs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'clinic_agent_configs'
      AND policyname = 'clinic_agent_configs_super_admin_all'
  ) THEN
    CREATE POLICY clinic_agent_configs_super_admin_all
      ON clinic_agent_configs
      FOR ALL
      USING (is_super_admin())
      WITH CHECK (is_super_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'clinic_agent_configs'
      AND policyname = 'clinic_agent_configs_clinic_admin_all'
  ) THEN
    CREATE POLICY clinic_agent_configs_clinic_admin_all
      ON clinic_agent_configs
      FOR ALL
      USING (
        clinic_id = get_user_clinic_id()
        AND clinic_id = get_request_clinic_id()
        AND get_user_role() = 'clinic_admin'
      )
      WITH CHECK (
        clinic_id = get_user_clinic_id()
        AND clinic_id = get_request_clinic_id()
        AND get_user_role() = 'clinic_admin'
      );
  END IF;
END
$$;

-- ── Token usage tracker ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_token_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  agent_type text NOT NULL CHECK (agent_type IN (
    'doctor', 'secretary', 'receptionist', 'clinic_admin', 'super_admin', 'patient'
  )),
  date date NOT NULL DEFAULT CURRENT_DATE,
  tokens_in integer NOT NULL DEFAULT 0,
  tokens_out integer NOT NULL DEFAULT 0,
  request_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, agent_type, date)
);

CREATE INDEX IF NOT EXISTS idx_agent_token_usage_clinic_date
  ON agent_token_usage(clinic_id, date DESC);

ALTER TABLE agent_token_usage ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'agent_token_usage'
      AND policyname = 'agent_token_usage_super_admin_all'
  ) THEN
    CREATE POLICY agent_token_usage_super_admin_all
      ON agent_token_usage
      FOR ALL
      USING (is_super_admin())
      WITH CHECK (is_super_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'agent_token_usage'
      AND policyname = 'agent_token_usage_clinic_admin_read'
  ) THEN
    CREATE POLICY agent_token_usage_clinic_admin_read
      ON agent_token_usage
      FOR SELECT
      USING (
        clinic_id = get_user_clinic_id()
        AND clinic_id = get_request_clinic_id()
        AND get_user_role() = 'clinic_admin'
      );
  END IF;
END
$$;
