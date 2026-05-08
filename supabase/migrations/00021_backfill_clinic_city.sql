-- ============================================================
-- Migration 00021: Backfill clinics.city from config->>'city'
--
-- The top-level city column was added in 00005 but the seed data
-- (00003) only populated config.city inside the JSONB column.
-- Code that reads clinic.city directly gets NULL.
-- This migration copies the value so both columns stay in sync.
-- ============================================================

UPDATE clinics
SET city = config->>'city'
WHERE city IS NULL
  AND config->>'city' IS NOT NULL;
