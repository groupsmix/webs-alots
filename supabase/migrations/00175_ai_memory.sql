-- Migration 00175: AI Memory — per-clinic durable facts
--
-- Phase B3: Stores clinic-level non-PHI facts extracted from
-- conversations. Auto-extracted after turns, periodically consolidated.
--
-- REVERSIBLE: DROP TABLE ai_memories;
-- IDEMPOTENT: All statements guarded with IF NOT EXISTS / IF EXISTS.

CREATE TABLE IF NOT EXISTS ai_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  agent_type text NOT NULL DEFAULT 'general',
  content text NOT NULL,
  embedding vector(1536),
  source_conversation_id uuid,
  confidence real NOT NULL DEFAULT 0.8,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ────────────────────────────────────────────────────────
-- HNSW for similarity search during retrieval
CREATE INDEX IF NOT EXISTS idx_ai_memories_embedding
  ON ai_memories USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Clinic + agent_type for filtered queries
CREATE INDEX IF NOT EXISTS idx_ai_memories_clinic_agent
  ON ai_memories(clinic_id, agent_type);

-- Confidence-based pruning in consolidation
CREATE INDEX IF NOT EXISTS idx_ai_memories_confidence
  ON ai_memories(clinic_id, confidence);

-- ── match_memories SQL function ────────────────────────────────────
-- Cosine similarity search on ai_memories, scoped by clinic_id + agent_type.
CREATE OR REPLACE FUNCTION match_memories(
  p_clinic_id uuid,
  p_agent_type text,
  p_query_embedding vector(1536),
  p_match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  clinic_id uuid,
  agent_type text,
  content text,
  confidence real,
  last_used_at timestamptz,
  created_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_clinic_id IS NULL THEN
    RAISE EXCEPTION 'clinic_id parameter is required';
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.clinic_id,
    m.agent_type,
    m.content,
    m.confidence,
    m.last_used_at,
    m.created_at,
    1 - (m.embedding <=> p_query_embedding) AS similarity
  FROM ai_memories m
  WHERE m.clinic_id = p_clinic_id
    AND m.agent_type = p_agent_type
    AND m.embedding IS NOT NULL
    AND m.confidence >= 0.4
  ORDER BY m.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$;

-- ── RLS ────────────────────────────────────────────────────────────
ALTER TABLE ai_memories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ai_memories' AND policyname = 'ai_memories_clinic_isolation'
  ) THEN
    CREATE POLICY ai_memories_clinic_isolation
      ON ai_memories
      FOR ALL
      USING (
        clinic_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'clinic_id')::uuid
      )
      WITH CHECK (
        clinic_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'clinic_id')::uuid
      );
  END IF;
END $$;
