-- 00190: Add an explicit `is_pilot` flag to clinics (O7 / pilots dashboard)
--
-- CONTEXT
--   The super-admin pilots dashboard (src/app/(super-admin)/super-admin/
--   pilots/page.tsx) previously *simulated* pilot selection by fetching the
--   first N clinics with a `.limit(10)` and a "for now, we simulate" comment.
--   This adds a real, operator-controlled flag so the dashboard reflects the
--   actual designated launch pilots instead of an arbitrary slice.
--
-- USAGE
--   Operators mark a clinic as a pilot by setting `is_pilot = true` (via the
--   super-admin tooling or a direct UPDATE). The dashboard queries
--   `WHERE is_pilot = true`. An empty dashboard simply means none are flagged
--   yet — which is the correct, honest state.
--
-- SAFETY / IDEMPOTENCY
--   Defaults to false so existing rows are unaffected. ADD COLUMN IF NOT
--   EXISTS + CREATE INDEX IF NOT EXISTS make this safe to re-run.

ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS is_pilot boolean NOT NULL DEFAULT false;

-- Partial index: the pilots dashboard only ever filters WHERE is_pilot = true,
-- which is a small subset of all clinics.
CREATE INDEX IF NOT EXISTS idx_clinics_is_pilot
  ON clinics(is_pilot)
  WHERE is_pilot = true;

COMMENT ON COLUMN clinics.is_pilot IS
  'True for clinics designated as launch pilots; surfaced in the super-admin pilots dashboard (O7).';
