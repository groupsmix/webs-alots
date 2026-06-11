-- AI-002 / AUDIT-2026-06 P0-2: Atomic per-clinic monthly AI usage increment.
--
-- The previous implementation in /api/chat/route.ts used a plain UPSERT that
-- OVERWROTE tokens_in / tokens_out / request_count with the values of the
-- latest request instead of incrementing them. As a result:
--   - monthly counters never accumulated (the row always held ~1 request),
--   - the AI_MONTHLY_TOKEN_LIMIT (500k) budget check compared against a
--     near-zero number and NEVER triggered,
--   - clinics could burn unlimited paid tokens.
--
-- This RPC performs the increment atomically in a single statement so it is
-- safe under concurrent requests, mirroring increment_ai_usage (00124) which
-- does the same for per-provider counters.

CREATE OR REPLACE FUNCTION increment_clinic_ai_usage(
  p_clinic_id  UUID,
  p_tokens_in  BIGINT,
  p_tokens_out BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_clinic    UUID := get_user_clinic_id();
  v_request_clinic UUID := get_request_clinic_id();
BEGIN
  -- Tenant guard: a caller may only increment usage for their own clinic
  -- (by profile or by request context). Service-role callers have neither
  -- and are allowed (cron / server-side jobs).
  IF v_user_clinic IS NOT NULL OR v_request_clinic IS NOT NULL THEN
    IF p_clinic_id IS DISTINCT FROM v_user_clinic
       AND p_clinic_id IS DISTINCT FROM v_request_clinic THEN
      RAISE EXCEPTION 'increment_clinic_ai_usage: clinic mismatch';
    END IF;
  END IF;

  INSERT INTO ai_usage (clinic_id, month, tokens_in, tokens_out, request_count)
  VALUES (
    p_clinic_id,
    date_trunc('month', now())::date,
    GREATEST(COALESCE(p_tokens_in, 0), 0),
    GREATEST(COALESCE(p_tokens_out, 0), 0),
    1
  )
  ON CONFLICT (clinic_id, month) DO UPDATE
  SET tokens_in     = ai_usage.tokens_in  + GREATEST(COALESCE(p_tokens_in, 0), 0),
      tokens_out    = ai_usage.tokens_out + GREATEST(COALESCE(p_tokens_out, 0), 0),
      request_count = ai_usage.request_count + 1,
      updated_at    = now();
END;
$$;

COMMENT ON FUNCTION increment_clinic_ai_usage IS
  'AUDIT P0-2: Atomically increment per-clinic monthly AI token usage. Used by /api/chat budget tracking. Safe under concurrent requests.';

REVOKE ALL ON FUNCTION increment_clinic_ai_usage(UUID, BIGINT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_clinic_ai_usage(UUID, BIGINT, BIGINT)
  TO authenticated, service_role;
