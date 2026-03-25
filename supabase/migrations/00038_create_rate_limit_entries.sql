-- ============================================================
-- Migration 00038: Create rate_limit_entries table + RPC
--
-- The distributed rate limiter (src/lib/rate-limit.ts) expects
-- this table and RPC function when SUPABASE_SERVICE_ROLE_KEY
-- is configured. Without them, the Supabase-backed limiter
-- falls back to error handling that fails closed — blocking
-- ALL /api/* requests with HTTP 429.
--
-- This migration:
--   1. Creates the rate_limit_entries table
--   2. Creates the rate_limit_increment atomic RPC function
--   3. Enables RLS (service-role only — no user-facing policies)
--   4. Adds an index for automatic cleanup of expired entries
-- ============================================================

-- 1. Create the table
CREATE TABLE IF NOT EXISTS rate_limit_entries (
  key        TEXT PRIMARY KEY,
  count      INTEGER NOT NULL DEFAULT 0,
  reset_at   BIGINT  NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Enable RLS — only service_role can access this table.
--    No user-facing policies are added intentionally.
ALTER TABLE rate_limit_entries ENABLE ROW LEVEL SECURITY;

-- 3. Index for efficient cleanup of expired entries
CREATE INDEX IF NOT EXISTS idx_rate_limit_entries_reset_at
  ON rate_limit_entries(reset_at);

-- 4. Atomic rate-limit increment function.
--    Called by the Supabase rate limiter to avoid SELECT → UPDATE
--    race conditions. Returns the new request count.
CREATE OR REPLACE FUNCTION rate_limit_increment(
  p_key          TEXT,
  p_window_start BIGINT,
  p_reset_at     BIGINT,
  p_now          TIMESTAMPTZ
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO rate_limit_entries (key, count, reset_at, updated_at)
  VALUES (p_key, 1, p_reset_at, p_now)
  ON CONFLICT (key) DO UPDATE
  SET
    count = CASE
      WHEN rate_limit_entries.reset_at <= p_window_start THEN 1
      ELSE rate_limit_entries.count + 1
    END,
    reset_at = CASE
      WHEN rate_limit_entries.reset_at <= p_window_start THEN p_reset_at
      ELSE rate_limit_entries.reset_at
    END,
    updated_at = p_now
  RETURNING count INTO v_count;

  RETURN v_count;
END;
$$;

-- 5. Restrict RPC to service_role only (revoke from public/anon).
REVOKE EXECUTE ON FUNCTION rate_limit_increment(TEXT, BIGINT, BIGINT, TIMESTAMPTZ)
  FROM public, anon, authenticated;
