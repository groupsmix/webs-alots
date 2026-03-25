-- Migration 00044: Deduplicate seed data
--
-- Migration 00040 re-seeded services and a doctor that already existed from
-- the original seed, creating duplicates with different IDs:
--
--   services:  50000000-* (original) vs a0000000-* (duplicate)
--   doctor:    00000000-0000-0000-0000-000000000003 (original "Dr. Ahmed Benali")
--           vs d1000000-0000-0000-0000-000000000001 (duplicate)
--
-- The duplicate doctor (d1000000-*) also has time_slots referencing it.
-- Since the original doctor already has identical time_slots (Mon-Fri 09-12, 14-17),
-- we simply delete the duplicate time_slots and the duplicate records.
-- The duplicate doctor has one extra Saturday slot that the original lacks;
-- we migrate that to the original before deleting.

BEGIN;

-- ── 1. Migrate the Saturday time_slot from the duplicate doctor to the original ──
-- The duplicate has a Saturday 09:00-13:00 slot that the original doesn't have.
INSERT INTO time_slots (doctor_id, clinic_id, day_of_week, start_time, end_time, is_available, is_active)
SELECT
  '00000000-0000-0000-0000-000000000003',  -- original doctor
  clinic_id, day_of_week, start_time, end_time, is_available, is_active
FROM time_slots
WHERE doctor_id = 'd1000000-0000-0000-0000-000000000001'
  AND day_of_week = 6  -- Saturday
ON CONFLICT DO NOTHING;

-- ── 2. Delete duplicate time_slots for the duplicate doctor ──
DELETE FROM time_slots
WHERE doctor_id = 'd1000000-0000-0000-0000-000000000001';

-- ── 3. Delete duplicate doctor ──
DELETE FROM users
WHERE id = 'd1000000-0000-0000-0000-000000000001';

-- ── 4. Delete duplicate services ──
DELETE FROM services
WHERE id IN (
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000004',
  'a0000000-0000-0000-0000-000000000005'
);

COMMIT;
