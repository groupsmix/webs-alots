-- Migration 00192: Add type + recurring columns to clinic_holidays.
-- These fields are needed by the admin/holidays UI and were missing
-- from the original table definition.

ALTER TABLE clinic_holidays
  ADD COLUMN IF NOT EXISTS type      TEXT    NOT NULL DEFAULT 'clinic'
    CHECK (type IN ('national', 'clinic', 'doctor')),
  ADD COLUMN IF NOT EXISTS recurring BOOLEAN NOT NULL DEFAULT false;
