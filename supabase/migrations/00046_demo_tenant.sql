-- ============================================================
-- Demo Tenant: demo.oltigo.com
--
-- A read-only showcase clinic for prospects to explore the
-- platform without signing up. Pre-loaded with sample doctors,
-- services, time slots, and appointments.
-- ============================================================

-- ============================================================
-- DEMO CLINIC
-- ============================================================

INSERT INTO clinics (id, name, type, config, tier, status) VALUES
  ('c0000000-demo-0000-0000-000000000001',
   'Cabinet Demo Oltigo',
   'doctor',
   '{
     "locale": "fr",
     "currency": "MAD",
     "city": "Casablanca",
     "phone": "+212 5 00 00 00 00",
     "specialty": "General Medicine",
     "subdomain": "demo",
     "is_demo": true
   }'::jsonb,
   'premium',
   'active')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DEMO USERS
-- ============================================================

-- Demo clinic admin
INSERT INTO users (id, role, name, phone, email, clinic_id) VALUES
  ('u0000000-demo-0000-0000-000000000001',
   'clinic_admin',
   'Admin Demo',
   '+212600000000',
   'admin@demo.oltigo.com',
   'c0000000-demo-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Demo doctor 1
INSERT INTO users (id, role, name, phone, email, clinic_id) VALUES
  ('u0000000-demo-0000-0000-000000000002',
   'doctor',
   'Dr. Karim Idrissi',
   '+212611000010',
   'karim@demo.oltigo.com',
   'c0000000-demo-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Demo doctor 2
INSERT INTO users (id, role, name, phone, email, clinic_id) VALUES
  ('u0000000-demo-0000-0000-000000000003',
   'doctor',
   'Dr. Salma Berrada',
   '+212611000011',
   'salma@demo.oltigo.com',
   'c0000000-demo-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Demo receptionist
INSERT INTO users (id, role, name, phone, email, clinic_id) VALUES
  ('u0000000-demo-0000-0000-000000000004',
   'receptionist',
   'Imane Fassi',
   '+212611000012',
   'imane@demo.oltigo.com',
   'c0000000-demo-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Demo patients
INSERT INTO users (id, role, name, phone, email, clinic_id) VALUES
  ('u0000000-demo-0000-0000-000000000010',
   'patient', 'Rachid Bennani', '+212622000001', 'rachid@example.com',
   'c0000000-demo-0000-0000-000000000001'),
  ('u0000000-demo-0000-0000-000000000011',
   'patient', 'Leila Cherkaoui', '+212622000002', 'leila@example.com',
   'c0000000-demo-0000-0000-000000000001'),
  ('u0000000-demo-0000-0000-000000000012',
   'patient', 'Mehdi Alami', '+212622000003', 'mehdi@example.com',
   'c0000000-demo-0000-0000-000000000001'),
  ('u0000000-demo-0000-0000-000000000013',
   'patient', 'Nora Touzani', '+212622000004', 'nora@example.com',
   'c0000000-demo-0000-0000-000000000001'),
  ('u0000000-demo-0000-0000-000000000014',
   'patient', 'Amine Kettani', '+212622000005', 'amine@example.com',
   'c0000000-demo-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DEMO SERVICES
-- ============================================================

INSERT INTO services (id, clinic_id, name, price, duration_minutes, category) VALUES
  ('s0000000-demo-0000-0000-000000000001',
   'c0000000-demo-0000-0000-000000000001',
   'Consultation Générale', 300.00, 30, 'consultation'),
  ('s0000000-demo-0000-0000-000000000002',
   'c0000000-demo-0000-0000-000000000001',
   'Visite de Suivi', 200.00, 20, 'follow-up'),
  ('s0000000-demo-0000-0000-000000000003',
   'c0000000-demo-0000-0000-000000000001',
   'Bilan Sanguin', 450.00, 15, 'diagnostic'),
  ('s0000000-demo-0000-0000-000000000004',
   'c0000000-demo-0000-0000-000000000001',
   'ECG', 500.00, 45, 'diagnostic'),
  ('s0000000-demo-0000-0000-000000000005',
   'c0000000-demo-0000-0000-000000000001',
   'Vaccination', 200.00, 15, 'vaccination')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DEMO TIME SLOTS (Dr. Karim — Mon-Fri 09-12 & 14-17)
-- ============================================================

INSERT INTO time_slots (doctor_id, clinic_id, day_of_week, start_time, end_time, is_available, max_capacity, buffer_minutes) VALUES
  ('u0000000-demo-0000-0000-000000000002', 'c0000000-demo-0000-0000-000000000001', 1, '09:00', '12:00', TRUE, 1, 10),
  ('u0000000-demo-0000-0000-000000000002', 'c0000000-demo-0000-0000-000000000001', 1, '14:00', '17:00', TRUE, 1, 10),
  ('u0000000-demo-0000-0000-000000000002', 'c0000000-demo-0000-0000-000000000001', 2, '09:00', '12:00', TRUE, 1, 10),
  ('u0000000-demo-0000-0000-000000000002', 'c0000000-demo-0000-0000-000000000001', 2, '14:00', '17:00', TRUE, 1, 10),
  ('u0000000-demo-0000-0000-000000000002', 'c0000000-demo-0000-0000-000000000001', 3, '09:00', '12:00', TRUE, 1, 10),
  ('u0000000-demo-0000-0000-000000000002', 'c0000000-demo-0000-0000-000000000001', 3, '14:00', '17:00', TRUE, 1, 10),
  ('u0000000-demo-0000-0000-000000000002', 'c0000000-demo-0000-0000-000000000001', 4, '09:00', '12:00', TRUE, 1, 10),
  ('u0000000-demo-0000-0000-000000000002', 'c0000000-demo-0000-0000-000000000001', 4, '14:00', '17:00', TRUE, 1, 10),
  ('u0000000-demo-0000-0000-000000000002', 'c0000000-demo-0000-0000-000000000001', 5, '09:00', '12:00', TRUE, 1, 10),
  ('u0000000-demo-0000-0000-000000000002', 'c0000000-demo-0000-0000-000000000001', 5, '14:00', '17:00', TRUE, 1, 10);

-- Dr. Salma — Mon, Wed, Fri mornings only
INSERT INTO time_slots (doctor_id, clinic_id, day_of_week, start_time, end_time, is_available, max_capacity, buffer_minutes) VALUES
  ('u0000000-demo-0000-0000-000000000003', 'c0000000-demo-0000-0000-000000000001', 1, '09:00', '13:00', TRUE, 1, 15),
  ('u0000000-demo-0000-0000-000000000003', 'c0000000-demo-0000-0000-000000000001', 3, '09:00', '13:00', TRUE, 1, 15),
  ('u0000000-demo-0000-0000-000000000003', 'c0000000-demo-0000-0000-000000000001', 5, '09:00', '13:00', TRUE, 1, 15);

-- ============================================================
-- DEMO APPOINTMENTS (variety of statuses)
-- ============================================================

INSERT INTO appointments (id, patient_id, doctor_id, clinic_id, service_id, slot_start, slot_end, status, is_first_visit, insurance_flag, source, notes) VALUES
  ('ap000000-demo-0000-0000-000000000001',
   'u0000000-demo-0000-0000-000000000010',
   'u0000000-demo-0000-0000-000000000002',
   'c0000000-demo-0000-0000-000000000001',
   's0000000-demo-0000-0000-000000000001',
   '2026-03-20 09:00:00+00', '2026-03-20 09:30:00+00',
   'completed', TRUE, TRUE, 'online',
   'Consultation initiale — tension normale, bilan sanguin demandé')
ON CONFLICT (id) DO NOTHING;

INSERT INTO appointments (id, patient_id, doctor_id, clinic_id, service_id, slot_start, slot_end, status, is_first_visit, insurance_flag, source) VALUES
  ('ap000000-demo-0000-0000-000000000002',
   'u0000000-demo-0000-0000-000000000011',
   'u0000000-demo-0000-0000-000000000002',
   'c0000000-demo-0000-0000-000000000001',
   's0000000-demo-0000-0000-000000000002',
   '2026-03-25 10:00:00+00', '2026-03-25 10:20:00+00',
   'confirmed', FALSE, TRUE, 'phone')
ON CONFLICT (id) DO NOTHING;

INSERT INTO appointments (id, patient_id, doctor_id, clinic_id, service_id, slot_start, slot_end, status, is_first_visit, insurance_flag, source) VALUES
  ('ap000000-demo-0000-0000-000000000003',
   'u0000000-demo-0000-0000-000000000012',
   'u0000000-demo-0000-0000-000000000003',
   'c0000000-demo-0000-0000-000000000001',
   's0000000-demo-0000-0000-000000000004',
   '2026-03-28 09:00:00+00', '2026-03-28 09:45:00+00',
   'pending', TRUE, FALSE, 'whatsapp')
ON CONFLICT (id) DO NOTHING;

INSERT INTO appointments (id, patient_id, doctor_id, clinic_id, service_id, slot_start, slot_end, status, is_first_visit, insurance_flag, source) VALUES
  ('ap000000-demo-0000-0000-000000000004',
   'u0000000-demo-0000-0000-000000000013',
   'u0000000-demo-0000-0000-000000000002',
   'c0000000-demo-0000-0000-000000000001',
   's0000000-demo-0000-0000-000000000005',
   '2026-04-01 15:00:00+00', '2026-04-01 15:15:00+00',
   'confirmed', FALSE, TRUE, 'online')
ON CONFLICT (id) DO NOTHING;

INSERT INTO appointments (id, patient_id, doctor_id, clinic_id, service_id, slot_start, slot_end, status, is_first_visit, insurance_flag, source, notes) VALUES
  ('ap000000-demo-0000-0000-000000000005',
   'u0000000-demo-0000-0000-000000000014',
   'u0000000-demo-0000-0000-000000000003',
   'c0000000-demo-0000-0000-000000000001',
   's0000000-demo-0000-0000-000000000001',
   '2026-03-19 11:00:00+00', '2026-03-19 11:30:00+00',
   'completed', TRUE, FALSE, 'walk_in',
   'Visite de routine — tout est normal')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DEMO REVIEWS
-- ============================================================

INSERT INTO reviews (id, patient_id, clinic_id, stars, comment, response) VALUES
  ('rv000000-demo-0000-0000-000000000001',
   'u0000000-demo-0000-0000-000000000010',
   'c0000000-demo-0000-0000-000000000001',
   5, 'Excellent cabinet, très bien organisé. Je recommande !',
   'Merci beaucoup pour votre confiance.'),
  ('rv000000-demo-0000-0000-000000000002',
   'u0000000-demo-0000-0000-000000000011',
   'c0000000-demo-0000-0000-000000000001',
   4, 'Bon médecin, ponctuel et à l''écoute.',
   NULL),
  ('rv000000-demo-0000-0000-000000000003',
   'u0000000-demo-0000-0000-000000000014',
   'c0000000-demo-0000-0000-000000000001',
   5, 'Service impeccable, cabinet moderne et propre.',
   'Merci, nous faisons de notre mieux !')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DEMO PAYMENTS
-- ============================================================

INSERT INTO payments (id, clinic_id, patient_id, appointment_id, amount, method, status, ref) VALUES
  ('py000000-demo-0000-0000-000000000001',
   'c0000000-demo-0000-0000-000000000001',
   'u0000000-demo-0000-0000-000000000010',
   'ap000000-demo-0000-0000-000000000001',
   300.00, 'cash', 'completed', 'DEMO-PAY-001'),
  ('py000000-demo-0000-0000-000000000002',
   'c0000000-demo-0000-0000-000000000001',
   'u0000000-demo-0000-0000-000000000014',
   'ap000000-demo-0000-0000-000000000005',
   300.00, 'card', 'completed', 'DEMO-PAY-002')
ON CONFLICT (id) DO NOTHING;
