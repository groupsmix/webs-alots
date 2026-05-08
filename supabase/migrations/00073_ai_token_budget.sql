-- Migration: AI Token Budget Tracking
-- Issue: A1-01 (Unbounded AI input / token exhaustion)
-- Date: 2026-05-05
--
-- This migration adds AI token budget tracking to the clinics table to prevent
-- unbounded token consumption and financial losses from AI API abuse.
--
-- Changes:
-- 1. Add ai_monthly_tokens column to track current month's token usage
-- 2. Add ai_tokens_reset_at column to track when the counter was last reset
-- 3. Create increment_ai_tokens() RPC for atomic token counter updates
--
-- Security: The RPC is SECURITY DEFINER to allow authenticated users to increment
-- their own clinic's counter without granting direct UPDATE on clinics table.
-- The function validates that the caller belongs to the clinic being updated.

-- Add AI token tracking columns to clinics table
ALTER TABLE clinics
ADD COLUMN IF NOT EXISTS ai_monthly_tokens INTEGER DEFAULT 0
  CHECK (ai_monthly_tokens >= 0),
ADD COLUMN IF NOT EXISTS ai_tokens_reset_at TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN clinics.ai_monthly_tokens IS
  'Current month AI token usage. Reset monthly via ai_tokens_reset_at.';

COMMENT ON COLUMN clinics.ai_tokens_reset_at IS
  'Timestamp of last monthly token counter reset. Used to detect month boundaries.';

-- Create atomic increment function for AI token usage
-- SECURITY DEFINER: Allows authenticated users to increment their clinic counter
-- without granting direct UPDATE permission on clinics table.
CREATE OR REPLACE FUNCTION increment_ai_tokens(
  p_clinic_id UUID,
  p_tokens INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_clinic_id UUID;
  v_caller_role TEXT;
BEGIN
  -- Validate input: tokens must be positive
  IF p_tokens <= 0 THEN
    RAISE EXCEPTION 'Token increment must be positive, got %', p_tokens;
  END IF;

  -- Get caller's clinic_id and role from users table
  SELECT clinic_id, role INTO v_caller_clinic_id, v_caller_role
  FROM users
  WHERE id = auth.uid();

  -- Authorization check: caller must belong to the clinic OR be super_admin
  IF v_caller_clinic_id IS NULL AND v_caller_role != 'super_admin' THEN
    RAISE EXCEPTION 'User has no clinic association';
  END IF;

  IF v_caller_clinic_id != p_clinic_id AND v_caller_role != 'super_admin' THEN
    RAISE EXCEPTION 'Cannot increment tokens for a different clinic';
  END IF;

  -- Atomic increment of token counter
  UPDATE clinics
  SET ai_monthly_tokens = COALESCE(ai_monthly_tokens, 0) + p_tokens
  WHERE id = p_clinic_id;

  -- Verify the update affected exactly one row
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Clinic not found: %', p_clinic_id;
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
-- RLS is enforced within the function body via clinic_id check
GRANT EXECUTE ON FUNCTION increment_ai_tokens(UUID, INTEGER) TO authenticated;

COMMENT ON FUNCTION increment_ai_tokens IS
  'Atomically increment AI token usage for a clinic. Enforces tenant isolation.';

-- Create index for efficient token budget queries
-- Most queries will be: SELECT ai_monthly_tokens WHERE id = ? (already indexed by PK)
-- No additional index needed for this use case.

-- Backfill: Set reset_at to start of current month for existing clinics
UPDATE clinics
SET ai_tokens_reset_at = DATE_TRUNC('month', NOW())
WHERE ai_tokens_reset_at IS NULL;
