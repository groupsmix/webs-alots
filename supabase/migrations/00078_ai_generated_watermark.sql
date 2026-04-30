-- =============================================================================
-- Migration 00078: A108 — AI output watermark (ai_generated flag)
--
-- A108 (Watermark): AI outputs are currently indistinguishable from human-
-- authored prescriptions/notes in the database. For a medical product, this
-- is non-trivial -- regulators and auditors need to know which records were
-- AI-assisted vs. manually authored.
--
-- This migration adds an `ai_generated` boolean flag (default false) to:
--   - prescriptions: AI prescription generator output
--   - consultation_notes: AI patient summary output
--
-- When a doctor accepts an AI suggestion, the application code sets
-- ai_generated = true on the resulting record. This is separate from the
-- billing_events.metadata.feature field, which only tracks API call count
-- and does not link back to the specific clinical record.
-- =============================================================================

BEGIN;

-- ── prescriptions.ai_generated ──────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prescriptions' AND column_name = 'ai_generated'
  ) THEN
    ALTER TABLE prescriptions
      ADD COLUMN ai_generated BOOLEAN NOT NULL DEFAULT false;
    RAISE NOTICE 'A108: Added prescriptions.ai_generated column';
  END IF;
END $$;

COMMENT ON COLUMN prescriptions.ai_generated IS
  'A108 (added in 00078): true when the prescription content was generated '
  'or suggested by an AI model. The doctor always has final editorial '
  'control, but this flag provides audit traceability for regulatory '
  'compliance (EU AI Act Article 14 / Moroccan Law 09-08).';

-- ── consultation_notes.ai_generated ─────────────────────────────────────
-- consultation_notes may not exist in all deployments; guard accordingly.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'consultation_notes'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'consultation_notes' AND column_name = 'ai_generated'
    ) THEN
      ALTER TABLE consultation_notes
        ADD COLUMN ai_generated BOOLEAN NOT NULL DEFAULT false;
      RAISE NOTICE 'A108: Added consultation_notes.ai_generated column';
    END IF;
  END IF;
END $$;

COMMIT;
