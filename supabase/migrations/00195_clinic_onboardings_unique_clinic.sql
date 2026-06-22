-- 00195_clinic_onboardings_unique_clinic.sql
--
-- Audit #11 — onboarding-state race.
--
-- `syncClinicOnboardingState()` previously did a read-then-insert/update with no
-- uniqueness guarantee, so two concurrent syncs for the same clinic could each
-- find "no existing row" and both INSERT, leaving duplicate onboarding rows.
-- Those duplicates then made the "load newest row" path non-deterministic.
--
-- This migration:
--   1. De-duplicates existing rows, keeping the most-recently-updated row per
--      clinic (tie-broken by created_at, then id) and deleting the rest.
--   2. Replaces the non-unique clinic_id index with a UNIQUE index so a single
--      onboarding row per clinic is enforced at the database level. The app
--      layer now upserts on this key (ON CONFLICT (clinic_id)).
--
-- Notes:
--   * `clinic_id` is nullable (REFERENCES clinics(id) ON DELETE SET NULL). A
--     plain UNIQUE index still permits multiple NULL rows because Postgres
--     treats NULLs as distinct, so orphaned onboardings (whose clinic was
--     deleted) never collide. A non-partial index is used deliberately so the
--     PostgREST/Supabase `ON CONFLICT (clinic_id)` upsert can use it as the
--     conflict arbiter.
--   * De-duplication runs BEFORE index creation so the migration is safe to
--     apply on existing data.

BEGIN;

-- 1) De-duplicate: keep the freshest row per clinic_id, delete older copies.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY clinic_id
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM clinic_onboardings
  WHERE clinic_id IS NOT NULL
)
DELETE FROM clinic_onboardings co
USING ranked r
WHERE co.id = r.id
  AND r.rn > 1;

-- 2) Swap the non-unique index for a UNIQUE one on clinic_id.
DROP INDEX IF EXISTS idx_onboardings_clinic;

CREATE UNIQUE INDEX IF NOT EXISTS clinic_onboardings_clinic_id_uq
  ON clinic_onboardings (clinic_id);

COMMIT;
