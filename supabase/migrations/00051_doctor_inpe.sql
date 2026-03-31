-- ============================================================
-- Migration 00051: Doctor INPE Number
-- Adds INPE (Identifiant National de Prescripteur Electronique)
-- field to the users table for doctors.
-- INPE is stored in the metadata JSONB column following the
-- existing pattern (specialty, consultation_fee, etc.).
-- This migration ensures the metadata column exists and adds
-- an index for fast INPE lookups.
-- ============================================================

-- Ensure metadata column exists on users (idempotent)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Create a functional index on the INPE number inside metadata
-- so pharmacists can quickly look up a prescribing doctor.
CREATE INDEX IF NOT EXISTS idx_users_inpe_number
  ON users (((metadata->>'inpe_number')))
  WHERE metadata->>'inpe_number' IS NOT NULL;
