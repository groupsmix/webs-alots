-- ============================================================
-- SEED DATA for Health SaaS Platform
-- Creates test data for all 3 clinic types with all 5 roles
-- ============================================================

-- ============================================================
-- CLINICS
-- ============================================================

INSERT INTO clinics (id, name, type, tier, domain, is_active, config) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Cabinet Dr. Benali', 'doctor', 'pro', 'dr-benali.health-saas.ma', TRUE,
    '{"locale": "fr", "currency": "MAD", "city": "Casablanca", "phone": "+212 5 22 33 44 55"}'::jsonb),
  ('c1000000-0000-0000-0000-000000000002', 'Clinique Dentaire Smile', 'dentist', 'premium', 'smile-dental.health-saas.ma', TRUE,
    '{"locale": "fr", "currency": "MAD", "city": "Rabat", "phone": "+212 5 37 44 55 66"}'::jsonb),
  ('c1000000-0000-0000-0000-000000000003', 'Pharmacie Al Shifa', 'pharmacy', 'cabinet', 'alshifa-pharma.health-saas.ma', TRUE,
    '{"locale": "fr", "currency": "MAD", "city": "Marrakech", "phone": "+212 5 24 55 66 77"}'::jsonb),
  ('c1000000-0000-0000-0000-000000000004', 'Cabinet Medical El Fassi', 'doctor', 'vitrine', 'el-fassi.health-saas.ma', TRUE,
    '{"locale": "fr", "currency": "MAD", "city": "Fes", "phone": "+212 5 35 66 77 88"}'::jsonb),
  ('c1000000-0000-0000-0000-000000000005', 'Clinique Dentaire Perle', 'dentist', 'pro', 'perle-dental.health-saas.ma', FALSE,
    '{"locale": "fr", "currency": "MAD", "city": "Tanger", "phone": "+212 5 39 77 88 99"}'::jsonb),
  ('c1000000-0000-0000-0000-000000000006', 'Pharmacie Centrale', 'pharmacy', 'saas', 'centrale-pharma.health-saas.ma', TRUE,
    '{"locale": "fr", "currency": "MAD", "city": "Agadir", "phone": "+212 5 28 88 99 00"}'::jsonb);

-- ============================================================
-- USERS (all roles)
-- Note: auth_id is NULL for seed data since these aren't linked
-- to Supabase Auth users yet. In production, the auth trigger
-- handles this automatically.
-- ============================================================

-- Super Admin (no clinic)
INSERT INTO users (id, clinic_id, role, name, phone, email, is_active) VALUES
  ('u1000000-0000-0000-0000-000000000001', NULL, 'super_admin', 'Admin Platform', '+212 6 00 00 00 01', 'admin@health-saas.ma', TRUE);

-- ---- Clinic 1: Cabinet Dr. Benali (doctor) ----

-- Clinic Admin
INSERT INTO users (id, clinic_id, role, name, phone, email, is_active) VALUES
  ('u1000000-0000-0000-0000-000000000010', 'c1000000-0000-0000-0000-000000000001', 'clinic_admin', 'Nadia Benali', '+212 6 11 00 00 01', 'nadia@dr-benali.ma', TRUE);

-- Receptionist
INSERT INTO users (id, clinic_id, role, name, phone, email, is_active) VALUES
  ('u1000000-0000-0000-0000-000000000011', 'c1000000-0000-0000-0000-000000000001', 'receptionist', 'Amina Tazi', '+212 6 11 00 00 02', 'amina@dr-benali.ma', TRUE);

-- Doctors
INSERT INTO users (id, clinic_id, role, name, phone, email, is_active, metadata) VALUES
  ('u1000000-0000-0000-0000-000000000012', 'c1000000-0000-0000-0000-000000000001', 'doctor', 'Dr. Ahmed Benali', '+212 6 11 00 00 03', 'ahmed@dr-benali.ma', TRUE,
    '{"specialty": "General Medicine", "consultationFee": 300, "languages": ["Arabic", "French", "English"]}'::jsonb),
  ('u1000000-0000-0000-0000-000000000013', 'c1000000-0000-0000-0000-000000000001', 'doctor', 'Dr. Youssef El Amrani', '+212 6 11 00 00 04', 'youssef@dr-benali.ma', TRUE,
    '{"specialty": "Cardiology", "consultationFee": 500, "languages": ["Arabic", "French"]}'::jsonb),
  ('u1000000-0000-0000-0000-000000000014', 'c1000000-0000-0000-0000-000000000001', 'doctor', 'Dr. Samira Idrissi', '+212 6 11 00 00 05', 'samira@dr-benali.ma', TRUE,
    '{"specialty": "Pediatrics", "consultationFee": 350, "languages": ["Arabic", "French", "English"]}'::jsonb);

-- Patients (Clinic 1)
INSERT INTO users (id, clinic_id, role, name, phone, email, is_active, metadata) VALUES
  ('u1000000-0000-0000-0000-000000000020', 'c1000000-0000-0000-0000-000000000001', 'patient', 'Fatima Zahra Mansouri', '+212 6 22 11 33 44', 'fatima.m@gmail.com', TRUE,
    '{"age": 35, "gender": "F", "insurance": "CNSS"}'::jsonb),
  ('u1000000-0000-0000-0000-000000000021', 'c1000000-0000-0000-0000-000000000001', 'patient', 'Hassan Bourkia', '+212 6 33 22 44 55', 'hassan.b@gmail.com', TRUE,
    '{"age": 42, "gender": "M", "insurance": "CNOPS"}'::jsonb),
  ('u1000000-0000-0000-0000-000000000022', 'c1000000-0000-0000-0000-000000000001', 'patient', 'Khadija Alaoui', '+212 6 44 33 55 66', 'khadija.a@gmail.com', TRUE,
    '{"age": 28, "gender": "F", "insurance": null}'::jsonb),
  ('u1000000-0000-0000-0000-000000000023', 'c1000000-0000-0000-0000-000000000001', 'patient', 'Omar El Fassi', '+212 6 55 44 66 77', 'omar.f@gmail.com', TRUE,
    '{"age": 55, "gender": "M", "insurance": "CNSS"}'::jsonb),
  ('u1000000-0000-0000-0000-000000000024', 'c1000000-0000-0000-0000-000000000001', 'patient', 'Youssef Tazi', '+212 6 66 55 77 88', 'youssef.t@gmail.com', TRUE,
    '{"age": 19, "gender": "M", "insurance": null}'::jsonb),
  ('u1000000-0000-0000-0000-000000000025', 'c1000000-0000-0000-0000-000000000001', 'patient', 'Laila Berrada', '+212 6 77 66 88 99', 'laila.b@gmail.com', TRUE,
    '{"age": 32, "gender": "F", "insurance": "CNOPS"}'::jsonb);

-- ---- Clinic 2: Clinique Dentaire Smile (dentist) ----

INSERT INTO users (id, clinic_id, role, name, phone, email, is_active) VALUES
  ('u1000000-0000-0000-0000-000000000030', 'c1000000-0000-0000-0000-000000000002', 'clinic_admin', 'Rachid Amrani', '+212 6 22 00 00 01', 'rachid@smile-dental.ma', TRUE),
  ('u1000000-0000-0000-0000-000000000031', 'c1000000-0000-0000-0000-000000000002', 'receptionist', 'Salma Fikri', '+212 6 22 00 00 02', 'salma@smile-dental.ma', TRUE);

INSERT INTO users (id, clinic_id, role, name, phone, email, is_active, metadata) VALUES
  ('u1000000-0000-0000-0000-000000000032', 'c1000000-0000-0000-0000-000000000002', 'doctor', 'Dr. Hicham Chraibi', '+212 6 22 00 00 03', 'hicham@smile-dental.ma', TRUE,
    '{"specialty": "Orthodontics", "consultationFee": 400, "languages": ["Arabic", "French"]}'::jsonb),
  ('u1000000-0000-0000-0000-000000000033', 'c1000000-0000-0000-0000-000000000002', 'doctor', 'Dr. Leila Bennani', '+212 6 22 00 00 04', 'leila@smile-dental.ma', TRUE,
    '{"specialty": "Endodontics", "consultationFee": 450, "languages": ["Arabic", "French", "English"]}'::jsonb);

INSERT INTO users (id, clinic_id, role, name, phone, email, is_active, metadata) VALUES
  ('u1000000-0000-0000-0000-000000000034', 'c1000000-0000-0000-0000-000000000002', 'patient', 'Mehdi Tahiri', '+212 6 88 11 22 33', 'mehdi.t@gmail.com', TRUE,
    '{"age": 30, "gender": "M", "insurance": "CNSS"}'::jsonb),
  ('u1000000-0000-0000-0000-000000000035', 'c1000000-0000-0000-0000-000000000002', 'patient', 'Zineb Ouazzani', '+212 6 99 22 33 44', 'zineb.o@gmail.com', TRUE,
    '{"age": 25, "gender": "F", "insurance": null}'::jsonb);

-- ---- Clinic 3: Pharmacie Al Shifa (pharmacy) ----

INSERT INTO users (id, clinic_id, role, name, phone, email, is_active) VALUES
  ('u1000000-0000-0000-0000-000000000040', 'c1000000-0000-0000-0000-000000000003', 'clinic_admin', 'Karim Hassani', '+212 6 33 00 00 01', 'karim@alshifa.ma', TRUE),
  ('u1000000-0000-0000-0000-000000000041', 'c1000000-0000-0000-0000-000000000003', 'receptionist', 'Houda Ziani', '+212 6 33 00 00 02', 'houda@alshifa.ma', TRUE);

INSERT INTO users (id, clinic_id, role, name, phone, email, is_active, metadata) VALUES
  ('u1000000-0000-0000-0000-000000000042', 'c1000000-0000-0000-0000-000000000003', 'patient', 'Abdelaziz Rami', '+212 6 11 88 99 00', 'abdelaziz.r@gmail.com', TRUE,
    '{"age": 60, "gender": "M", "insurance": "CNOPS"}'::jsonb),
  ('u1000000-0000-0000-0000-000000000043', 'c1000000-0000-0000-0000-000000000003', 'patient', 'Naima Benhaddou', '+212 6 22 99 00 11', 'naima.b@gmail.com', TRUE,
    '{"age": 45, "gender": "F", "insurance": "CNSS"}'::jsonb);

-- ============================================================
-- SERVICES (Clinic 1 — Doctor)
-- ============================================================

INSERT INTO services (id, clinic_id, name, description, duration_min, price, is_active) VALUES
  ('s1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'General Consultation', 'Complete health check-up and medical consultation', 30, 300.00, TRUE),
  ('s1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 'Follow-up Visit', 'Follow-up appointment for ongoing treatment', 20, 200.00, TRUE),
  ('s1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 'ECG Checkup', 'Electrocardiogram test and analysis', 45, 500.00, TRUE),
  ('s1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000001', 'Blood Pressure Check', 'Blood pressure monitoring and consultation', 15, 150.00, TRUE),
  ('s1000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000001', 'Vaccination', 'Standard vaccination administration', 15, 200.00, TRUE),
  ('s1000000-0000-0000-0000-000000000006', 'c1000000-0000-0000-0000-000000000001', 'Pediatric Consultation', 'Child health check-up', 30, 350.00, TRUE);

-- ============================================================
-- SERVICES (Clinic 2 — Dentist)
-- ============================================================

INSERT INTO services (id, clinic_id, name, description, duration_min, price, is_active) VALUES
  ('s1000000-0000-0000-0000-000000000010', 'c1000000-0000-0000-0000-000000000002', 'Dental Check-up', 'Comprehensive dental examination', 30, 300.00, TRUE),
  ('s1000000-0000-0000-0000-000000000011', 'c1000000-0000-0000-0000-000000000002', 'Teeth Cleaning', 'Professional dental cleaning and polishing', 45, 400.00, TRUE),
  ('s1000000-0000-0000-0000-000000000012', 'c1000000-0000-0000-0000-000000000002', 'Tooth Filling', 'Composite or amalgam filling', 60, 600.00, TRUE),
  ('s1000000-0000-0000-0000-000000000013', 'c1000000-0000-0000-0000-000000000002', 'Root Canal', 'Root canal treatment', 90, 1500.00, TRUE),
  ('s1000000-0000-0000-0000-000000000014', 'c1000000-0000-0000-0000-000000000002', 'Orthodontic Consultation', 'Braces and alignment consultation', 45, 500.00, TRUE);

-- ============================================================
-- TIME SLOTS (Clinic 1)
-- ============================================================

-- Dr. Ahmed Benali — Mon-Fri 09:00-17:00, Sat 09:00-13:00
INSERT INTO time_slots (clinic_id, doctor_id, day_of_week, start_time, end_time, max_capacity, buffer_min, is_active) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'u1000000-0000-0000-0000-000000000012', 1, '09:00', '12:00', 1, 10, TRUE),
  ('c1000000-0000-0000-0000-000000000001', 'u1000000-0000-0000-0000-000000000012', 1, '14:00', '17:00', 1, 10, TRUE),
  ('c1000000-0000-0000-0000-000000000001', 'u1000000-0000-0000-0000-000000000012', 2, '09:00', '12:00', 1, 10, TRUE),
  ('c1000000-0000-0000-0000-000000000001', 'u1000000-0000-0000-0000-000000000012', 2, '14:00', '17:00', 1, 10, TRUE),
  ('c1000000-0000-0000-0000-000000000001', 'u1000000-0000-0000-0000-000000000012', 3, '09:00', '12:00', 1, 10, TRUE),
  ('c1000000-0000-0000-0000-000000000001', 'u1000000-0000-0000-0000-000000000012', 3, '14:00', '17:00', 1, 10, TRUE),
  ('c1000000-0000-0000-0000-000000000001', 'u1000000-0000-0000-0000-000000000012', 4, '09:00', '12:00', 1, 10, TRUE),
  ('c1000000-0000-0000-0000-000000000001', 'u1000000-0000-0000-0000-000000000012', 4, '14:00', '17:00', 1, 10, TRUE),
  ('c1000000-0000-0000-0000-000000000001', 'u1000000-0000-0000-0000-000000000012', 5, '09:00', '12:00', 1, 10, TRUE),
  ('c1000000-0000-0000-0000-000000000001', 'u1000000-0000-0000-0000-000000000012', 5, '14:00', '17:00', 1, 10, TRUE),
  ('c1000000-0000-0000-0000-000000000001', 'u1000000-0000-0000-0000-000000000012', 6, '09:00', '13:00', 1, 10, TRUE);

-- Dr. Youssef El Amrani — Mon, Wed, Fri
INSERT INTO time_slots (clinic_id, doctor_id, day_of_week, start_time, end_time, max_capacity, buffer_min, is_active) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'u1000000-0000-0000-0000-000000000013', 1, '09:00', '12:00', 1, 15, TRUE),
  ('c1000000-0000-0000-0000-000000000001', 'u1000000-0000-0000-0000-000000000013', 1, '14:00', '17:00', 1, 15, TRUE),
  ('c1000000-0000-0000-0000-000000000001', 'u1000000-0000-0000-0000-000000000013', 3, '09:00', '12:00', 1, 15, TRUE),
  ('c1000000-0000-0000-0000-000000000001', 'u1000000-0000-0000-0000-000000000013', 3, '14:00', '17:00', 1, 15, TRUE),
  ('c1000000-0000-0000-0000-000000000001', 'u1000000-0000-0000-0000-000000000013', 5, '09:00', '12:00', 1, 15, TRUE),
  ('c1000000-0000-0000-0000-000000000001', 'u1000000-0000-0000-0000-000000000013', 5, '14:00', '17:00', 1, 15, TRUE);

-- ============================================================
-- APPOINTMENTS (Clinic 1)
-- ============================================================

INSERT INTO appointments (id, clinic_id, patient_id, doctor_id, service_id, appointment_date, start_time, end_time, status, is_first_visit, is_walk_in, insurance_flag, booking_source, notes) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001',
    'u1000000-0000-0000-0000-000000000020', 'u1000000-0000-0000-0000-000000000012',
    's1000000-0000-0000-0000-000000000001', '2026-03-19', '09:00', '09:30',
    'confirmed', FALSE, FALSE, TRUE, 'online', 'Sore throat and mild fever'),
  ('a1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001',
    'u1000000-0000-0000-0000-000000000021', 'u1000000-0000-0000-0000-000000000013',
    's1000000-0000-0000-0000-000000000002', '2026-03-19', '09:30', '09:50',
    'confirmed', FALSE, FALSE, TRUE, 'phone', 'Follow-up on blood pressure'),
  ('a1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001',
    'u1000000-0000-0000-0000-000000000022', 'u1000000-0000-0000-0000-000000000012',
    's1000000-0000-0000-0000-000000000001', '2026-03-19', '10:00', '10:30',
    'pending', TRUE, FALSE, FALSE, 'online', NULL),
  ('a1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000001',
    'u1000000-0000-0000-0000-000000000023', 'u1000000-0000-0000-0000-000000000012',
    's1000000-0000-0000-0000-000000000003', '2026-03-19', '10:30', '11:15',
    'pending', FALSE, FALSE, TRUE, 'whatsapp', 'ECG requested by Dr. El Amrani'),
  ('a1000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000001',
    'u1000000-0000-0000-0000-000000000020', 'u1000000-0000-0000-0000-000000000012',
    's1000000-0000-0000-0000-000000000001', '2026-03-15', '09:00', '09:30',
    'completed', FALSE, FALSE, TRUE, 'online', 'Routine check-up'),
  ('a1000000-0000-0000-0000-000000000006', 'c1000000-0000-0000-0000-000000000001',
    'u1000000-0000-0000-0000-000000000024', 'u1000000-0000-0000-0000-000000000014',
    's1000000-0000-0000-0000-000000000006', '2026-03-15', '10:00', '10:30',
    'completed', TRUE, FALSE, FALSE, 'online', 'First visit — pediatric check'),
  ('a1000000-0000-0000-0000-000000000007', 'c1000000-0000-0000-0000-000000000001',
    'u1000000-0000-0000-0000-000000000025', 'u1000000-0000-0000-0000-000000000013',
    's1000000-0000-0000-0000-000000000003', '2026-03-14', '14:00', '14:45',
    'no_show', FALSE, FALSE, TRUE, 'phone', NULL),
  ('a1000000-0000-0000-0000-000000000008', 'c1000000-0000-0000-0000-000000000001',
    'u1000000-0000-0000-0000-000000000021', 'u1000000-0000-0000-0000-000000000012',
    's1000000-0000-0000-0000-000000000004', '2026-03-20', '09:00', '09:15',
    'pending', FALSE, FALSE, TRUE, 'online', 'Scheduled blood pressure follow-up');

-- ============================================================
-- APPOINTMENTS (Clinic 2 — Dentist)
-- ============================================================

INSERT INTO appointments (id, clinic_id, patient_id, doctor_id, service_id, appointment_date, start_time, end_time, status, is_first_visit, booking_source) VALUES
  ('a1000000-0000-0000-0000-000000000010', 'c1000000-0000-0000-0000-000000000002',
    'u1000000-0000-0000-0000-000000000034', 'u1000000-0000-0000-0000-000000000032',
    's1000000-0000-0000-0000-000000000010', '2026-03-19', '09:00', '09:30',
    'confirmed', FALSE, 'online'),
  ('a1000000-0000-0000-0000-000000000011', 'c1000000-0000-0000-0000-000000000002',
    'u1000000-0000-0000-0000-000000000035', 'u1000000-0000-0000-0000-000000000033',
    's1000000-0000-0000-0000-000000000013', '2026-03-20', '10:00', '11:30',
    'pending', TRUE, 'phone');

-- ============================================================
-- CONSULTATION NOTES (Clinic 1)
-- ============================================================

INSERT INTO consultation_notes (clinic_id, appointment_id, doctor_id, patient_id, notes, diagnosis) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000005',
    'u1000000-0000-0000-0000-000000000012', 'u1000000-0000-0000-0000-000000000020',
    'Patient presents with sore throat and mild fever. Prescribed antibiotics and rest. Follow-up in 7 days.',
    'Upper respiratory infection'),
  ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000006',
    'u1000000-0000-0000-0000-000000000014', 'u1000000-0000-0000-0000-000000000024',
    'First pediatric visit. Growth and development within normal limits. Vaccinations up to date.',
    'Well-child check');

-- ============================================================
-- PRESCRIPTIONS (Clinic 1)
-- ============================================================

INSERT INTO prescriptions (id, clinic_id, appointment_id, doctor_id, patient_id, items, notes) VALUES
  ('rx100000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000005', 'u1000000-0000-0000-0000-000000000012', 'u1000000-0000-0000-0000-000000000020',
    '[{"name": "Amoxicillin 500mg", "dosage": "1 capsule 3x/day", "duration": "7 days"}, {"name": "Paracetamol 1g", "dosage": "1 tablet as needed", "duration": "5 days"}]'::jsonb,
    'Take with meals. Complete the full antibiotic course.'),
  ('rx100000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001',
    NULL, 'u1000000-0000-0000-0000-000000000013', 'u1000000-0000-0000-0000-000000000021',
    '[{"name": "Atorvastatin 20mg", "dosage": "1 tablet at bedtime", "duration": "30 days"}, {"name": "Aspirin 100mg", "dosage": "1 tablet daily", "duration": "30 days"}]'::jsonb,
    'Continue for 3 months. Re-check cholesterol levels.'),
  ('rx100000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001',
    NULL, 'u1000000-0000-0000-0000-000000000012', 'u1000000-0000-0000-0000-000000000023',
    '[{"name": "Amlodipine 5mg", "dosage": "1 tablet daily", "duration": "30 days"}, {"name": "Metformin 500mg", "dosage": "1 tablet 2x/day", "duration": "30 days"}, {"name": "Vitamin D 1000IU", "dosage": "1 capsule daily", "duration": "90 days"}]'::jsonb,
    'Monitor blood pressure weekly. Diabetic diet recommended.');

-- ============================================================
-- FAMILY MEMBERS (Clinic 1)
-- ============================================================

INSERT INTO family_members (primary_user_id, member_user_id, relationship) VALUES
  ('u1000000-0000-0000-0000-000000000020', 'u1000000-0000-0000-0000-000000000024', 'Son'),
  ('u1000000-0000-0000-0000-000000000020', 'u1000000-0000-0000-0000-000000000025', 'Sister');

-- ============================================================
-- PAYMENTS (Clinic 1)
-- ============================================================

INSERT INTO payments (clinic_id, appointment_id, patient_id, amount, method, status, reference) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000005', 'u1000000-0000-0000-0000-000000000020', 300.00, 'cash', 'completed', 'PAY-001'),
  ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000006', 'u1000000-0000-0000-0000-000000000024', 350.00, 'card', 'completed', 'PAY-002'),
  ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'u1000000-0000-0000-0000-000000000020', 300.00, 'cash', 'pending', 'PAY-003'),
  ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 'u1000000-0000-0000-0000-000000000021', 200.00, 'transfer', 'pending', 'PAY-004'),
  ('c1000000-0000-0000-0000-000000000001', NULL, 'u1000000-0000-0000-0000-000000000023', 400.00, 'cash', 'completed', 'PAY-005');

-- ============================================================
-- REVIEWS (Clinic 1)
-- ============================================================

INSERT INTO reviews (clinic_id, patient_id, doctor_id, stars, comment, response, is_visible) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'u1000000-0000-0000-0000-000000000020', 'u1000000-0000-0000-0000-000000000012', 5, 'Excellent doctor! Very thorough and professional. Highly recommend.', 'Thank you for your kind words, Fatima!', TRUE),
  ('c1000000-0000-0000-0000-000000000001', 'u1000000-0000-0000-0000-000000000021', 'u1000000-0000-0000-0000-000000000013', 4, 'Good cardiology check-up. Dr. El Amrani explained everything clearly.', NULL, TRUE),
  ('c1000000-0000-0000-0000-000000000001', 'u1000000-0000-0000-0000-000000000022', 'u1000000-0000-0000-0000-000000000012', 5, 'Very kind and attentive. The clinic is clean and well-organized.', NULL, TRUE),
  ('c1000000-0000-0000-0000-000000000001', 'u1000000-0000-0000-0000-000000000023', 'u1000000-0000-0000-0000-000000000012', 3, 'Good care but had to wait quite a while.', 'We apologize for the wait and are working to improve our scheduling.', TRUE),
  ('c1000000-0000-0000-0000-000000000001', 'u1000000-0000-0000-0000-000000000024', 'u1000000-0000-0000-0000-000000000014', 5, 'Dr. Idrissi is great with kids! My son was very comfortable.', NULL, TRUE),
  ('c1000000-0000-0000-0000-000000000001', 'u1000000-0000-0000-0000-000000000025', 'u1000000-0000-0000-0000-000000000013', 4, 'Professional and experienced. Good follow-up care.', NULL, TRUE);

-- ============================================================
-- NOTIFICATIONS (Clinic 1)
-- ============================================================

INSERT INTO notifications (clinic_id, user_id, type, channel, title, body, is_read) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'u1000000-0000-0000-0000-000000000020', 'appointment_reminder', 'whatsapp', 'Appointment Reminder', 'Your appointment with Dr. Ahmed Benali is tomorrow at 09:00.', FALSE),
  ('c1000000-0000-0000-0000-000000000001', 'u1000000-0000-0000-0000-000000000020', 'prescription_ready', 'in_app', 'Prescription Ready', 'Your prescription from Dr. Ahmed Benali is ready.', FALSE),
  ('c1000000-0000-0000-0000-000000000001', 'u1000000-0000-0000-0000-000000000021', 'appointment_confirmed', 'whatsapp', 'Booking Confirmed', 'Your follow-up with Dr. El Amrani on March 19 is confirmed.', TRUE),
  ('c1000000-0000-0000-0000-000000000001', 'u1000000-0000-0000-0000-000000000023', 'payment_reminder', 'sms', 'Payment Reminder', 'Invoice PAY-003 of 400 MAD is due.', FALSE);

-- ============================================================
-- DOCUMENTS (Clinic 1)
-- ============================================================

INSERT INTO documents (clinic_id, user_id, type, file_url, file_name, file_size) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'u1000000-0000-0000-0000-000000000020', 'lab_result', 'https://storage.supabase.co/demo/blood-test-fatima.pdf', 'Blood Test Results - March 2026.pdf', 245000),
  ('c1000000-0000-0000-0000-000000000001', 'u1000000-0000-0000-0000-000000000020', 'xray', 'https://storage.supabase.co/demo/chest-xray-fatima.pdf', 'Chest X-Ray Report.pdf', 1200000),
  ('c1000000-0000-0000-0000-000000000001', 'u1000000-0000-0000-0000-000000000021', 'insurance', 'https://storage.supabase.co/demo/cnops-card-hassan.pdf', 'CNOPS Insurance Card.pdf', 150000),
  ('c1000000-0000-0000-0000-000000000001', 'u1000000-0000-0000-0000-000000000023', 'lab_result', 'https://storage.supabase.co/demo/ecg-omar.pdf', 'ECG Report.pdf', 320000);

-- ============================================================
-- ODONTOGRAM (Clinic 2 — Dentist)
-- ============================================================

INSERT INTO odontogram (clinic_id, patient_id, tooth_number, status, notes) VALUES
  ('c1000000-0000-0000-0000-000000000002', 'u1000000-0000-0000-0000-000000000034', 14, 'filled', 'Composite filling done Jan 2026'),
  ('c1000000-0000-0000-0000-000000000002', 'u1000000-0000-0000-0000-000000000034', 18, 'missing', 'Extracted 2024'),
  ('c1000000-0000-0000-0000-000000000002', 'u1000000-0000-0000-0000-000000000034', 26, 'decayed', 'Needs filling — scheduled'),
  ('c1000000-0000-0000-0000-000000000002', 'u1000000-0000-0000-0000-000000000034', 36, 'crown', 'Porcelain crown placed Feb 2026'),
  ('c1000000-0000-0000-0000-000000000002', 'u1000000-0000-0000-0000-000000000035', 11, 'healthy', NULL),
  ('c1000000-0000-0000-0000-000000000002', 'u1000000-0000-0000-0000-000000000035', 46, 'root_canal', 'Root canal completed, crown pending');

-- ============================================================
-- TREATMENT PLANS (Clinic 2 — Dentist)
-- ============================================================

INSERT INTO treatment_plans (id, clinic_id, patient_id, doctor_id, title, steps, total_cost, status) VALUES
  ('tp100000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002',
    'u1000000-0000-0000-0000-000000000034', 'u1000000-0000-0000-0000-000000000032',
    'Complete Orthodontic Treatment',
    '[{"step": 1, "description": "Initial molds and X-rays", "cost": 500, "status": "completed"}, {"step": 2, "description": "Braces installation", "cost": 3000, "status": "completed"}, {"step": 3, "description": "Monthly adjustments (12 months)", "cost": 2400, "status": "in_progress"}, {"step": 4, "description": "Retainer fitting", "cost": 800, "status": "planned"}]'::jsonb,
    6700.00, 'in_progress'),
  ('tp100000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000002',
    'u1000000-0000-0000-0000-000000000035', 'u1000000-0000-0000-0000-000000000033',
    'Root Canal + Crown — Tooth 46',
    '[{"step": 1, "description": "Root canal treatment", "cost": 1500, "status": "completed"}, {"step": 2, "description": "Temporary crown", "cost": 300, "status": "completed"}, {"step": 3, "description": "Permanent porcelain crown", "cost": 2000, "status": "planned"}]'::jsonb,
    3800.00, 'in_progress');

-- ============================================================
-- LAB ORDERS (Clinic 2 — Dentist)
-- ============================================================

INSERT INTO lab_orders (clinic_id, patient_id, doctor_id, lab_name, description, status, due_date) VALUES
  ('c1000000-0000-0000-0000-000000000002', 'u1000000-0000-0000-0000-000000000035', 'u1000000-0000-0000-0000-000000000033',
    'Dental Lab Casablanca', 'Porcelain crown for tooth 46 — shade A2', 'in_progress', '2026-03-25'),
  ('c1000000-0000-0000-0000-000000000002', 'u1000000-0000-0000-0000-000000000034', 'u1000000-0000-0000-0000-000000000032',
    'Dental Lab Casablanca', 'Orthodontic retainer — upper and lower', 'pending', '2026-04-15');

-- ============================================================
-- INSTALLMENTS (Clinic 2 — Dentist)
-- ============================================================

INSERT INTO installments (clinic_id, treatment_plan_id, patient_id, amount, due_date, paid_date, status) VALUES
  ('c1000000-0000-0000-0000-000000000002', 'tp100000-0000-0000-0000-000000000001', 'u1000000-0000-0000-0000-000000000034', 1675.00, '2026-01-01', '2026-01-02', 'paid'),
  ('c1000000-0000-0000-0000-000000000002', 'tp100000-0000-0000-0000-000000000001', 'u1000000-0000-0000-0000-000000000034', 1675.00, '2026-04-01', NULL, 'pending'),
  ('c1000000-0000-0000-0000-000000000002', 'tp100000-0000-0000-0000-000000000001', 'u1000000-0000-0000-0000-000000000034', 1675.00, '2026-07-01', NULL, 'pending'),
  ('c1000000-0000-0000-0000-000000000002', 'tp100000-0000-0000-0000-000000000001', 'u1000000-0000-0000-0000-000000000034', 1675.00, '2026-10-01', NULL, 'pending');

-- ============================================================
-- PRODUCTS (Clinic 3 — Pharmacy)
-- ============================================================

INSERT INTO products (id, clinic_id, name, category, description, price, requires_prescription, is_active) VALUES
  ('pr100000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003', 'Paracetamol 500mg', 'Pain Relief', 'Box of 20 tablets', 15.00, FALSE, TRUE),
  ('pr100000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000003', 'Amoxicillin 500mg', 'Antibiotics', 'Box of 12 capsules', 45.00, TRUE, TRUE),
  ('pr100000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000003', 'Omeprazole 20mg', 'Digestive', 'Box of 14 capsules', 35.00, TRUE, TRUE),
  ('pr100000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000003', 'Vitamin C 1000mg', 'Vitamins', 'Box of 30 effervescent tablets', 50.00, FALSE, TRUE),
  ('pr100000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000003', 'Ibuprofen 400mg', 'Pain Relief', 'Box of 20 tablets', 25.00, FALSE, TRUE),
  ('pr100000-0000-0000-0000-000000000006', 'c1000000-0000-0000-0000-000000000003', 'Metformin 500mg', 'Diabetes', 'Box of 30 tablets', 30.00, TRUE, TRUE),
  ('pr100000-0000-0000-0000-000000000007', 'c1000000-0000-0000-0000-000000000003', 'Hand Sanitizer 250ml', 'Hygiene', 'Alcohol-based gel', 20.00, FALSE, TRUE),
  ('pr100000-0000-0000-0000-000000000008', 'c1000000-0000-0000-0000-000000000003', 'Atorvastatin 20mg', 'Cholesterol', 'Box of 30 tablets', 55.00, TRUE, TRUE);

-- ============================================================
-- STOCK (Clinic 3 — Pharmacy)
-- ============================================================

INSERT INTO stock (clinic_id, product_id, quantity, min_threshold, expiry_date, batch_number) VALUES
  ('c1000000-0000-0000-0000-000000000003', 'pr100000-0000-0000-0000-000000000001', 150, 20, '2027-06-30', 'BATCH-A001'),
  ('c1000000-0000-0000-0000-000000000003', 'pr100000-0000-0000-0000-000000000002', 80, 15, '2027-03-31', 'BATCH-A002'),
  ('c1000000-0000-0000-0000-000000000003', 'pr100000-0000-0000-0000-000000000003', 5, 10, '2027-01-15', 'BATCH-A003'),
  ('c1000000-0000-0000-0000-000000000003', 'pr100000-0000-0000-0000-000000000004', 200, 30, '2027-12-31', 'BATCH-A004'),
  ('c1000000-0000-0000-0000-000000000003', 'pr100000-0000-0000-0000-000000000005', 100, 20, '2027-09-30', 'BATCH-A005'),
  ('c1000000-0000-0000-0000-000000000003', 'pr100000-0000-0000-0000-000000000006', 45, 10, '2027-05-15', 'BATCH-A006'),
  ('c1000000-0000-0000-0000-000000000003', 'pr100000-0000-0000-0000-000000000007', 60, 10, '2028-06-30', 'BATCH-A007'),
  ('c1000000-0000-0000-0000-000000000003', 'pr100000-0000-0000-0000-000000000008', 30, 10, '2027-08-31', 'BATCH-A008');

-- ============================================================
-- SUPPLIERS (Clinic 3 — Pharmacy)
-- ============================================================

INSERT INTO suppliers (clinic_id, name, contact_phone, contact_email, address) VALUES
  ('c1000000-0000-0000-0000-000000000003', 'Pharma Distributor Maroc', '+212 5 22 00 11 22', 'orders@pharma-dist.ma', '123 Bd Mohammed V, Casablanca'),
  ('c1000000-0000-0000-0000-000000000003', 'MedSupply SA', '+212 5 37 33 44 55', 'contact@medsupply.ma', '45 Rue Hassan II, Rabat'),
  ('c1000000-0000-0000-0000-000000000003', 'Atlas Pharma', '+212 5 24 66 77 88', 'info@atlas-pharma.ma', '78 Av des FAR, Marrakech');

-- ============================================================
-- PRESCRIPTION REQUESTS (Clinic 3 — Pharmacy)
-- ============================================================

INSERT INTO prescription_requests (clinic_id, patient_id, image_url, status, notes, delivery_requested) VALUES
  ('c1000000-0000-0000-0000-000000000003', 'u1000000-0000-0000-0000-000000000042',
    'https://storage.supabase.co/demo/rx-photo-001.jpg', 'ready',
    'Amoxicillin and Paracetamol — ready for pickup', FALSE),
  ('c1000000-0000-0000-0000-000000000003', 'u1000000-0000-0000-0000-000000000043',
    'https://storage.supabase.co/demo/rx-photo-002.jpg', 'reviewing',
    'Checking availability of Metformin 850mg', TRUE);

-- ============================================================
-- LOYALTY POINTS (Clinic 3 — Pharmacy)
-- ============================================================

INSERT INTO loyalty_points (clinic_id, patient_id, points, last_earned) VALUES
  ('c1000000-0000-0000-0000-000000000003', 'u1000000-0000-0000-0000-000000000042', 350, '2026-03-15'),
  ('c1000000-0000-0000-0000-000000000003', 'u1000000-0000-0000-0000-000000000043', 120, '2026-03-10');

-- ============================================================
-- WAITING LIST (Clinic 1)
-- ============================================================

INSERT INTO waiting_list (clinic_id, patient_id, doctor_id, preferred_date, status) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'u1000000-0000-0000-0000-000000000025', 'u1000000-0000-0000-0000-000000000013', '2026-03-21', 'waiting'),
  ('c1000000-0000-0000-0000-000000000001', 'u1000000-0000-0000-0000-000000000022', 'u1000000-0000-0000-0000-000000000014', '2026-03-22', 'waiting');
