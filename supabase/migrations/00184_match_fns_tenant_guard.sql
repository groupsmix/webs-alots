-- Migration 00184: Caller-clinic guard for RAG SECURITY DEFINER match functions
--
-- AI-SEC / RLS-bypass hardening.
--
-- PROBLEM
--   match_documents (00174) and match_memories (00175) are SECURITY DEFINER
--   and therefore bypass RLS. They accept p_clinic_id as a parameter but only
--   validate that it IS NOT NULL. Any caller that can EXECUTE the function can
--   pass an ARBITRARY p_clinic_id and read another clinic's embedded documents
--   or memories — a cross-tenant read bypass on PHI-adjacent data.
--
-- FIX
--   Add the same caller-clinic guard already used by increment_clinic_ai_usage
--   (00181): resolve the caller's clinic from the JWT profile
--   (get_user_clinic_id) and/or the request header (get_request_clinic_id) and
--   reject any call whose p_clinic_id does not match. Service-role / cron
--   callers have neither context and remain allowed for cross-tenant backfill
--   and consolidation jobs (which is required by ai-embed-faqs and
--   ai-memory-consolidate).
--
-- SCOPE
--   CREATE OR REPLACE only — function signatures, return types, ownership and
--   existing GRANTs are preserved unchanged. No RLS policy is modified. No
--   existing migration file is edited.
--
-- REVERSIBLE: re-apply 00174 / 00175 definitions to drop the guard.
-- IDEMPOTENT: CREATE OR REPLACE is safe to run repeatedly.

-- ── match_documents ────────────────────────────────────────────────
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
DECLARE
  v_user_clinic    uuid := get_user_clinic_id();
  v_request_clinic uuid := get_request_clinic_id();
BEGIN
  -- Validate clinic_id parameter (defense in depth).
  IF p_clinic_id IS NULL THEN
    RAISE EXCEPTION 'clinic_id parameter is required';
  END IF;

  -- Caller-clinic guard (mirrors increment_clinic_ai_usage, 00181).
  -- This function is SECURITY DEFINER and bypasses RLS, so the parameter is
  -- the ONLY tenant boundary. A caller bound to a clinic (by JWT profile or by
  -- the x-clinic-id request header) may only query their own clinic.
  -- Service-role / cron callers have neither context and are allowed.
  IF v_user_clinic IS NOT NULL OR v_request_clinic IS NOT NULL THEN
    IF p_clinic_id IS DISTINCT FROM v_user_clinic
       AND p_clinic_id IS DISTINCT FROM v_request_clinic THEN
      RAISE EXCEPTION 'match_documents: clinic mismatch';
    END IF;
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

COMMENT ON FUNCTION match_documents(uuid, vector, int, text, text) IS
  'RLS-bypass hardened (00184): SECURITY DEFINER cosine search; rejects callers whose clinic context does not match p_clinic_id. Service-role/cron callers allowed.';

-- ── match_memories ─────────────────────────────────────────────────
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
DECLARE
  v_user_clinic    uuid := get_user_clinic_id();
  v_request_clinic uuid := get_request_clinic_id();
BEGIN
  IF p_clinic_id IS NULL THEN
    RAISE EXCEPTION 'clinic_id parameter is required';
  END IF;

  -- Caller-clinic guard (see match_documents above).
  IF v_user_clinic IS NOT NULL OR v_request_clinic IS NOT NULL THEN
    IF p_clinic_id IS DISTINCT FROM v_user_clinic
       AND p_clinic_id IS DISTINCT FROM v_request_clinic THEN
      RAISE EXCEPTION 'match_memories: clinic mismatch';
    END IF;
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

COMMENT ON FUNCTION match_memories(uuid, text, vector, int) IS
  'RLS-bypass hardened (00184): SECURITY DEFINER cosine search; rejects callers whose clinic context does not match p_clinic_id. Service-role/cron callers allowed.';
