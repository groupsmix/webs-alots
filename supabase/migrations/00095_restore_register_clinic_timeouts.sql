-- =================================================================================
-- Migration 00095: Restore statement_timeout and lock_timeout on register_new_clinic
--
-- W8-A10-01: Migration 00090 used CREATE OR REPLACE FUNCTION which rewrote
-- pg_proc.proconfig, dropping the statement_timeout='5s' and lock_timeout='2s'
-- that were set by migration 00068. This migration restores those timeouts
-- alongside the search_path that 00090 already sets.
-- =================================================================================

ALTER FUNCTION register_new_clinic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID)
  SET statement_timeout = '5s';

ALTER FUNCTION register_new_clinic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID)
  SET lock_timeout = '2s';
