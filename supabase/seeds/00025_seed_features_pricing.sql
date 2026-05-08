-- ============================================================
-- Migration 00025: Seed Feature Definitions & Pricing Tiers
--
-- Populates the feature_definitions and pricing_tiers tables
-- with the catalogue data expected by the super-admin dashboard
-- and clinic subscription flows.
-- ============================================================

-- ============================================================
-- 1. FEATURE DEFINITIONS
-- ============================================================

INSERT INTO feature_definitions (name, key, description, category, available_tiers, global_enabled)
VALUES
  -- Core features
  ('Appointments',           'appointments',           'Online appointment booking & calendar management',      'core',          '{cabinet,pro,premium,saas-monthly}', TRUE),
  ('Prescriptions',          'prescriptions',          'Electronic prescription management',                    'core',          '{cabinet,pro,premium,saas-monthly}', TRUE),
  ('Consultations',          'consultations',          'Patient consultation notes & history',                  'core',          '{cabinet,pro,premium,saas-monthly}', TRUE),
  ('Lab Results',            'lab_results',            'Lab result viewing & tracking',                         'core',          '{pro,premium,saas-monthly}',         TRUE),
  ('Imaging',                'imaging',                'Medical imaging records',                               'core',          '{pro,premium,saas-monthly}',         TRUE),
  ('Stock Management',       'stock',                  'Inventory & stock tracking',                            'core',          '{cabinet,pro,premium,saas-monthly}', TRUE),
  ('Sales',                  'sales',                  'Point-of-sale & daily sales tracking',                  'core',          '{cabinet,pro,premium,saas-monthly}', TRUE),
  ('Odontogram',             'odontogram',             'Dental chart / odontogram',                             'core',          '{cabinet,pro,premium,saas-monthly}', TRUE),
  ('Before/After Photos',    'before_after_photos',    'Treatment before & after comparison photos',            'core',          '{pro,premium,saas-monthly}',         TRUE),
  ('Exercise Programs',      'exercise_programs',      'Physiotherapy exercise program builder',                'core',          '{pro,premium,saas-monthly}',         TRUE),
  ('Meal Plans',             'meal_plans',             'Nutrition & meal plan management',                      'core',          '{pro,premium,saas-monthly}',         TRUE),
  ('Growth Charts',          'growth_charts',          'Pediatric growth chart tracking',                       'core',          '{pro,premium,saas-monthly}',         TRUE),
  ('Vaccination',            'vaccination',            'Vaccination schedule & records',                        'core',          '{cabinet,pro,premium,saas-monthly}', TRUE),
  ('Bed Management',         'bed_management',         'Hospital bed & admission management',                   'core',          '{pro,premium,saas-monthly}',         TRUE),
  ('Installments',           'installments',           'Payment installment plans',                             'core',          '{cabinet,pro,premium,saas-monthly}', TRUE),
  ('Certificates',           'certificates',           'Medical certificate generation',                        'core',          '{cabinet,pro,premium,saas-monthly}', TRUE),
  ('Sterilization Log',      'sterilization_log',      'Equipment sterilization tracking',                      'core',          '{cabinet,pro,premium,saas-monthly}', TRUE),
  ('Departments',            'departments',            'Multi-department clinic management',                    'core',          '{pro,premium,saas-monthly}',         TRUE),
  ('Consent Forms',          'consent_forms',          'Digital consent form management',                       'core',          '{pro,premium,saas-monthly}',         TRUE),
  ('Treatment Packages',     'treatment_packages',     'Bundled treatment package management',                  'core',          '{pro,premium,saas-monthly}',         TRUE),
  ('Consultation Photos',    'consultation_photos',    'In-consultation photo capture',                         'core',          '{pro,premium,saas-monthly}',         TRUE),

  -- Advanced features
  ('IVF Cycles',             'ivf_cycles',             'IVF cycle tracking & management',                       'advanced',      '{premium,saas-monthly}',             TRUE),
  ('IVF Protocols',          'ivf_protocols',          'IVF protocol templates',                                'advanced',      '{premium,saas-monthly}',             TRUE),
  ('Dialysis Sessions',      'dialysis_sessions',      'Dialysis session management',                           'advanced',      '{premium,saas-monthly}',             TRUE),
  ('Dialysis Machines',      'dialysis_machines',      'Dialysis machine inventory & scheduling',               'advanced',      '{premium,saas-monthly}',             TRUE),
  ('Prosthetic Orders',      'prosthetic_orders',      'Dental prosthetic order management',                    'advanced',      '{pro,premium,saas-monthly}',         TRUE),
  ('Lab Materials',          'lab_materials',           'Dental lab material inventory',                         'advanced',      '{pro,premium,saas-monthly}',         TRUE),
  ('Lab Invoices',           'lab_invoices',            'Dental lab invoice management',                         'advanced',      '{pro,premium,saas-monthly}',         TRUE),

  -- Para-medical features
  ('Physio Sessions',        'physio_sessions',        'Physiotherapy session tracking',                         'core',          '{cabinet,pro,premium,saas-monthly}', TRUE),
  ('Progress Photos',        'progress_photos',        'Patient progress photo timeline',                        'core',          '{pro,premium,saas-monthly}',         TRUE),
  ('Body Measurements',      'body_measurements',      'Body measurement tracking',                              'core',          '{pro,premium,saas-monthly}',         TRUE),
  ('Therapy Notes',          'therapy_notes',           'Therapy session notes & documentation',                  'core',          '{cabinet,pro,premium,saas-monthly}', TRUE),
  ('Therapy Plans',          'therapy_plans',           'Therapy treatment plan builder',                         'core',          '{pro,premium,saas-monthly}',         TRUE),
  ('Speech Exercises',       'speech_exercises',        'Speech therapy exercise library',                        'core',          '{pro,premium,saas-monthly}',         TRUE),
  ('Speech Sessions',        'speech_sessions',         'Speech therapy session tracking',                        'core',          '{cabinet,pro,premium,saas-monthly}', TRUE),
  ('Speech Reports',         'speech_reports',          'Speech therapy progress reports',                        'core',          '{pro,premium,saas-monthly}',         TRUE),
  ('Lens Inventory',         'lens_inventory',          'Optical lens inventory management',                      'core',          '{cabinet,pro,premium,saas-monthly}', TRUE),
  ('Frame Catalog',          'frame_catalog',           'Eyeglass frame catalog',                                 'core',          '{cabinet,pro,premium,saas-monthly}', TRUE),
  ('Optical Prescriptions',  'optical_prescriptions',   'Optical prescription management',                        'core',          '{cabinet,pro,premium,saas-monthly}', TRUE),

  -- Diagnostic & Equipment
  ('Lab Tests',              'lab_tests',               'Lab test catalog & ordering',                            'core',          '{pro,premium,saas-monthly}',         TRUE),
  ('Radiology Reports',      'radiology_reports',       'Radiology report management',                            'core',          '{pro,premium,saas-monthly}',         TRUE),
  ('Equipment Rentals',      'equipment_rentals',       'Medical equipment rental tracking',                       'core',          '{pro,premium,saas-monthly}',         TRUE),
  ('Equipment Maintenance',  'equipment_maintenance',   'Equipment maintenance scheduling',                        'core',          '{pro,premium,saas-monthly}',         TRUE),
  ('Parapharmacy',           'parapharmacy',            'Parapharmacy product management',                         'core',          '{cabinet,pro,premium,saas-monthly}', TRUE),

  -- Specialist features
  ('Dermatology',            'dermatology',             'Dermatology module (skin photos, conditions)',             'advanced',      '{pro,premium,saas-monthly}',         TRUE),
  ('Cardiology',             'cardiology',              'Cardiology module (ECG, blood pressure)',                  'advanced',      '{pro,premium,saas-monthly}',         TRUE),
  ('ENT',                    'ent',                     'ENT specialist module (hearing, exams)',                   'advanced',      '{pro,premium,saas-monthly}',         TRUE),
  ('Orthopedics',            'orthopedics',             'Orthopedics module (X-rays, fractures, rehab)',            'advanced',      '{pro,premium,saas-monthly}',         TRUE),
  ('Psychiatry',             'psychiatry',              'Psychiatry module (sessions, medications)',                'advanced',      '{pro,premium,saas-monthly}',         TRUE),
  ('Neurology',              'neurology',               'Neurology module (EEG, neuro exams)',                     'advanced',      '{pro,premium,saas-monthly}',         TRUE),
  ('Urology',                'urology',                 'Urology exam module',                                     'advanced',      '{pro,premium,saas-monthly}',         TRUE),
  ('Pulmonology',            'pulmonology',             'Pulmonology module (spirometry, respiratory)',             'advanced',      '{pro,premium,saas-monthly}',         TRUE),
  ('Endocrinology',          'endocrinology',           'Endocrinology module (blood sugar, hormones, diabetes)',   'advanced',      '{pro,premium,saas-monthly}',         TRUE),
  ('Rheumatology',           'rheumatology',            'Rheumatology module (joint assessments, mobility)',        'advanced',      '{pro,premium,saas-monthly}',         TRUE),
  ('Pregnancy Tracking',     'pregnancy_tracking',      'Pregnancy & prenatal tracking',                           'advanced',      '{pro,premium,saas-monthly}',         TRUE),
  ('Ultrasound Records',     'ultrasound_records',      'Ultrasound record management',                            'advanced',      '{pro,premium,saas-monthly}',         TRUE),
  ('Vision Tests',           'vision_tests',            'Vision acuity testing',                                   'advanced',      '{pro,premium,saas-monthly}',         TRUE),
  ('IOP Tracking',           'iop_tracking',            'Intraocular pressure tracking',                           'advanced',      '{pro,premium,saas-monthly}',         TRUE)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 2. PRICING TIERS
-- ============================================================

INSERT INTO pricing_tiers (slug, name, description, is_popular, pricing, features, limits, sort_order, is_active)
VALUES
  (
    'vitrine',
    'Vitrine',
    'Site web professionnel pour votre cabinet',
    FALSE,
    '{"doctor": {"monthly": 0, "yearly": 0}, "dentist": {"monthly": 0, "yearly": 0}, "pharmacy": {"monthly": 0, "yearly": 0}}'::JSONB,
    '[
      {"key": "website", "label": "Site web professionnel", "included": true},
      {"key": "seo", "label": "Optimisation SEO", "included": true},
      {"key": "contact_form", "label": "Formulaire de contact", "included": true},
      {"key": "appointments", "label": "Gestion des rendez-vous", "included": false},
      {"key": "patients", "label": "Gestion des patients", "included": false},
      {"key": "billing", "label": "Facturation", "included": false}
    ]'::JSONB,
    '{"maxDoctors": 1, "maxPatients": 0, "maxAppointmentsPerMonth": 0, "storageGB": 1, "customDomain": false, "apiAccess": false, "whiteLabel": false}'::JSONB,
    1,
    TRUE
  ),
  (
    'cabinet',
    'Cabinet',
    'Gestion complete de votre cabinet medical',
    FALSE,
    '{"doctor": {"monthly": 499, "yearly": 4990}, "dentist": {"monthly": 599, "yearly": 5990}, "pharmacy": {"monthly": 399, "yearly": 3990}}'::JSONB,
    '[
      {"key": "website", "label": "Site web professionnel", "included": true},
      {"key": "appointments", "label": "Gestion des rendez-vous", "included": true},
      {"key": "patients", "label": "Gestion des patients", "included": true, "limit": "500 patients"},
      {"key": "prescriptions", "label": "Ordonnances electroniques", "included": true},
      {"key": "billing", "label": "Facturation de base", "included": true},
      {"key": "whatsapp", "label": "Rappels WhatsApp", "included": false},
      {"key": "analytics", "label": "Tableau de bord avance", "included": false}
    ]'::JSONB,
    '{"maxDoctors": 2, "maxPatients": 500, "maxAppointmentsPerMonth": 200, "storageGB": 5, "customDomain": false, "apiAccess": false, "whiteLabel": false}'::JSONB,
    2,
    TRUE
  ),
  (
    'pro',
    'Pro',
    'Pour les cabinets en croissance',
    TRUE,
    '{"doctor": {"monthly": 999, "yearly": 9990}, "dentist": {"monthly": 1199, "yearly": 11990}, "pharmacy": {"monthly": 799, "yearly": 7990}}'::JSONB,
    '[
      {"key": "website", "label": "Site web professionnel", "included": true},
      {"key": "appointments", "label": "Gestion des rendez-vous", "included": true},
      {"key": "patients", "label": "Gestion des patients", "included": true, "limit": "2000 patients"},
      {"key": "prescriptions", "label": "Ordonnances electroniques", "included": true},
      {"key": "billing", "label": "Facturation avancee", "included": true},
      {"key": "whatsapp", "label": "Rappels WhatsApp", "included": true},
      {"key": "analytics", "label": "Tableau de bord avance", "included": true},
      {"key": "custom_domain", "label": "Domaine personnalise", "included": true},
      {"key": "api", "label": "Acces API", "included": false}
    ]'::JSONB,
    '{"maxDoctors": 5, "maxPatients": 2000, "maxAppointmentsPerMonth": 1000, "storageGB": 20, "customDomain": true, "apiAccess": false, "whiteLabel": false}'::JSONB,
    3,
    TRUE
  ),
  (
    'premium',
    'Premium',
    'Solution complete pour les grandes structures',
    FALSE,
    '{"doctor": {"monthly": 1999, "yearly": 19990}, "dentist": {"monthly": 2499, "yearly": 24990}, "pharmacy": {"monthly": 1499, "yearly": 14990}}'::JSONB,
    '[
      {"key": "website", "label": "Site web professionnel", "included": true},
      {"key": "appointments", "label": "Gestion des rendez-vous", "included": true},
      {"key": "patients", "label": "Gestion illimitee des patients", "included": true},
      {"key": "prescriptions", "label": "Ordonnances electroniques", "included": true},
      {"key": "billing", "label": "Facturation avancee", "included": true},
      {"key": "whatsapp", "label": "Rappels WhatsApp", "included": true},
      {"key": "analytics", "label": "Tableau de bord avance", "included": true},
      {"key": "custom_domain", "label": "Domaine personnalise", "included": true},
      {"key": "api", "label": "Acces API", "included": true},
      {"key": "white_label", "label": "Marque blanche", "included": true},
      {"key": "priority_support", "label": "Support prioritaire", "included": true}
    ]'::JSONB,
    '{"maxDoctors": -1, "maxPatients": -1, "maxAppointmentsPerMonth": -1, "storageGB": 100, "customDomain": true, "apiAccess": true, "whiteLabel": true}'::JSONB,
    4,
    TRUE
  ),
  (
    'saas-monthly',
    'SaaS Monthly',
    'Abonnement mensuel flexible tout inclus',
    FALSE,
    '{"doctor": {"monthly": 1499, "yearly": 14990}, "dentist": {"monthly": 1799, "yearly": 17990}, "pharmacy": {"monthly": 1199, "yearly": 11990}}'::JSONB,
    '[
      {"key": "website", "label": "Site web professionnel", "included": true},
      {"key": "appointments", "label": "Gestion des rendez-vous", "included": true},
      {"key": "patients", "label": "Gestion illimitee des patients", "included": true},
      {"key": "prescriptions", "label": "Ordonnances electroniques", "included": true},
      {"key": "billing", "label": "Facturation avancee", "included": true},
      {"key": "whatsapp", "label": "Rappels WhatsApp", "included": true},
      {"key": "analytics", "label": "Tableau de bord avance", "included": true},
      {"key": "custom_domain", "label": "Domaine personnalise", "included": true},
      {"key": "api", "label": "Acces API", "included": true},
      {"key": "white_label", "label": "Marque blanche", "included": true},
      {"key": "priority_support", "label": "Support prioritaire", "included": true}
    ]'::JSONB,
    '{"maxDoctors": -1, "maxPatients": -1, "maxAppointmentsPerMonth": -1, "storageGB": 50, "customDomain": true, "apiAccess": true, "whiteLabel": true}'::JSONB,
    5,
    TRUE
  )
ON CONFLICT (slug) DO NOTHING;
