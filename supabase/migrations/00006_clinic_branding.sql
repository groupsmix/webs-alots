-- ============================================================
-- 00006: Add branding columns to clinics table
-- Allows each clinic to customise logo, colors, fonts, and
-- hero image. Values are consumed by the public layout and
-- the admin branding-settings page.
-- ============================================================

ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS logo_url        TEXT,
  ADD COLUMN IF NOT EXISTS favicon_url     TEXT,
  ADD COLUMN IF NOT EXISTS primary_color   TEXT DEFAULT '#1E4DA1',
  ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#0F6E56',
  ADD COLUMN IF NOT EXISTS heading_font    TEXT DEFAULT 'Geist',
  ADD COLUMN IF NOT EXISTS body_font       TEXT DEFAULT 'Geist',
  ADD COLUMN IF NOT EXISTS hero_image_url  TEXT;
