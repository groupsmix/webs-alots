-- 00164: Add AI-structured data columns to consultation_notes
-- Supports Feature 1: Smart Consultation Notes

-- Add structured_data JSONB column for AI-extracted note structure
ALTER TABLE consultation_notes
  ADD COLUMN IF NOT EXISTS structured_data JSONB;

-- Add AI processing metadata columns
ALTER TABLE consultation_notes
  ADD COLUMN IF NOT EXISTS ai_structured_at TIMESTAMPTZ;

ALTER TABLE consultation_notes
  ADD COLUMN IF NOT EXISTS ai_model TEXT;

-- Index for querying AI-processed notes efficiently
CREATE INDEX IF NOT EXISTS idx_consultation_notes_ai_structured
  ON consultation_notes(clinic_id, ai_structured_at)
  WHERE ai_structured_at IS NOT NULL;

-- Comment describing the new columns
COMMENT ON COLUMN consultation_notes.structured_data IS
  'AI-structured consultation note in JSON format (chiefComplaint, historyOfPresentIllness, physicalExamination, assessment, plan, followUp, prescriptionHints, labOrderHints, redFlags)';

COMMENT ON COLUMN consultation_notes.ai_structured_at IS
  'Timestamp when this note was structured by AI';

COMMENT ON COLUMN consultation_notes.ai_model IS
  'AI model identifier used for structuring (e.g. gpt-4o-mini-2024-07-18)';
