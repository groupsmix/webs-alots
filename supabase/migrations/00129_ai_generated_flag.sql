-- F-AI-15: AI-generated flag for clinical records.
-- Distinguishes AI-generated content from human-authored records,
-- required for EU AI Act Art. 52 transparency obligations.

ALTER TABLE consultation_notes
  ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE prescriptions
  ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN consultation_notes.ai_generated IS 'F-AI-15: True when content was generated or drafted by AI.';
COMMENT ON COLUMN prescriptions.ai_generated IS 'F-AI-15: True when content was generated or drafted by AI.';

-- Index for filtering AI-generated records in audits
CREATE INDEX IF NOT EXISTS idx_consultation_notes_ai_generated
  ON consultation_notes(ai_generated) WHERE ai_generated = true;

CREATE INDEX IF NOT EXISTS idx_prescriptions_ai_generated
  ON prescriptions(ai_generated) WHERE ai_generated = true;
