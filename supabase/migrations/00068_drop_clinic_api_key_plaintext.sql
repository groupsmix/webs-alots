-- ============================================================
-- Migration 00068: Drop plaintext API key column (S-01)
--
-- Problem (audit A1: F-01):
--   `clinic_api_keys.key` is a plaintext column persisting the raw
--   API key forever, and `idx_clinic_api_keys_key` is a btree index
--   over it. A DB compromise (or any role with read access to the
--   table) leaks every clinic's bearer credential.
--
-- Fix:
--   * Drop the index `idx_clinic_api_keys_key`.
--   * Drop the `key` column itself.
--
--   Going forward only `key_hash` (SHA-256) is persisted. The raw
--   key is shown to the operator exactly once in-memory at creation
--   time and must never be stored. `authenticateApiKey()` already
--   relies solely on `key_hash` + `key_prefix`, so dropping `key`
--   is safe at the application layer.
-- ============================================================

DROP INDEX IF EXISTS idx_clinic_api_keys_key;

ALTER TABLE clinic_api_keys
  DROP COLUMN IF EXISTS key;
