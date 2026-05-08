-- ============================================================
-- Migration 00004: Add subdomain column to clinics
-- Enables subdomain-based multi-tenant routing
-- (e.g., clinicname.yourdomain.com)
-- ============================================================

ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS subdomain TEXT UNIQUE;

-- Index for fast subdomain lookups in middleware
CREATE INDEX IF NOT EXISTS idx_clinics_subdomain ON clinics(subdomain)
  WHERE subdomain IS NOT NULL;
