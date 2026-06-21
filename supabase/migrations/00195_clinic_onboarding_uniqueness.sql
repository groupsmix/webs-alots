-- 00195: Enforce one onboarding row per clinic (Audit #11)
--
-- `syncClinicOnboardingState()` previously did a select-then-insert/update with
-- no unique constraint on clinic_id. Two concurrent calls (e.g. createClinic +
-- a parallel provisioning request) could both see "no existing row" and each
-- INSERT, producing duplicate onboarding rows and silently desynced state.
--
-- This migration de-duplicates any existing rows (keeping the most recently
-- updated one per clinic) and adds a UNIQUE index on clinic_id so the helper
-- can perform a single race-safe upsert (ON CONFLICT (clinic_id)).
--
-- NB: NULL clinic_id rows are allowed and remain distinct (the FK is
-- ON DELETE SET NULL), so a plain unique index — not a partial one — is used,
-- which also lets PostgreSQL infer it for ON CONFLICT (clinic_id).

-- 1. De-duplicate: keep the freshest row per non-null clinic_id.
DELETE FROM clinic_onboardings a
USING clinic_onboardings b
WHERE a.clinic_id IS NOT NULL
  AND a.clinic_id = b.clinic_id
  AND a.id <> b.id
  AND (
    a.updated_at < b.updated_at
    OR (a.updated_at = b.updated_at AND a.created_at < b.created_at)
    OR (a.updated_at = b.updated_at AND a.created_at = b.created_at AND a.id < b.id)
  );

-- 2. Enforce uniqueness going forward.
CREATE UNIQUE INDEX IF NOT EXISTS clinic_onboardings_clinic_id_uq
  ON clinic_onboardings (clinic_id);
