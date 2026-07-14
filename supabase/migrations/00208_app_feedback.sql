-- In-app product feedback captured from the "Help & Feedback" widget shown at
-- the bottom of every role dashboard (super_admin, clinic_admin, receptionist,
-- doctor, specialist, pharmacist, patient). Distinct from clinic-scoped patient
-- reviews (see reviews) and from support_tickets: this is product feedback about
-- Oltigo itself, surfaced to super_admins.
CREATE TABLE IF NOT EXISTS app_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Nullable: super_admins are not attached to a clinic.
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  role TEXT,
  rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
  message TEXT NOT NULL,
  page_url TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'archived')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_feedback_created_at ON app_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_feedback_status ON app_feedback(status);

ALTER TABLE app_feedback ENABLE ROW LEVEL SECURITY;

-- Any authenticated user may submit feedback as themselves.
DROP POLICY IF EXISTS app_feedback_insert_own ON app_feedback;
CREATE POLICY app_feedback_insert_own ON app_feedback
  FOR INSERT WITH CHECK (
    user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  );

-- Users may read their own submitted feedback.
DROP POLICY IF EXISTS app_feedback_select_own ON app_feedback;
CREATE POLICY app_feedback_select_own ON app_feedback
  FOR SELECT USING (
    user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  );

-- Super admins can read and triage all product feedback across tenants.
DROP POLICY IF EXISTS app_feedback_super_admin_all ON app_feedback;
CREATE POLICY app_feedback_super_admin_all ON app_feedback
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

COMMENT ON TABLE app_feedback IS 'In-app product feedback from any role, surfaced to super_admins. Not clinic patient reviews, not support tickets.';
