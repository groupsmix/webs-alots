-- ============================================================
-- SEED DATA for Health SaaS Platform
-- 1 clinic, 1 doctor, 1 receptionist, 5 patients,
-- sample services, time slots, and appointments
-- ============================================================

-- ============================================================
-- CLINIC
-- ============================================================

INSERT INTO clinics (id, name, type, config, tier, status) VALUES
  ('c1000000-0000-0000-0000-000000000001',
   'Cabinet Dr. Ahmed Benali',
   'doctor',
   '{
     "locale": "fr",
     "currency": "MAD",
     "city": "Casablanca",
     "phone": "+212 5 22 33 44 55",
     "specialty": "General Medicine"
   }'::jsonb,
   'pro',
   'active');

-- ============================================================
-- USERS
-- ============================================================

-- Super Admin (no clinic)
INSERT INTO users (id, auth_id, role, name, phone, email, clinic_id) VALUES
  ('u0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001',
   'super_admin',
   'Admin Platform',
   '+212600000001',
   'admin@health-saas.ma',
   NULL);

-- Clinic Admin
INSERT INTO users (id, auth_id, role, name, phone, email, clinic_id) VALUES
  ('u0000000-0000-0000-0000-000000000002',
   'a0000000-0000-0000-0000-000000000002',
   'clinic_admin',
   'Nadia Benali',
   '+212611000001',
   'nadia@dr-benali.ma',
   'c1000000-0000-0000-0000-000000000001');

-- Doctor
INSERT INTO users (id, auth_id, role, name, phone, email, clinic_id) VALUES
  ('u0000000-0000-0000-0000-000000000003',
   'a0000000-0000-0000-0000-000000000003',
   'doctor',
   'Dr. Ahmed Benali',
   '+212611000002',
   'ahmed@dr-benali.ma',
   'c1000000-0000-0000-0000-000000000001');

-- Receptionist
INSERT INTO users (id, auth_id, role, name, phone, email, clinic_id) VALUES
  ('u0000000-0000-0000-0000-000000000004',
   'a0000000-0000-0000-0000-000000000004',
   'receptionist',
   'Amina Tazi',
   '+212611000003',
   'amina@dr-benali.ma',
   'c1000000-0000-0000-0000-000000000001');

-- Patient 1
INSERT INTO users (id, auth_id, role, name, phone, email, clinic_id) VALUES
  ('u0000000-0000-0000-0000-000000000010',
   'a0000000-0000-0000-0000-000000000010',
   'patient',
   'Fatima Zahra Mansouri',
   '+212622113344',
   'fatima.m@gmail.com',
   'c1000000-0000-0000-0000-000000000001');

-- Patient 2
INSERT INTO users (id, auth_id, role, name, phone, email, clinic_id) VALUES
  ('u0000000-0000-0000-0000-000000000011',
   'a0000000-0000-0000-0000-000000000011',
   'patient',
   'Hassan Bourkia',
   '+212633224455',
   'hassan.b@gmail.com',
   'c1000000-0000-0000-0000-000000000001');

-- Patient 3
INSERT INTO users (id, auth_id, role, name, phone, email, clinic_id) VALUES
  ('u0000000-0000-0000-0000-000000000012',
   'a0000000-0000-0000-0000-000000000012',
   'patient',
   'Khadija Alaoui',
   '+212644335566',
   'khadija.a@gmail.com',
   'c1000000-0000-0000-0000-000000000001');

-- Patient 4
INSERT INTO users (id, auth_id, role, name, phone, email, clinic_id) VALUES
  ('u0000000-0000-0000-0000-000000000013',
   'a0000000-0000-0000-0000-000000000013',
   'patient',
   'Omar El Fassi',
   '+212655446677',
   'omar.f@gmail.com',
   'c1000000-0000-0000-0000-000000000001');

-- Patient 5
INSERT INTO users (id, auth_id, role, name, phone, email, clinic_id) VALUES
  ('u0000000-0000-0000-0000-000000000014',
   'a0000000-0000-0000-0000-000000000014',
   'patient',
   'Youssef Tazi',
   '+212666557788',
   'youssef.t@gmail.com',
   'c1000000-0000-0000-0000-000000000001');

-- ============================================================
-- SERVICES
-- ============================================================

INSERT INTO services (id, clinic_id, name, price, duration_minutes, category) VALUES
  ('s0000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000001',
   'General Consultation', 300.00, 30, 'consultation'),
  ('s0000000-0000-0000-0000-000000000002',
   'c1000000-0000-0000-0000-000000000001',
   'Follow-up Visit', 200.00, 20, 'follow-up'),
  ('s0000000-0000-0000-0000-000000000003',
   'c1000000-0000-0000-0000-000000000001',
   'ECG Checkup', 500.00, 45, 'diagnostic'),
  ('s0000000-0000-0000-0000-000000000004',
   'c1000000-0000-0000-0000-000000000001',
   'Blood Pressure Check', 150.00, 15, 'screening'),
  ('s0000000-0000-0000-0000-000000000005',
   'c1000000-0000-0000-0000-000000000001',
   'Vaccination', 200.00, 15, 'vaccination');

-- ============================================================
-- TIME SLOTS (Dr. Ahmed — Mon-Fri 09:00-12:00 & 14:00-17:00)
-- ============================================================

INSERT INTO time_slots (doctor_id, clinic_id, day_of_week, start_time, end_time, is_available, max_capacity, buffer_minutes) VALUES
  ('u0000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 1, '09:00', '12:00', TRUE, 1, 10),
  ('u0000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 1, '14:00', '17:00', TRUE, 1, 10),
  ('u0000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 2, '09:00', '12:00', TRUE, 1, 10),
  ('u0000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 2, '14:00', '17:00', TRUE, 1, 10),
  ('u0000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 3, '09:00', '12:00', TRUE, 1, 10),
  ('u0000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 3, '14:00', '17:00', TRUE, 1, 10),
  ('u0000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 4, '09:00', '12:00', TRUE, 1, 10),
  ('u0000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 4, '14:00', '17:00', TRUE, 1, 10),
  ('u0000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 5, '09:00', '12:00', TRUE, 1, 10),
  ('u0000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 5, '14:00', '17:00', TRUE, 1, 10);

-- ============================================================
-- APPOINTMENTS (sample: various statuses)
-- ============================================================

-- Appointment 1: Fatima — completed general consultation
INSERT INTO appointments (id, patient_id, doctor_id, clinic_id, service_id, slot_start, slot_end, status, is_first_visit, insurance_flag, source, notes) VALUES
  ('ap000000-0000-0000-0000-000000000001',
   'u0000000-0000-0000-0000-000000000010',
   'u0000000-0000-0000-0000-000000000003',
   'c1000000-0000-0000-0000-000000000001',
   's0000000-0000-0000-0000-000000000001',
   '2026-03-18 09:00:00+00', '2026-03-18 09:30:00+00',
   'completed', TRUE, TRUE, 'online',
   'Initial consultation — blood pressure normal');

-- Appointment 2: Hassan — confirmed follow-up
INSERT INTO appointments (id, patient_id, doctor_id, clinic_id, service_id, slot_start, slot_end, status, is_first_visit, insurance_flag, source) VALUES
  ('ap000000-0000-0000-0000-000000000002',
   'u0000000-0000-0000-0000-000000000011',
   'u0000000-0000-0000-0000-000000000003',
   'c1000000-0000-0000-0000-000000000001',
   's0000000-0000-0000-0000-000000000002',
   '2026-03-21 10:00:00+00', '2026-03-21 10:20:00+00',
   'confirmed', FALSE, TRUE, 'phone');

-- Appointment 3: Khadija — pending ECG
INSERT INTO appointments (id, patient_id, doctor_id, clinic_id, service_id, slot_start, slot_end, status, is_first_visit, insurance_flag, source) VALUES
  ('ap000000-0000-0000-0000-000000000003',
   'u0000000-0000-0000-0000-000000000012',
   'u0000000-0000-0000-0000-000000000003',
   'c1000000-0000-0000-0000-000000000001',
   's0000000-0000-0000-0000-000000000003',
   '2026-03-22 14:00:00+00', '2026-03-22 14:45:00+00',
   'pending', TRUE, FALSE, 'whatsapp');

-- Appointment 4: Omar — cancelled
INSERT INTO appointments (id, patient_id, doctor_id, clinic_id, service_id, slot_start, slot_end, status, is_first_visit, insurance_flag, source, notes) VALUES
  ('ap000000-0000-0000-0000-000000000004',
   'u0000000-0000-0000-0000-000000000013',
   'u0000000-0000-0000-0000-000000000003',
   'c1000000-0000-0000-0000-000000000001',
   's0000000-0000-0000-0000-000000000001',
   '2026-03-19 11:00:00+00', '2026-03-19 11:30:00+00',
   'cancelled', FALSE, TRUE, 'online',
   'Patient cancelled — will reschedule');

-- Appointment 5: Youssef — no show
INSERT INTO appointments (id, patient_id, doctor_id, clinic_id, service_id, slot_start, slot_end, status, is_first_visit, insurance_flag, source) VALUES
  ('ap000000-0000-0000-0000-000000000005',
   'u0000000-0000-0000-0000-000000000014',
   'u0000000-0000-0000-0000-000000000003',
   'c1000000-0000-0000-0000-000000000001',
   's0000000-0000-0000-0000-000000000005',
   '2026-03-17 09:30:00+00', '2026-03-17 09:45:00+00',
   'no_show', TRUE, FALSE, 'walk_in');

-- Appointment 6: Fatima — upcoming vaccination
INSERT INTO appointments (id, patient_id, doctor_id, clinic_id, service_id, slot_start, slot_end, status, is_first_visit, insurance_flag, source) VALUES
  ('ap000000-0000-0000-0000-000000000006',
   'u0000000-0000-0000-0000-000000000010',
   'u0000000-0000-0000-0000-000000000003',
   'c1000000-0000-0000-0000-000000000001',
   's0000000-0000-0000-0000-000000000005',
   '2026-03-25 15:00:00+00', '2026-03-25 15:15:00+00',
   'confirmed', FALSE, TRUE, 'online');

-- ============================================================
-- PRESCRIPTIONS (sample for completed appointment)
-- ============================================================

INSERT INTO prescriptions (id, patient_id, doctor_id, appointment_id, content, pdf_url) VALUES
  ('pr000000-0000-0000-0000-000000000001',
   'u0000000-0000-0000-0000-000000000010',
   'u0000000-0000-0000-0000-000000000003',
   'ap000000-0000-0000-0000-000000000001',
   '[
     {"medication": "Paracetamol 500mg", "dosage": "1 tablet 3x/day", "duration": "5 days"},
     {"medication": "Omeprazole 20mg", "dosage": "1 capsule before breakfast", "duration": "14 days"}
   ]'::jsonb,
   NULL);

-- ============================================================
-- CONSULTATION NOTES
-- ============================================================

INSERT INTO consultation_notes (id, patient_id, doctor_id, appointment_id, notes, private) VALUES
  ('cn000000-0000-0000-0000-000000000001',
   'u0000000-0000-0000-0000-000000000010',
   'u0000000-0000-0000-0000-000000000003',
   'ap000000-0000-0000-0000-000000000001',
   'Patient presents with mild headache and fatigue. BP 120/80. Prescribed paracetamol and omeprazole for gastric discomfort.',
   TRUE);

-- ============================================================
-- PAYMENTS (sample)
-- ============================================================

INSERT INTO payments (id, clinic_id, patient_id, appointment_id, amount, method, status, ref) VALUES
  ('py000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000001',
   'u0000000-0000-0000-0000-000000000010',
   'ap000000-0000-0000-0000-000000000001',
   300.00, 'cash', 'completed', 'PAY-001');

-- ============================================================
-- REVIEWS (sample)
-- ============================================================

INSERT INTO reviews (id, patient_id, clinic_id, stars, comment, response) VALUES
  ('rv000000-0000-0000-0000-000000000001',
   'u0000000-0000-0000-0000-000000000010',
   'c1000000-0000-0000-0000-000000000001',
   5,
   'Excellent médecin, très professionnel et attentionné.',
   'Merci pour vos aimables mots, Fatima !');

-- ============================================================
-- NOTIFICATIONS (sample)
-- ============================================================

INSERT INTO notifications (id, user_id, type, channel, message, sent_at, read_at) VALUES
  ('nt000000-0000-0000-0000-000000000001',
   'u0000000-0000-0000-0000-000000000011',
   'appointment_reminder',
   'whatsapp',
   'Reminder: Your follow-up appointment with Dr. Ahmed Benali is on March 21 at 10:00 AM.',
   '2026-03-20 08:00:00+00',
   NULL),
  ('nt000000-0000-0000-0000-000000000002',
   'u0000000-0000-0000-0000-000000000010',
   'appointment_confirmed',
   'sms',
   'Your vaccination appointment on March 25 at 3:00 PM has been confirmed.',
   '2026-03-20 09:00:00+00',
   '2026-03-20 09:05:00+00');
