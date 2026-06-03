-- ============================================================
-- GDPR Art.18 (Restriction) & Art.21 (Objection) Enforcement
-- A62-F1 / A62-F2
--
-- Adds columns to the `users` table that record the current
-- state of any Art.18 restriction or Art.21 objection request
-- from a data subject.
--
-- A `processing_restricted = true` flag causes the application
-- to skip non-essential processing for that user (AI summaries,
-- WhatsApp notifications for Art.6(1)(f) activities, etc.).
-- ============================================================

-- Art.18: Right to restriction of processing
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS processing_restricted     boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS processing_restricted_at  timestamptz  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS processing_restriction_reason text      DEFAULT NULL;

-- Art.21: Right to object to processing under legitimate interest
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS processing_objection_active boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS processing_objection_at     timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS processing_objection_activities text[]  DEFAULT '{}';

-- Comment on columns for schema clarity
COMMENT ON COLUMN users.processing_restricted IS
  'GDPR Art.18: when true, non-essential processing is suspended for this user
   (AI summaries, legitimate-interest WhatsApp notifications, analytics).
   Set by the patient via POST /api/patient/restrict-processing.
   Cleared manually after DPO review.';

COMMENT ON COLUMN users.processing_objection_active IS
  'GDPR Art.21: when true, the user has objected to processing under Art.6(1)(f)
   (legitimate interest). The specific activities are recorded in
   processing_objection_activities.';

-- Index so cron / queries checking for restricted users are fast
CREATE INDEX IF NOT EXISTS idx_users_processing_restricted
  ON users(processing_restricted)
  WHERE processing_restricted = true;

CREATE INDEX IF NOT EXISTS idx_users_processing_objection
  ON users(processing_objection_active)
  WHERE processing_objection_active = true;
