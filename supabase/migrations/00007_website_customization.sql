-- ============================================================
-- 00007: Website Customization — Levels 1, 2 & 3
--
-- Level 1 (Branding): tagline, cover_photo_url columns
-- Level 2 (Layout Templates): template_id column
-- Level 3 (Section Control): section_visibility JSONB column
-- ============================================================

-- Level 1: extra branding fields (logo, colors, hero already exist from 00006)
ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS tagline          TEXT,
  ADD COLUMN IF NOT EXISTS cover_photo_url  TEXT;

-- Level 2: chosen layout template (defaults to 'modern')
ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS template_id      TEXT DEFAULT 'modern';

-- Level 3: section visibility as JSONB
-- Default: all sections ON
ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS section_visibility JSONB DEFAULT '{
    "hero": true,
    "services": true,
    "doctors": true,
    "reviews": true,
    "blog": true,
    "beforeAfter": true,
    "location": true,
    "booking": true,
    "contactForm": true,
    "insurance": true,
    "faq": true
  }'::jsonb;
