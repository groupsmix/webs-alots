-- ============================================================
-- Migration 00053: Enhance Demo Tenant
--
-- Adds prescriptions and invoices to the demo clinic so the
-- demo experience is richer and showcases more platform features.
-- Also sets the subdomain column for demo routing.
-- ============================================================

-- Ensure the demo clinic has the subdomain column set
UPDATE clinics
  SET subdomain = 'demo'
  WHERE id = 'c0000000-demo-0000-0000-000000000001'
    AND (subdomain IS NULL OR subdomain != 'demo');

-- ============================================================
-- DEMO PRESCRIPTIONS
-- ============================================================

INSERT INTO prescriptions (id, patient_id, doctor_id, appointment_id, content, created_at) VALUES
  ('rx000000-demo-0000-0000-000000000001',
   'u0000000-demo-0000-0000-000000000010',
   'u0000000-demo-0000-0000-000000000002',
   'ap000000-demo-0000-0000-000000000001',
   '[
     {"medication": "Amoxicilline 500mg", "dosage": "1 comprimé 3x/jour", "duration": "7 jours"},
     {"medication": "Paracétamol 1g", "dosage": "1 comprimé si douleur, max 3/jour", "duration": "5 jours"}
   ]'::jsonb,
   '2026-03-20 10:00:00+00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO prescriptions (id, patient_id, doctor_id, appointment_id, content, created_at) VALUES
  ('rx000000-demo-0000-0000-000000000002',
   'u0000000-demo-0000-0000-000000000014',
   'u0000000-demo-0000-0000-000000000003',
   'ap000000-demo-0000-0000-000000000005',
   '[
     {"medication": "Oméprazole 20mg", "dosage": "1 gélule le matin à jeun", "duration": "14 jours"},
     {"medication": "Dompéridone 10mg", "dosage": "1 comprimé avant chaque repas", "duration": "10 jours"}
   ]'::jsonb,
   '2026-03-19 12:00:00+00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO prescriptions (id, patient_id, doctor_id, content, created_at) VALUES
  ('rx000000-demo-0000-0000-000000000003',
   'u0000000-demo-0000-0000-000000000011',
   'u0000000-demo-0000-0000-000000000002',
   '[
     {"medication": "Vitamine D3 100 000 UI", "dosage": "1 ampoule par mois", "duration": "3 mois"},
     {"medication": "Fer Fumarate 200mg", "dosage": "1 comprimé/jour au déjeuner", "duration": "2 mois"}
   ]'::jsonb,
   '2026-03-22 14:00:00+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DEMO CONSULTATION NOTES
-- ============================================================

INSERT INTO consultation_notes (id, patient_id, doctor_id, appointment_id, notes, private, created_at) VALUES
  ('cn000000-demo-0000-0000-000000000001',
   'u0000000-demo-0000-0000-000000000010',
   'u0000000-demo-0000-0000-000000000002',
   'ap000000-demo-0000-0000-000000000001',
   'Patient se plaint de maux de tête fréquents depuis 2 semaines. Tension artérielle : 12/8. Examen clinique normal. Bilan sanguin prescrit pour vérifier NFS et glycémie.',
   TRUE,
   '2026-03-20 09:30:00+00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO consultation_notes (id, patient_id, doctor_id, appointment_id, notes, private, created_at) VALUES
  ('cn000000-demo-0000-0000-000000000002',
   'u0000000-demo-0000-0000-000000000014',
   'u0000000-demo-0000-0000-000000000003',
   'ap000000-demo-0000-0000-000000000005',
   'Douleurs épigastriques depuis 1 mois. Pas de signes d''alarme. Traitement anti-acide prescrit. Contrôle dans 2 semaines si pas d''amélioration.',
   TRUE,
   '2026-03-19 11:30:00+00')
ON CONFLICT (id) DO NOTHING;
