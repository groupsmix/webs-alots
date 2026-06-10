-- Migration 00174: AI Embeddings (pgvector) for RAG + memory
--
-- Phase B1: Creates the vector extension, ai_documents table for
-- clinic-scoped embeddings (FAQs, policies, services, docs), HNSW
-- index for cosine similarity search, and RLS policies.
--
-- REVERSIBLE: DROP TABLE ai_documents; DROP EXTENSION vector;
-- IDEMPOTENT: All statements guarded with IF NOT EXISTS / IF EXISTS.

-- ── Enable pgvector extension ──────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ── ai_documents table ─────────────────────────────────────────────
-- Stores embedded text chunks for RAG retrieval, scoped per clinic.
CREATE TABLE IF NOT EXISTS ai_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('faq', 'policy', 'service', 'doc')),
  source_id uuid,
  language text NOT NULL DEFAULT 'fr',
  content text NOT NULL,
  embedding vector(1536),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ────────────────────────────────────────────────────────
-- HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS idx_ai_documents_embedding
  ON ai_documents USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Clinic + source_type filter index (most queries filter by both)
CREATE INDEX IF NOT EXISTS idx_ai_documents_clinic_source
  ON ai_documents(clinic_id, source_type);

-- Source lookup for backfill dedup
CREATE INDEX IF NOT EXISTS idx_ai_documents_source_id
  ON ai_documents(source_id) WHERE source_id IS NOT NULL;

-- ── RLS ────────────────────────────────────────────────────────────
ALTER TABLE ai_documents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ai_documents' AND policyname = 'ai_documents_clinic_isolation'
  ) THEN
    CREATE POLICY ai_documents_clinic_isolation
      ON ai_documents
      FOR ALL
      USING (
        clinic_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'clinic_id')::uuid
      )
      WITH CHECK (
        clinic_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'clinic_id')::uuid
      );
  END IF;
END $$;

-- ── match_documents SQL function ───────────────────────────────────
-- Security definer with explicit clinic_id check for safe cosine search.
-- Returns top-k documents by cosine similarity, optionally filtered by
-- source_type and keyword (tsvector on content).
CREATE OR REPLACE FUNCTION match_documents(
  p_clinic_id uuid,
  p_query_embedding vector(1536),
  p_match_count int DEFAULT 8,
  p_source_type text DEFAULT NULL,
  p_keyword text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  clinic_id uuid,
  source_type text,
  source_id uuid,
  language text,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate clinic_id parameter (defense in depth)
  IF p_clinic_id IS NULL THEN
    RAISE EXCEPTION 'clinic_id parameter is required';
  END IF;

  RETURN QUERY
  SELECT
    d.id,
    d.clinic_id,
    d.source_type,
    d.source_id,
    d.language,
    d.content,
    d.metadata,
    1 - (d.embedding <=> p_query_embedding) AS similarity
  FROM ai_documents d
  WHERE d.clinic_id = p_clinic_id
    AND d.embedding IS NOT NULL
    AND (p_source_type IS NULL OR d.source_type = p_source_type)
    AND (
      p_keyword IS NULL
      OR to_tsvector('french', d.content) @@ plainto_tsquery('french', p_keyword)
    )
  ORDER BY d.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$;

-- ── Updated_at trigger ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_ai_documents_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_documents_updated_at ON ai_documents;
CREATE TRIGGER trg_ai_documents_updated_at
  BEFORE UPDATE ON ai_documents
  FOR EACH ROW EXECUTE FUNCTION update_ai_documents_updated_at();
