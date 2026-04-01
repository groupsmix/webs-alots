-- ============================================================
-- 00060: Add website_config JSONB column to clinics table
--
-- Stores per-clinic website content (hero title, subtitle, etc.)
-- that can be set via template presets or manual editing.
-- Falls back to defaultWebsiteConfig in the app when NULL.
-- ============================================================

ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS website_config JSONB DEFAULT NULL;

COMMENT ON COLUMN clinics.website_config IS
  'Per-clinic website content overrides (hero title/subtitle, etc). NULL = use defaults.';
