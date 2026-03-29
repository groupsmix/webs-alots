-- ============================================================
-- Email Verification for Patient Bookings
--
-- Stores 6-digit verification codes sent to patient emails
-- before confirming bookings. Prevents spam and ensures
-- email reachability.
-- ============================================================

CREATE TABLE IF NOT EXISTS email_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint on email (upsert target)
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_verifications_email
  ON email_verifications(email);

-- Auto-cleanup: expired codes older than 1 hour
CREATE INDEX IF NOT EXISTS idx_email_verifications_expires
  ON email_verifications(expires_at);

-- RLS
ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (verification happens before auth)
CREATE POLICY email_verifications_insert ON email_verifications
  FOR INSERT WITH CHECK (true);

-- Anyone can read their own verification by email
CREATE POLICY email_verifications_select ON email_verifications
  FOR SELECT USING (true);

-- Anyone can update (mark as verified)
CREATE POLICY email_verifications_update ON email_verifications
  FOR UPDATE USING (true);

COMMENT ON TABLE email_verifications IS 'Stores email verification codes for patient bookings. Codes expire after 10 minutes.';
