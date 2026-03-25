-- ============================================================
-- Migration 00040: Repopulate test clinic data
--
-- After deleting seed users (migration 00019 cleanup), the
-- ON DELETE CASCADE on time_slots.doctor_id removed all time
-- slots for the seed clinic.  This migration creates a fresh
-- doctor, services (if missing), and time slots so the booking
-- flow can be verified end-to-end.
--
-- Safe to run multiple times (all INSERTs use ON CONFLICT).
-- No auth.users entries are created — the doctor cannot log in.
-- ============================================================

-- Known clinic ID (seed clinic, subdomain: dr-ahmed)
-- UUIDs use only hex characters (0-9, a-f).
-- Clinic:  c1000000 → keep as-is (valid hex)
-- Doctor:  d1000000 → keep as-is (valid hex)
-- Services: use a1-a5 prefix instead of invalid "s" prefix
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM clinics WHERE id = 'c1000000-0000-0000-0000-000000000001'
  ) THEN
    RAISE EXCEPTION 'Seed clinic c1000000-...0001 does not exist. Aborting.';
  END IF;
END $$;

-- ============================================================
-- DOCTOR (no auth_id — booking-only, cannot log in)
-- ============================================================

INSERT INTO users (id, auth_id, role, name, phone, email, clinic_id, metadata)
VALUES (
  'd1000000-0000-0000-0000-000000000001',
  NULL,
  'doctor',
  'Dr. Ahmed Benali',
  '+212611000002',
  'ahmed@dr-benali.ma',
  'c1000000-0000-0000-0000-000000000001',
  '{
    "specialty_id": "a0000000-0000-0000-0000-0000000000a0",
    "specialty": "General Medicine",
    "consultation_fee": 300,
    "languages": ["fr", "ar"]
  }'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SERVICES (re-create if cascade-deleted or missing)
-- ============================================================

INSERT INTO services (id, clinic_id, name, price, duration_minutes, category)
VALUES
  ('a0000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000001',
   'General Consultation', 300.00, 30, 'consultation'),
  ('a0000000-0000-0000-0000-000000000002',
   'c1000000-0000-0000-0000-000000000001',
   'Follow-up Visit', 200.00, 20, 'follow-up'),
  ('a0000000-0000-0000-0000-000000000003',
   'c1000000-0000-0000-0000-000000000001',
   'ECG Checkup', 500.00, 45, 'diagnostic'),
  ('a0000000-0000-0000-0000-000000000004',
   'c1000000-0000-0000-0000-000000000001',
   'Blood Pressure Check', 150.00, 15, 'screening'),
  ('a0000000-0000-0000-0000-000000000005',
   'c1000000-0000-0000-0000-000000000001',
   'Vaccination', 200.00, 15, 'vaccination')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- TIME SLOTS (Mon-Fri 09:00-12:00 & 14:00-17:00)
--
-- Uses the new doctor ID. The is_active column (added by
-- migration 00005) defaults to TRUE; is_available (original
-- schema) is also set to TRUE for clarity.
-- ============================================================

INSERT INTO time_slots (doctor_id, clinic_id, day_of_week, start_time, end_time, is_available, is_active, max_capacity, buffer_minutes)
VALUES
  -- Monday (1)
  ('d1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 1, '09:00', '12:00', TRUE, TRUE, 1, 10),
  ('d1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 1, '14:00', '17:00', TRUE, TRUE, 1, 10),
  -- Tuesday (2)
  ('d1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 2, '09:00', '12:00', TRUE, TRUE, 1, 10),
  ('d1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 2, '14:00', '17:00', TRUE, TRUE, 1, 10),
  -- Wednesday (3)
  ('d1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 3, '09:00', '12:00', TRUE, TRUE, 1, 10),
  ('d1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 3, '14:00', '17:00', TRUE, TRUE, 1, 10),
  -- Thursday (4)
  ('d1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 4, '09:00', '12:00', TRUE, TRUE, 1, 10),
  ('d1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 4, '14:00', '17:00', TRUE, TRUE, 1, 10),
  -- Friday (5)
  ('d1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 5, '09:00', '12:00', TRUE, TRUE, 1, 10),
  ('d1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 5, '14:00', '17:00', TRUE, TRUE, 1, 10),
  -- Saturday (6) morning only
  ('d1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 6, '09:00', '13:00', TRUE, TRUE, 1, 10);
