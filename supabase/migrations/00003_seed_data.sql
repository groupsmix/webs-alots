-- ============================================================
-- Migration 00003: Seed Data for Testing
-- Creates sample clinics, users, services, appointments, etc.
-- for all 3 systems (Doctor, Dentist, Pharmacy)
-- ============================================================

-- NOTE: In production, user rows are created by the auth trigger.
-- For seeding, we insert directly into public.users with placeholder
-- auth_ids. Replace these with real Supabase Auth UIDs when connecting.

-- ============================================================
-- CLINICS
-- ============================================================

INSERT INTO clinics (id, name, type, tier, domain, config, is_active) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Cabinet Dr. Ahmed Benali', 'doctor', 'premium', 'dr-ahmed.ma', '{
    "specialty": "General Medicine",
    "languages": ["Arabic", "French"],
    "description": "Cabinet de medecine generale au coeur de Casablanca"
  }', TRUE),
  ('22222222-2222-2222-2222-222222222222', 'Dental Studio Marrakech', 'dentist', 'premium', 'dental-marrakech.ma', '{
    "specialty": "General Dentistry & Implants",
    "languages": ["Arabic", "French", "English"],
    "description": "Cabinet dentaire moderne a Marrakech"
  }', TRUE),
  ('33333333-3333-3333-3333-333333333333', 'Pharmacie Centrale Rabat', 'pharmacy', 'pro', 'pharmacie-rabat.ma', '{
    "onDuty": false,
    "deliveryAvailable": true,
    "description": "Pharmacie de quartier avec livraison a domicile"
  }', TRUE);

-- ============================================================
-- USERS (all roles)
-- ============================================================

-- Super Admin (no clinic_id — sees everything)
INSERT INTO users (id, auth_id, clinic_id, role, name, phone, email, is_active, metadata) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   NULL, 'super_admin', 'Admin Master', '+212600000000', 'admin@healthsaas.ma', TRUE,
   '{"note": "Platform owner"}');

-- ---- Doctor Clinic (clinic 1) ----
INSERT INTO users (id, auth_id, clinic_id, role, name, phone, email, is_active, metadata) VALUES
  -- Clinic Admin (is also the lead doctor)
  ('b1111111-1111-1111-1111-111111111111',
   'b1111111-1111-1111-1111-111111111111',
   '11111111-1111-1111-1111-111111111111', 'clinic_admin', 'Dr. Ahmed Benali', '+212612345678', 'ahmed@dr-ahmed.ma', TRUE,
   '{"specialty": "General Medicine", "consultationFee": 200, "languages": ["Arabic", "French"]}'),
  -- Doctor
  ('b2222222-2222-2222-2222-222222222222',
   'b2222222-2222-2222-2222-222222222222',
   '11111111-1111-1111-1111-111111111111', 'doctor', 'Dr. Fatima Zahra', '+212623456789', 'fatima@dr-ahmed.ma', TRUE,
   '{"specialty": "Pediatrics", "consultationFee": 250, "languages": ["Arabic", "French", "English"]}'),
  -- Receptionist
  ('b3333333-3333-3333-3333-333333333333',
   'b3333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', 'receptionist', 'Samira Alaoui', '+212634567890', 'samira@dr-ahmed.ma', TRUE,
   '{}'),
  -- Patients (doctor clinic)
  ('c1111111-1111-1111-1111-111111111111',
   'c1111111-1111-1111-1111-111111111111',
   '11111111-1111-1111-1111-111111111111', 'patient', 'Karim Mansouri', '+212611223344', 'karim@email.com', TRUE,
   '{"age": 35, "gender": "M", "dateOfBirth": "1991-03-12", "allergies": ["Penicillin"], "insurance": "CNSS"}'),
  ('c2222222-2222-2222-2222-222222222222',
   'c2222222-2222-2222-2222-222222222222',
   '11111111-1111-1111-1111-111111111111', 'patient', 'Nadia El Fassi', '+212622334455', 'nadia@email.com', TRUE,
   '{"age": 28, "gender": "F", "dateOfBirth": "1998-07-22", "insurance": null}'),
  ('c3333333-3333-3333-3333-333333333333',
   'c3333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', 'patient', 'Omar Tazi', '+212633445566', 'omar@email.com', TRUE,
   '{"age": 42, "gender": "M", "dateOfBirth": "1984-11-05", "allergies": ["Aspirin", "Sulfa"], "insurance": "CNOPS"}'),
  ('c4444444-4444-4444-4444-444444444444',
   'c4444444-4444-4444-4444-444444444444',
   '11111111-1111-1111-1111-111111111111', 'patient', 'Salma Berrada', '+212644556677', 'salma@email.com', TRUE,
   '{"age": 31, "gender": "F", "dateOfBirth": "1995-01-18", "insurance": "CNSS"}');

-- ---- Dentist Clinic (clinic 2) ----
INSERT INTO users (id, auth_id, clinic_id, role, name, phone, email, is_active, metadata) VALUES
  -- Clinic Admin (lead dentist)
  ('d1111111-1111-1111-1111-111111111111',
   'd1111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222', 'clinic_admin', 'Dr. Yassine Cherkaoui', '+212655667788', 'yassine@dental-marrakech.ma', TRUE,
   '{"specialty": "Implantology", "consultationFee": 300, "languages": ["Arabic", "French"]}'),
  -- Doctor (associate dentist)
  ('d2222222-2222-2222-2222-222222222222',
   'd2222222-2222-2222-2222-222222222222',
   '22222222-2222-2222-2222-222222222222', 'doctor', 'Dr. Houda Bennani', '+212666778899', 'houda@dental-marrakech.ma', TRUE,
   '{"specialty": "Orthodontics", "consultationFee": 350, "languages": ["Arabic", "French", "English"]}'),
  -- Receptionist
  ('d3333333-3333-3333-3333-333333333333',
   'd3333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', 'receptionist', 'Layla Moussaoui', '+212677889900', 'layla@dental-marrakech.ma', TRUE,
   '{}'),
  -- Patients (dentist clinic)
  ('e1111111-1111-1111-1111-111111111111',
   'e1111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222', 'patient', 'Hassan Idrissi', '+212655667700', 'hassan@email.com', TRUE,
   '{"age": 55, "gender": "M", "dateOfBirth": "1971-09-30"}'),
  ('e2222222-2222-2222-2222-222222222222',
   'e2222222-2222-2222-2222-222222222222',
   '22222222-2222-2222-2222-222222222222', 'patient', 'Amina Chaoui', '+212666778800', 'amina@email.com', TRUE,
   '{"age": 24, "gender": "F", "dateOfBirth": "2002-04-14", "allergies": ["Latex"]}');

-- ---- Pharmacy (clinic 3) ----
INSERT INTO users (id, auth_id, clinic_id, role, name, phone, email, is_active, metadata) VALUES
  -- Clinic Admin (pharmacist owner)
  ('f1111111-1111-1111-1111-111111111111',
   'f1111111-1111-1111-1111-111111111111',
   '33333333-3333-3333-3333-333333333333', 'clinic_admin', 'Dr. Rachid Bouazza', '+212688990011', 'rachid@pharmacie-rabat.ma', TRUE,
   '{"license": "PH-12345", "languages": ["Arabic", "French"]}'),
  -- Receptionist (pharmacy assistant)
  ('f2222222-2222-2222-2222-222222222222',
   'f2222222-2222-2222-2222-222222222222',
   '33333333-3333-3333-3333-333333333333', 'receptionist', 'Zineb Fassi', '+212699001122', 'zineb@pharmacie-rabat.ma', TRUE,
   '{}'),
  -- Patient (pharmacy customer)
  ('g1111111-1111-1111-1111-111111111111',
   'g1111111-1111-1111-1111-111111111111',
   '33333333-3333-3333-3333-333333333333', 'patient', 'Mouad Senhaji', '+212600112233', 'mouad@email.com', TRUE,
   '{"age": 60, "gender": "M", "dateOfBirth": "1966-06-15", "insurance": "CNSS"}'),
  ('g2222222-2222-2222-2222-222222222222',
   'g2222222-2222-2222-2222-222222222222',
   '33333333-3333-3333-3333-333333333333', 'patient', 'Khadija Ouazzani', '+212600223344', 'khadija@email.com', TRUE,
   '{"age": 45, "gender": "F", "dateOfBirth": "1981-12-03", "insurance": "CNOPS"}');

-- ============================================================
-- SERVICES
-- ============================================================

-- Doctor clinic services
INSERT INTO services (id, clinic_id, name, description, duration_min, price, is_active) VALUES
  ('s1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   'General Consultation', 'Comprehensive health check-up and medical consultation', 30, 200.00, TRUE),
  ('s2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111',
   'Follow-up Visit', 'Follow-up appointment for ongoing treatment or monitoring', 20, 150.00, TRUE),
  ('s3333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111',
   'Pediatric Consultation', 'Specialized medical consultation for children and infants', 30, 250.00, TRUE),
  ('s4444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111',
   'Cardiology Check-up', 'Heart health assessment including ECG and blood pressure', 45, 400.00, TRUE),
  ('s5555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111',
   'Blood Test', 'Complete blood panel analysis and lab work', 15, 100.00, TRUE);

-- Dentist clinic services
INSERT INTO services (id, clinic_id, name, description, duration_min, price, is_active) VALUES
  ('s6666666-6666-6666-6666-666666666666', '22222222-2222-2222-2222-222222222222',
   'Dental Cleaning', 'Professional teeth cleaning and polishing', 45, 300.00, TRUE),
  ('s7777777-7777-7777-7777-777777777777', '22222222-2222-2222-2222-222222222222',
   'Tooth Filling', 'Composite or amalgam dental filling', 60, 500.00, TRUE),
  ('s8888888-8888-8888-8888-888888888888', '22222222-2222-2222-2222-222222222222',
   'Dental Implant', 'Single tooth implant procedure', 120, 8000.00, TRUE),
  ('s9999999-9999-9999-9999-999999999999', '22222222-2222-2222-2222-222222222222',
   'Orthodontic Consultation', 'Braces assessment and treatment planning', 45, 400.00, TRUE),
  ('sa111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
   'Tooth Extraction', 'Simple or surgical tooth extraction', 30, 350.00, TRUE);

-- Pharmacy services
INSERT INTO services (id, clinic_id, name, description, duration_min, price, is_active) VALUES
  ('sb111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333',
   'Blood Pressure Check', 'Quick blood pressure measurement', 10, 0.00, TRUE),
  ('sc111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333',
   'Injection Service', 'Intramuscular or subcutaneous injection', 15, 30.00, TRUE),
  ('sd111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333',
   'Blood Sugar Test', 'Glucometer blood sugar reading', 10, 20.00, TRUE);

-- ============================================================
-- TIME SLOTS (doctor working hours)
-- ============================================================

-- Dr. Ahmed Benali - Mon to Fri 9-12 + 14-17, Sat 9-12
INSERT INTO time_slots (clinic_id, doctor_id, day_of_week, start_time, end_time, max_capacity, buffer_min, is_active) VALUES
  ('11111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 1, '09:00', '12:00', 1, 10, TRUE),
  ('11111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 1, '14:00', '17:00', 1, 10, TRUE),
  ('11111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 2, '09:00', '12:00', 1, 10, TRUE),
  ('11111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 2, '14:00', '17:00', 1, 10, TRUE),
  ('11111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 3, '09:00', '12:00', 1, 10, TRUE),
  ('11111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 3, '14:00', '17:00', 1, 10, TRUE),
  ('11111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 4, '09:00', '12:00', 1, 10, TRUE),
  ('11111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 4, '14:00', '17:00', 1, 10, TRUE),
  ('11111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 5, '09:00', '12:00', 1, 10, TRUE),
  ('11111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 5, '14:00', '17:00', 1, 10, TRUE),
  ('11111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 6, '09:00', '12:00', 1, 10, TRUE);

-- Dr. Fatima Zahra - Mon, Wed, Fri mornings
INSERT INTO time_slots (clinic_id, doctor_id, day_of_week, start_time, end_time, max_capacity, buffer_min, is_active) VALUES
  ('11111111-1111-1111-1111-111111111111', 'b2222222-2222-2222-2222-222222222222', 1, '09:00', '13:00', 1, 10, TRUE),
  ('11111111-1111-1111-1111-111111111111', 'b2222222-2222-2222-2222-222222222222', 3, '09:00', '13:00', 1, 10, TRUE),
  ('11111111-1111-1111-1111-111111111111', 'b2222222-2222-2222-2222-222222222222', 5, '09:00', '13:00', 1, 10, TRUE);

-- Dentist: Dr. Yassine - Mon-Fri
INSERT INTO time_slots (clinic_id, doctor_id, day_of_week, start_time, end_time, max_capacity, buffer_min, is_active) VALUES
  ('22222222-2222-2222-2222-222222222222', 'd1111111-1111-1111-1111-111111111111', 1, '09:00', '13:00', 1, 15, TRUE),
  ('22222222-2222-2222-2222-222222222222', 'd1111111-1111-1111-1111-111111111111', 1, '14:00', '18:00', 1, 15, TRUE),
  ('22222222-2222-2222-2222-222222222222', 'd1111111-1111-1111-1111-111111111111', 2, '09:00', '13:00', 1, 15, TRUE),
  ('22222222-2222-2222-2222-222222222222', 'd1111111-1111-1111-1111-111111111111', 2, '14:00', '18:00', 1, 15, TRUE),
  ('22222222-2222-2222-2222-222222222222', 'd1111111-1111-1111-1111-111111111111', 3, '09:00', '13:00', 1, 15, TRUE),
  ('22222222-2222-2222-2222-222222222222', 'd1111111-1111-1111-1111-111111111111', 3, '14:00', '18:00', 1, 15, TRUE),
  ('22222222-2222-2222-2222-222222222222', 'd1111111-1111-1111-1111-111111111111', 4, '09:00', '13:00', 1, 15, TRUE),
  ('22222222-2222-2222-2222-222222222222', 'd1111111-1111-1111-1111-111111111111', 4, '14:00', '18:00', 1, 15, TRUE),
  ('22222222-2222-2222-2222-222222222222', 'd1111111-1111-1111-1111-111111111111', 5, '09:00', '13:00', 1, 15, TRUE);

-- ============================================================
-- APPOINTMENTS (mix of statuses for realistic testing)
-- ============================================================

-- Doctor clinic appointments
INSERT INTO appointments (id, clinic_id, patient_id, doctor_id, service_id, appointment_date, start_time, end_time, status, is_first_visit, is_walk_in, insurance_flag, booking_source, notes) VALUES
  -- Today's appointments
  ('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   'c1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111',
   's1111111-1111-1111-1111-111111111111', CURRENT_DATE, '09:00', '09:30',
   'completed', FALSE, FALSE, TRUE, 'online', 'Regular check-up'),
  ('a2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111',
   'c2222222-2222-2222-2222-222222222222', 'b1111111-1111-1111-1111-111111111111',
   's2222222-2222-2222-2222-222222222222', CURRENT_DATE, '09:30', '09:50',
   'in_progress', FALSE, FALSE, FALSE, 'phone', NULL),
  ('a3333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111',
   'c3333333-3333-3333-3333-333333333333', 'b1111111-1111-1111-1111-111111111111',
   's4444444-4444-4444-4444-444444444444', CURRENT_DATE, '10:00', '10:45',
   'confirmed', TRUE, FALSE, TRUE, 'online', 'First visit - cardiology referral'),
  ('a4444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111',
   'c4444444-4444-4444-4444-444444444444', 'b2222222-2222-2222-2222-222222222222',
   's3333333-3333-3333-3333-333333333333', CURRENT_DATE, '10:30', '11:00',
   'pending', TRUE, FALSE, TRUE, 'whatsapp', 'Child vaccination appointment'),
  -- Tomorrow's appointments
  ('a5555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111',
   'c1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111',
   's1111111-1111-1111-1111-111111111111', CURRENT_DATE + INTERVAL '1 day', '09:00', '09:30',
   'confirmed', FALSE, FALSE, TRUE, 'online', NULL),
  -- Past appointments
  ('a6666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111',
   'c2222222-2222-2222-2222-222222222222', 'b1111111-1111-1111-1111-111111111111',
   's1111111-1111-1111-1111-111111111111', CURRENT_DATE - INTERVAL '3 days', '09:00', '09:30',
   'completed', TRUE, FALSE, FALSE, 'walk_in', NULL),
  ('a7777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111',
   'c3333333-3333-3333-3333-333333333333', 'b1111111-1111-1111-1111-111111111111',
   's2222222-2222-2222-2222-222222222222', CURRENT_DATE - INTERVAL '7 days', '14:00', '14:20',
   'no_show', FALSE, FALSE, TRUE, 'online', NULL),
  -- Walk-in
  ('a8888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111',
   'c4444444-4444-4444-4444-444444444444', 'b1111111-1111-1111-1111-111111111111',
   's5555555-5555-5555-5555-555555555555', CURRENT_DATE, '11:00', '11:15',
   'checked_in', FALSE, TRUE, FALSE, 'walk_in', 'Walk-in blood test');

-- Dentist clinic appointments
INSERT INTO appointments (id, clinic_id, patient_id, doctor_id, service_id, appointment_date, start_time, end_time, status, is_first_visit, is_walk_in, insurance_flag, booking_source, notes) VALUES
  ('ad111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
   'e1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111',
   's6666666-6666-6666-6666-666666666666', CURRENT_DATE, '09:00', '09:45',
   'completed', FALSE, FALSE, FALSE, 'online', 'Regular cleaning'),
  ('ad222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
   'e2222222-2222-2222-2222-222222222222', 'd1111111-1111-1111-1111-111111111111',
   's8888888-8888-8888-8888-888888888888', CURRENT_DATE, '10:00', '12:00',
   'confirmed', FALSE, FALSE, FALSE, 'phone', 'Implant procedure - upper right molar'),
  ('ad333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222',
   'e1111111-1111-1111-1111-111111111111', 'd2222222-2222-2222-2222-222222222222',
   's9999999-9999-9999-9999-999999999999', CURRENT_DATE + INTERVAL '2 days', '09:00', '09:45',
   'pending', FALSE, FALSE, FALSE, 'online', 'Orthodontic follow-up');

-- ============================================================
-- CONSULTATION NOTES (doctor system)
-- ============================================================

INSERT INTO consultation_notes (clinic_id, appointment_id, doctor_id, patient_id, notes, diagnosis) VALUES
  ('11111111-1111-1111-1111-111111111111',
   'a1111111-1111-1111-1111-111111111111',
   'b1111111-1111-1111-1111-111111111111',
   'c1111111-1111-1111-1111-111111111111',
   'Patient presents with mild headache and fatigue for the past 3 days. BP: 120/80. No fever.',
   'Tension headache - likely stress-related'),
  ('11111111-1111-1111-1111-111111111111',
   'a6666666-6666-6666-6666-666666666666',
   'b1111111-1111-1111-1111-111111111111',
   'c2222222-2222-2222-2222-222222222222',
   'First visit. Patient reports recurring sore throat. Tonsils slightly swollen. No pus visible.',
   'Acute pharyngitis');

-- ============================================================
-- PRESCRIPTIONS (doctor system)
-- ============================================================

INSERT INTO prescriptions (clinic_id, appointment_id, doctor_id, patient_id, items, notes) VALUES
  ('11111111-1111-1111-1111-111111111111',
   'a1111111-1111-1111-1111-111111111111',
   'b1111111-1111-1111-1111-111111111111',
   'c1111111-1111-1111-1111-111111111111',
   '[{"name": "Paracetamol 500mg", "dosage": "1 tablet every 6 hours as needed", "duration": "5 days"},
     {"name": "Magnesium B6", "dosage": "2 tablets at bedtime", "duration": "30 days"}]',
   'Rest recommended. Follow up in 2 weeks if symptoms persist.'),
  ('11111111-1111-1111-1111-111111111111',
   'a6666666-6666-6666-6666-666666666666',
   'b1111111-1111-1111-1111-111111111111',
   'c2222222-2222-2222-2222-222222222222',
   '[{"name": "Amoxicillin 500mg", "dosage": "1 tablet 3x per day", "duration": "7 days"},
     {"name": "Ibuprofen 400mg", "dosage": "1 tablet 2x per day after meals", "duration": "5 days"}]',
   'Drink plenty of fluids. Return if fever develops.');

-- ============================================================
-- FAMILY MEMBERS
-- ============================================================

INSERT INTO family_members (primary_user_id, member_user_id, relationship) VALUES
  ('c1111111-1111-1111-1111-111111111111', 'c4444444-4444-4444-4444-444444444444', 'spouse');

-- ============================================================
-- WAITING LIST
-- ============================================================

INSERT INTO waiting_list (clinic_id, patient_id, doctor_id, preferred_date, status) VALUES
  ('11111111-1111-1111-1111-111111111111',
   'c3333333-3333-3333-3333-333333333333',
   'b1111111-1111-1111-1111-111111111111',
   CURRENT_DATE + INTERVAL '1 day', 'waiting');

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

INSERT INTO notifications (clinic_id, user_id, type, channel, title, body, is_read) VALUES
  ('11111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111',
   'appointment_reminder', 'whatsapp', 'Appointment Tomorrow',
   'Reminder: You have an appointment with Dr. Ahmed Benali tomorrow at 09:00.', FALSE),
  ('11111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111',
   'new_booking', 'in_app', 'New Booking',
   'Salma Berrada has booked a Pediatric Consultation for today at 10:30.', FALSE),
  ('11111111-1111-1111-1111-111111111111', 'b3333333-3333-3333-3333-333333333333',
   'new_patient', 'in_app', 'New Patient Registered',
   'Omar Tazi has registered as a new patient via the online portal.', TRUE),
  ('22222222-2222-2222-2222-222222222222', 'e2222222-2222-2222-2222-222222222222',
   'appointment_confirmed', 'whatsapp', 'Appointment Confirmed',
   'Your implant procedure with Dr. Yassine is confirmed for today at 10:00.', FALSE);

-- ============================================================
-- PAYMENTS
-- ============================================================

INSERT INTO payments (clinic_id, appointment_id, patient_id, amount, method, status, reference) VALUES
  ('11111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111',
   'c1111111-1111-1111-1111-111111111111', 200.00, 'cash', 'completed', 'PAY-001'),
  ('11111111-1111-1111-1111-111111111111', 'a6666666-6666-6666-6666-666666666666',
   'c2222222-2222-2222-2222-222222222222', 200.00, 'card', 'completed', 'PAY-002'),
  ('11111111-1111-1111-1111-111111111111', 'a3333333-3333-3333-3333-333333333333',
   'c3333333-3333-3333-3333-333333333333', 400.00, 'transfer', 'pending', 'PAY-003'),
  ('22222222-2222-2222-2222-222222222222', 'ad111111-1111-1111-1111-111111111111',
   'e1111111-1111-1111-1111-111111111111', 300.00, 'cash', 'completed', 'PAY-D01');

-- ============================================================
-- REVIEWS
-- ============================================================

INSERT INTO reviews (clinic_id, patient_id, doctor_id, stars, comment, response, is_visible) VALUES
  ('11111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111',
   'b1111111-1111-1111-1111-111111111111', 5,
   'Excellent doctor, very professional and caring. The clinic is clean and well-organized.',
   'Thank you Karim! We appreciate your kind words.', TRUE),
  ('11111111-1111-1111-1111-111111111111', 'c2222222-2222-2222-2222-222222222222',
   'b1111111-1111-1111-1111-111111111111', 4,
   'Good experience overall. Wait time was a bit long but the consultation was thorough.',
   'Thank you for your feedback, we are working on reducing wait times.', TRUE),
  ('11111111-1111-1111-1111-111111111111', 'c3333333-3333-3333-3333-333333333333',
   'b1111111-1111-1111-1111-111111111111', 5,
   'Best doctor in the city. Very detailed explanations and follow-up.', NULL, TRUE),
  ('22222222-2222-2222-2222-222222222222', 'e1111111-1111-1111-1111-111111111111',
   'd1111111-1111-1111-1111-111111111111', 5,
   'Modern clinic with latest equipment. Dr. Yassine is very skilled and gentle.',
   'Thank you Hassan! Your trust means a lot.', TRUE),
  ('22222222-2222-2222-2222-222222222222', 'e2222222-2222-2222-2222-222222222222',
   'd2222222-2222-2222-2222-222222222222', 4,
   'Great orthodontist. Very patient with explanations.', NULL, TRUE);

-- ============================================================
-- DOCUMENTS
-- ============================================================

INSERT INTO documents (clinic_id, user_id, type, file_url, file_name, file_size) VALUES
  ('11111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111',
   'insurance', 'https://storage.example.com/docs/cnss-card-karim.pdf', 'CNSS-Card.pdf', 245000),
  ('11111111-1111-1111-1111-111111111111', 'c3333333-3333-3333-3333-333333333333',
   'lab_result', 'https://storage.example.com/docs/blood-test-omar.pdf', 'Blood-Test-Results.pdf', 189000),
  ('22222222-2222-2222-2222-222222222222', 'e1111111-1111-1111-1111-111111111111',
   'xray', 'https://storage.example.com/docs/xray-hassan.jpg', 'Dental-Xray.jpg', 1250000);

-- ============================================================
-- CLINIC HOLIDAYS
-- ============================================================

INSERT INTO clinic_holidays (clinic_id, title, start_date, end_date) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Eid Al Fitr', '2026-03-30', '2026-04-01'),
  ('11111111-1111-1111-1111-111111111111', 'Labour Day', '2026-05-01', '2026-05-01'),
  ('22222222-2222-2222-2222-222222222222', 'Eid Al Fitr', '2026-03-30', '2026-04-01'),
  ('33333333-3333-3333-3333-333333333333', 'Eid Al Fitr', '2026-03-30', '2026-04-01');

-- ============================================================
-- DENTIST EXTRAS
-- ============================================================

-- Odontogram for patient Hassan
INSERT INTO odontogram (clinic_id, patient_id, tooth_number, status, notes) VALUES
  ('22222222-2222-2222-2222-222222222222', 'e1111111-1111-1111-1111-111111111111', 14, 'filled', 'Composite filling done 2025-12'),
  ('22222222-2222-2222-2222-222222222222', 'e1111111-1111-1111-1111-111111111111', 16, 'crown', 'Ceramic crown placed 2025-06'),
  ('22222222-2222-2222-2222-222222222222', 'e1111111-1111-1111-1111-111111111111', 26, 'decayed', 'Needs filling - scheduled'),
  ('22222222-2222-2222-2222-222222222222', 'e1111111-1111-1111-1111-111111111111', 36, 'missing', 'Extracted 2024-11 - implant planned'),
  ('22222222-2222-2222-2222-222222222222', 'e1111111-1111-1111-1111-111111111111', 18, 'healthy', NULL);

-- Odontogram for patient Amina
INSERT INTO odontogram (clinic_id, patient_id, tooth_number, status, notes) VALUES
  ('22222222-2222-2222-2222-222222222222', 'e2222222-2222-2222-2222-222222222222', 11, 'healthy', NULL),
  ('22222222-2222-2222-2222-222222222222', 'e2222222-2222-2222-2222-222222222222', 21, 'healthy', NULL),
  ('22222222-2222-2222-2222-222222222222', 'e2222222-2222-2222-2222-222222222222', 36, 'decayed', 'Small cavity - watch');

-- Treatment plan for Hassan (implant)
INSERT INTO treatment_plans (id, clinic_id, patient_id, doctor_id, title, steps, total_cost, status) VALUES
  ('tp111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222',
   'e1111111-1111-1111-1111-111111111111',
   'd1111111-1111-1111-1111-111111111111',
   'Lower Left Molar Implant (#36)',
   '[
     {"step": 1, "description": "Initial consultation and X-ray", "status": "completed", "date": "2026-02-15"},
     {"step": 2, "description": "Bone assessment and CT scan", "status": "completed", "date": "2026-03-01"},
     {"step": 3, "description": "Implant placement surgery", "status": "in_progress", "date": "2026-03-19"},
     {"step": 4, "description": "Healing period (3 months)", "status": "pending", "date": null},
     {"step": 5, "description": "Abutment placement", "status": "pending", "date": null},
     {"step": 6, "description": "Crown fitting", "status": "pending", "date": null}
   ]',
   12000.00, 'in_progress');

-- Installments for treatment plan
INSERT INTO installments (clinic_id, treatment_plan_id, patient_id, amount, due_date, paid_date, status) VALUES
  ('22222222-2222-2222-2222-222222222222', 'tp111111-1111-1111-1111-111111111111',
   'e1111111-1111-1111-1111-111111111111', 4000.00, '2026-02-15', '2026-02-15', 'paid'),
  ('22222222-2222-2222-2222-222222222222', 'tp111111-1111-1111-1111-111111111111',
   'e1111111-1111-1111-1111-111111111111', 4000.00, '2026-03-15', '2026-03-14', 'paid'),
  ('22222222-2222-2222-2222-222222222222', 'tp111111-1111-1111-1111-111111111111',
   'e1111111-1111-1111-1111-111111111111', 4000.00, '2026-04-15', NULL, 'pending');

-- Lab order
INSERT INTO lab_orders (clinic_id, patient_id, doctor_id, lab_name, description, status, due_date) VALUES
  ('22222222-2222-2222-2222-222222222222', 'e1111111-1111-1111-1111-111111111111',
   'd1111111-1111-1111-1111-111111111111', 'DentalLab Marrakech',
   'Custom titanium implant post for tooth #36', 'in_progress', '2026-03-25');

-- Sterilization log
INSERT INTO sterilization_log (clinic_id, tool_name, sterilized_by, sterilized_at, next_due, notes) VALUES
  ('22222222-2222-2222-2222-222222222222', 'Implant Kit A', 'd3333333-3333-3333-3333-333333333333',
   now() - INTERVAL '2 hours', now() + INTERVAL '22 hours', 'Autoclave cycle 134C 18min'),
  ('22222222-2222-2222-2222-222222222222', 'Extraction Forceps Set', 'd3333333-3333-3333-3333-333333333333',
   now() - INTERVAL '4 hours', now() + INTERVAL '20 hours', 'Autoclave cycle 134C 18min');

-- ============================================================
-- PHARMACY EXTRAS
-- ============================================================

-- Products catalog
INSERT INTO products (id, clinic_id, name, category, description, price, requires_prescription, is_active) VALUES
  ('pr111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333',
   'Doliprane 500mg', 'Pain Relief', 'Paracetamol 500mg - Box of 16 tablets', 15.00, FALSE, TRUE),
  ('pr222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333',
   'Amoxicillin 500mg', 'Antibiotics', 'Amoxicillin capsules - Box of 24', 45.00, TRUE, TRUE),
  ('pr333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333',
   'Vitamin D3 1000UI', 'Vitamins', 'Cholecalciferol drops 30ml', 85.00, FALSE, TRUE),
  ('pr444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333',
   'Glucophage 850mg', 'Diabetes', 'Metformin 850mg - Box of 30 tablets', 35.00, TRUE, TRUE),
  ('pr555555-5555-5555-5555-555555555555', '33333333-3333-3333-3333-333333333333',
   'Tensionorm 5mg', 'Hypertension', 'Amlodipine 5mg - Box of 30 tablets', 55.00, TRUE, TRUE),
  ('pr666666-6666-6666-6666-666666666666', '33333333-3333-3333-3333-333333333333',
   'Surgical Masks (50)', 'Medical Supplies', 'Disposable surgical masks, box of 50', 40.00, FALSE, TRUE),
  ('pr777777-7777-7777-7777-777777777777', '33333333-3333-3333-3333-333333333333',
   'Hand Sanitizer 500ml', 'Hygiene', 'Alcohol-based hand sanitizer gel', 25.00, FALSE, TRUE);

-- Stock
INSERT INTO stock (clinic_id, product_id, quantity, min_threshold, expiry_date, batch_number) VALUES
  ('33333333-3333-3333-3333-333333333333', 'pr111111-1111-1111-1111-111111111111', 150, 20, '2027-06-30', 'DOL-2026-A1'),
  ('33333333-3333-3333-3333-333333333333', 'pr222222-2222-2222-2222-222222222222', 45, 15, '2027-03-15', 'AMX-2025-B3'),
  ('33333333-3333-3333-3333-333333333333', 'pr333333-3333-3333-3333-333333333333', 60, 10, '2028-01-01', 'VTD-2026-C1'),
  ('33333333-3333-3333-3333-333333333333', 'pr444444-4444-4444-4444-444444444444', 8, 15, '2027-09-30', 'GLU-2026-D2'),  -- low stock!
  ('33333333-3333-3333-3333-333333333333', 'pr555555-5555-5555-5555-555555555555', 35, 10, '2027-12-31', 'TEN-2026-E1'),
  ('33333333-3333-3333-3333-333333333333', 'pr666666-6666-6666-6666-666666666666', 200, 50, NULL, 'MSK-2026-F1'),
  ('33333333-3333-3333-3333-333333333333', 'pr777777-7777-7777-7777-777777777777', 3, 5, '2027-04-15', 'SAN-2026-G1');  -- low stock!

-- Suppliers
INSERT INTO suppliers (id, clinic_id, name, contact_phone, contact_email, address) VALUES
  ('su111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333',
   'Pharma Distribution Maroc', '+212522334455', 'contact@pharma-distrib.ma', '123 Blvd Mohammed V, Casablanca'),
  ('su222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333',
   'MedSupply SARL', '+212522445566', 'orders@medsupply.ma', '45 Rue Al Madina, Rabat'),
  ('su333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333',
   'Sante Plus Distribution', '+212522556677', 'info@santeplus.ma', '78 Avenue Hassan II, Rabat');

-- Purchase order (for restocking low items)
INSERT INTO purchase_orders (id, clinic_id, supplier_id, status, total_amount, notes, ordered_at) VALUES
  ('po111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333',
   'su111111-1111-1111-1111-111111111111', 'confirmed', 1750.00,
   'Urgent restock - Glucophage and Sanitizer running low', now() - INTERVAL '1 day');

INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity, unit_price) VALUES
  ('po111111-1111-1111-1111-111111111111', 'pr444444-4444-4444-4444-444444444444', 30, 28.00),
  ('po111111-1111-1111-1111-111111111111', 'pr777777-7777-7777-7777-777777777777', 20, 17.50);

-- Prescription requests
INSERT INTO prescription_requests (clinic_id, patient_id, image_url, status, notes, delivery_requested) VALUES
  ('33333333-3333-3333-3333-333333333333', 'g1111111-1111-1111-1111-111111111111',
   'https://storage.example.com/rx/prescription-mouad.jpg', 'ready',
   'All items available. Ready for pickup.', FALSE),
  ('33333333-3333-3333-3333-333333333333', 'g2222222-2222-2222-2222-222222222222',
   'https://storage.example.com/rx/prescription-khadija.jpg', 'partial',
   '2 of 3 items available. Tensionorm on order.', TRUE);

-- Loyalty points
INSERT INTO loyalty_points (clinic_id, patient_id, points, last_earned) VALUES
  ('33333333-3333-3333-3333-333333333333', 'g1111111-1111-1111-1111-111111111111', 450, now() - INTERVAL '2 days'),
  ('33333333-3333-3333-3333-333333333333', 'g2222222-2222-2222-2222-222222222222', 1200, now() - INTERVAL '5 days');

-- Loyalty transactions
INSERT INTO loyalty_transactions (clinic_id, patient_id, points, reason) VALUES
  ('33333333-3333-3333-3333-333333333333', 'g1111111-1111-1111-1111-111111111111', 200, 'Purchase - Doliprane + Vitamin D3'),
  ('33333333-3333-3333-3333-333333333333', 'g1111111-1111-1111-1111-111111111111', 250, 'Purchase - Glucophage + Masks'),
  ('33333333-3333-3333-3333-333333333333', 'g2222222-2222-2222-2222-222222222222', 500, 'Purchase - Monthly medications'),
  ('33333333-3333-3333-3333-333333333333', 'g2222222-2222-2222-2222-222222222222', 800, 'Purchase - Family medications'),
  ('33333333-3333-3333-3333-333333333333', 'g2222222-2222-2222-2222-222222222222', -100, 'Redeemed - Discount on purchase');
