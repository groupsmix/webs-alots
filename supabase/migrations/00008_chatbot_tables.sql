-- ============================================================
-- Migration 00008: Chatbot Tables
-- Per-clinic chatbot configuration and custom FAQ entries.
-- ============================================================

-- ============================================================
-- 1. CHATBOT CONFIG — per-clinic chatbot settings
-- ============================================================

CREATE TABLE chatbot_config (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  enabled         BOOLEAN DEFAULT TRUE,
  intelligence    TEXT NOT NULL DEFAULT 'basic'
                  CHECK (intelligence IN ('basic', 'smart', 'advanced')),
  greeting        TEXT DEFAULT 'Bonjour ! Comment puis-je vous aider ?',
  language        TEXT DEFAULT 'fr'
                  CHECK (language IN ('fr', 'ar', 'en', 'darija')),
  accent_color    TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (clinic_id)
);

CREATE INDEX idx_chatbot_config_clinic ON chatbot_config(clinic_id);

-- ============================================================
-- 2. CHATBOT FAQs — custom Q&A pairs per clinic
-- ============================================================

CREATE TABLE chatbot_faqs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  question        TEXT NOT NULL,
  answer          TEXT NOT NULL,
  keywords        TEXT[] DEFAULT '{}',
  sort_order      INT DEFAULT 0,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chatbot_faqs_clinic ON chatbot_faqs(clinic_id);
CREATE INDEX idx_chatbot_faqs_active ON chatbot_faqs(clinic_id, is_active)
  WHERE is_active = TRUE;

-- ============================================================
-- 3. RLS POLICIES
-- ============================================================

ALTER TABLE chatbot_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_faqs ENABLE ROW LEVEL SECURITY;

-- chatbot_config: public read for active clinics (chatbot needs it)
CREATE POLICY "chatbot_config_select_public" ON chatbot_config
  FOR SELECT USING (TRUE);

-- chatbot_config: clinic admin can manage their own
CREATE POLICY "chatbot_config_admin_manage" ON chatbot_config
  FOR ALL USING (is_clinic_admin(clinic_id))
  WITH CHECK (is_clinic_admin(clinic_id));

-- chatbot_config: super admin full access
CREATE POLICY "chatbot_config_sa_all" ON chatbot_config
  FOR ALL USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- chatbot_faqs: public read for active FAQs (chatbot needs it)
CREATE POLICY "chatbot_faqs_select_public" ON chatbot_faqs
  FOR SELECT USING (is_active = TRUE);

-- chatbot_faqs: clinic admin can manage their own
CREATE POLICY "chatbot_faqs_admin_manage" ON chatbot_faqs
  FOR ALL USING (is_clinic_admin(clinic_id))
  WITH CHECK (is_clinic_admin(clinic_id));

-- chatbot_faqs: super admin full access
CREATE POLICY "chatbot_faqs_sa_all" ON chatbot_faqs
  FOR ALL USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ============================================================
-- 4. FEATURE TOGGLE — register chatbot as a toggleable feature
-- ============================================================

INSERT INTO feature_toggles (key, label, description, category, system_types, tiers, enabled)
VALUES (
  'chatbot',
  'Chatbot Assistant',
  'Assistant virtuel intelligent pour répondre aux questions des patients',
  'advanced',
  ARRAY['doctor', 'dentist', 'pharmacy'],
  ARRAY['cabinet', 'pro', 'premium', 'saas'],
  TRUE
)
ON CONFLICT (key) DO NOTHING;
