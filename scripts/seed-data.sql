-- Oltigo Seed Data
-- Usage: psql -h localhost -p 54322 -U postgres -d postgres -f scripts/seed-data.sql
--
-- Creates sample data covering all clinic types and user roles
-- for local development and testing.

-- ============================================================
-- 1. Sample Clinics (one per type)
-- ============================================================

INSERT INTO clinics (id, name, subdomain, clinic_type, tier, is_active, settings)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Cabinet Dr. Ahmed', 'dr-ahmed', 'doctor', 'pro', true,
   '{"primary_color":"#2563eb","secondary_color":"#1e40af","timezone":"Africa/Casablanca","ramadan_mode":false}'::jsonb),
  ('00000000-0000-0000-0000-000000000002', 'Clinique Dentaire Sourire', 'sourire-dental', 'dentist', 'cabinet', true,
   '{"primary_color":"#0891b2","secondary_color":"#0e7490","timezone":"Africa/Casablanca"}'::jsonb),
  ('00000000-0000-0000-0000-000000000003', 'Pharmacie Centrale', 'pharmacie-centrale', 'pharmacy', 'vitrine', true,
   '{"primary_color":"#16a34a","secondary_color":"#15803d","timezone":"Africa/Casablanca"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. Sample Users (various roles)
-- ============================================================
-- Note: auth.users must be created via Supabase Auth API or dashboard.
-- These inserts assume auth_id values from test accounts created there.
-- Adjust auth_id values to match your local Supabase Auth users.

-- Use these credentials to test:
--   admin@test.com / password123   -> clinic_admin for dr-ahmed
--   doctor@test.com / password123  -> doctor for dr-ahmed
--   patient@test.com / password123 -> patient

-- ============================================================
-- 3. Sample Services
-- ============================================================

INSERT INTO services (id, clinic_id, name, description, duration_minutes, price, is_active)
VALUES
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000001',
   'Consultation generale', 'Consultation medicale generale', 30, 200.00, true),
  ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0000-000000000001',
   'Suivi chronique', 'Suivi maladie chronique (diabete, hypertension)', 20, 150.00, true),
  ('00000000-0000-0000-0001-000000000003', '00000000-0000-0000-0000-000000000002',
   'Detartrage', 'Nettoyage dentaire professionnel', 45, 300.00, true),
  ('00000000-0000-0000-0001-000000000004', '00000000-0000-0000-0000-000000000002',
   'Blanchiment', 'Blanchiment dentaire professionnel', 60, 1500.00, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 4. Sample Working Hours
-- ============================================================

-- Dr. Ahmed works Mon-Fri, 09:00-12:30 and 14:00-18:00
-- (Example for a single doctor — adjust user_id after creating auth users)

-- ============================================================
-- 5. Quick Reference
-- ============================================================
-- After seeding, you can log in with the test accounts above.
-- The subdomain routing in development uses:
--   http://dr-ahmed.localhost:3000  -> Doctor dashboard
--   http://sourire-dental.localhost:3000 -> Dentist dashboard
--   http://pharmacie-centrale.localhost:3000 -> Pharmacy dashboard
--
-- Or use the main app at http://localhost:3000 for the landing page.
