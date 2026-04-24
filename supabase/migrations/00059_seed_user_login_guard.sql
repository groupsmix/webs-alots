-- ============================================================
-- Migration 00059: SEED-01 — Runtime guard for seed user login
--
-- Adds a database-level trigger that prevents seed users
-- (created in migration 00019 with well-known passwords) from
-- authenticating in production environments.
--
-- Defence-in-depth: the application layer (auth.ts, middleware,
-- auth callback) also blocks these users, but the DB trigger
-- ensures coverage even if application checks are bypassed.
--
-- The trigger fires BEFORE UPDATE on auth.users and rejects
-- any sign-in (which Supabase records as a last_sign_in_at
-- update) for the well-known seed user IDs when the
-- app.environment setting is 'production'.
-- ============================================================

-- List of seed user IDs from migration 00019
CREATE OR REPLACE FUNCTION block_seed_user_login()
RETURNS TRIGGER AS $$
BEGIN
  -- Only enforce in production (set via app.environment config var)
  IF current_setting('app.environment', true) = 'production' THEN
    IF NEW.id IN (
      'a0000000-0000-0000-0000-000000000001',
      'a0000000-0000-0000-0000-000000000002',
      'a0000000-0000-0000-0000-000000000003',
      'a0000000-0000-0000-0000-000000000004',
      'a0000000-0000-0000-0000-000000000010',
      'a0000000-0000-0000-0000-000000000011',
      'a0000000-0000-0000-0000-000000000012',
      'a0000000-0000-0000-0000-000000000013',
      'a0000000-0000-0000-0000-000000000014'
    ) THEN
      RAISE EXCEPTION 'SEED-01: Seed user login is blocked in production. '
        'These accounts have well-known credentials in git history. '
        'Delete them or rotate their passwords.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fire on every update to auth.users (Supabase updates last_sign_in_at on login)
DROP TRIGGER IF EXISTS trg_block_seed_user_login ON auth.users;
CREATE TRIGGER trg_block_seed_user_login
  BEFORE UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION block_seed_user_login();

-- Also prevent re-inserting deleted seed users
DROP TRIGGER IF EXISTS trg_block_seed_user_insert ON auth.users;
CREATE TRIGGER trg_block_seed_user_insert
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION block_seed_user_login();
