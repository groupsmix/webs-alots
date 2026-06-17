-- ============================================================================
-- Pin the caller-clinic guard in match_documents / match_memories (00184).
-- ============================================================================
--
-- Both RPCs are SECURITY DEFINER (defined in 00174 / 00175) and bypass RLS.
-- Migration 00184 added a caller-clinic guard so a clinic-bound caller cannot
-- pass another clinic's id and exfiltrate that clinic's embedded documents or
-- memories. A hostile or careless author could regress this by dropping the
-- guard. This test pins each scenario so a regression fails loudly.
--
-- Caller clinic context is resolved by get_request_clinic_id(), which falls
-- back to the `app.current_clinic_id` session GUC — we set it here to simulate
-- a request bound to clinic A without needing a live PostgREST request.
--
-- Run locally with pgTAP (https://pgtap.org/) installed:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/match_fns_tenant_guard.test.sql
--
-- Wrapped in a transaction that rolls back, so it is safe to run repeatedly.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(10);

-- A zero embedding so the function calls are well-typed. The guard fires before
-- the vector search in the cross-tenant cases, so the value is irrelevant there.
CREATE FUNCTION pg_temp.zv() RETURNS vector LANGUAGE sql AS
$f$ SELECT ('[' || array_to_string(array_fill(0::float4, ARRAY[1536]), ',') || ']')::vector $f$;

-- ── Structure: both functions exist and are still SECURITY DEFINER ──────────
SELECT has_function(
  'public', 'match_documents',
  ARRAY['uuid','vector','integer','text','text'],
  'match_documents(...) is defined in the public schema'
);
SELECT is(
  (SELECT prosecdef FROM pg_proc
     WHERE proname = 'match_documents' AND pronamespace = 'public'::regnamespace),
  true,
  'match_documents is SECURITY DEFINER'
);
SELECT has_function(
  'public', 'match_memories',
  ARRAY['uuid','text','vector','integer'],
  'match_memories(...) is defined in the public schema'
);
SELECT is(
  (SELECT prosecdef FROM pg_proc
     WHERE proname = 'match_memories' AND pronamespace = 'public'::regnamespace),
  true,
  'match_memories is SECURITY DEFINER'
);

-- ── Behaviour: caller bound to clinic A ─────────────────────────────────────
SELECT set_config('app.current_clinic_id', '11111111-1111-1111-1111-111111111111', true);

-- A caller bound to clinic A must NOT be able to query clinic B.
SELECT throws_like(
  $$ SELECT public.match_documents('22222222-2222-2222-2222-222222222222'::uuid, pg_temp.zv()) $$,
  '%clinic mismatch%',
  'match_documents rejects a clinic-A caller querying clinic B'
);
SELECT throws_like(
  $$ SELECT public.match_memories('22222222-2222-2222-2222-222222222222'::uuid, 'general', pg_temp.zv()) $$,
  '%clinic mismatch%',
  'match_memories rejects a clinic-A caller querying clinic B'
);

-- A caller bound to clinic A querying clinic A is allowed (returns 0 rows, no raise).
SELECT lives_ok(
  $$ SELECT public.match_documents('11111111-1111-1111-1111-111111111111'::uuid, pg_temp.zv()) $$,
  'match_documents allows a clinic-A caller querying clinic A'
);
SELECT lives_ok(
  $$ SELECT public.match_memories('11111111-1111-1111-1111-111111111111'::uuid, 'general', pg_temp.zv()) $$,
  'match_memories allows a clinic-A caller querying clinic A'
);

-- ── Behaviour: service-role / cron caller (no clinic context) ───────────────
-- Backfill and consolidation jobs run without a user or request clinic and
-- must remain able to query any clinic.
SELECT set_config('app.current_clinic_id', '', true);

SELECT lives_ok(
  $$ SELECT public.match_documents('22222222-2222-2222-2222-222222222222'::uuid, pg_temp.zv()) $$,
  'match_documents allows a service-role caller (no clinic context) for any clinic'
);
SELECT lives_ok(
  $$ SELECT public.match_memories('22222222-2222-2222-2222-222222222222'::uuid, 'general', pg_temp.zv()) $$,
  'match_memories allows a service-role caller (no clinic context) for any clinic'
);

SELECT * FROM finish();

ROLLBACK;
