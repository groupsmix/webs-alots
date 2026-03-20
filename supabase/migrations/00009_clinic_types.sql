-- ============================================================
-- Migration 00009: Clinic Type Registry
-- Adds clinic_types table with all health sector categories,
-- seeds ~35 clinic types, and adds FK to clinics table.
-- ============================================================

-- ============================================================
-- 1. CREATE CLINIC_TYPES TABLE
-- ============================================================

CREATE TABLE clinic_types (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_key        TEXT NOT NULL UNIQUE,
  name_fr         TEXT NOT NULL,
  name_ar         TEXT NOT NULL,
  category        TEXT NOT NULL CHECK (category IN (
    'medical', 'para_medical', 'diagnostic', 'pharmacy_retail', 'clinics_centers'
  )),
  icon            TEXT NOT NULL DEFAULT 'Stethoscope',
  features_config JSONB NOT NULL DEFAULT '{}',
  sort_order      INT NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_clinic_types_category ON clinic_types(category);
CREATE INDEX idx_clinic_types_key ON clinic_types(type_key);

-- ============================================================
-- 2. SEED CLINIC TYPES (~35 types across 5 categories)
-- ============================================================

-- ---- MEDICAL (طبي) ----

INSERT INTO clinic_types (type_key, name_fr, name_ar, category, icon, sort_order, features_config) VALUES
-- ---- MEDICAL (طبي) ----
('general_medicine',  'Médecine Générale',           'الطب العام',                    'medical', 'Stethoscope',    1,  '{"appointments":true,"prescriptions":true,"consultations":true,"lab_results":false,"imaging":false,"stock":false,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('cardiology',        'Cardiologie',                  'أمراض القلب',                   'medical', 'Heart',          2,  '{"appointments":true,"prescriptions":true,"consultations":true,"lab_results":true,"imaging":true,"stock":false,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('dermatology',       'Dermatologie',                 'الأمراض الجلدية',               'medical', 'Scan',           3,  '{"appointments":true,"prescriptions":true,"consultations":true,"lab_results":false,"imaging":false,"stock":false,"sales":false,"odontogram":false,"before_after_photos":true,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('pediatrics',        'Pédiatrie',                    'طب الأطفال',                    'medical', 'Baby',           4,  '{"appointments":true,"prescriptions":true,"consultations":true,"lab_results":true,"imaging":false,"stock":false,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":true,"vaccination":true,"bed_management":false,"installments":false}'),
('gynecology',        'Gynécologie-Obstétrique',      'أمراض النساء والتوليد',          'medical', 'HeartHandshake', 5,  '{"appointments":true,"prescriptions":true,"consultations":true,"lab_results":true,"imaging":true,"stock":false,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('ophthalmology',     'Ophtalmologie',                'طب العيون',                     'medical', 'Eye',            6,  '{"appointments":true,"prescriptions":true,"consultations":true,"lab_results":false,"imaging":false,"stock":false,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('ent',               'ORL',                          'أمراض الأنف والأذن والحنجرة',   'medical', 'Ear',            7,  '{"appointments":true,"prescriptions":true,"consultations":true,"lab_results":false,"imaging":true,"stock":false,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('neurology',         'Neurologie',                   'طب الأعصاب',                    'medical', 'Brain',          8,  '{"appointments":true,"prescriptions":true,"consultations":true,"lab_results":true,"imaging":true,"stock":false,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('psychiatry',        'Psychiatrie',                  'الطب النفسي',                   'medical', 'BrainCircuit',   9,  '{"appointments":true,"prescriptions":true,"consultations":true,"lab_results":false,"imaging":false,"stock":false,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('orthopedics',       'Orthopédie',                   'جراحة العظام',                  'medical', 'Bone',           10, '{"appointments":true,"prescriptions":true,"consultations":true,"lab_results":false,"imaging":true,"stock":false,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('urology',           'Urologie',                     'المسالك البولية',               'medical', 'Activity',       11, '{"appointments":true,"prescriptions":true,"consultations":true,"lab_results":true,"imaging":true,"stock":false,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('gastroenterology',  'Gastro-entérologie',           'أمراض الجهاز الهضمي',           'medical', 'Apple',          12, '{"appointments":true,"prescriptions":true,"consultations":true,"lab_results":true,"imaging":true,"stock":false,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('pulmonology',       'Pneumologie',                  'أمراض الرئة',                   'medical', 'Wind',           13, '{"appointments":true,"prescriptions":true,"consultations":true,"lab_results":true,"imaging":true,"stock":false,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('endocrinology',     'Endocrinologie',               'الغدد الصماء والسكري',          'medical', 'Droplets',       14, '{"appointments":true,"prescriptions":true,"consultations":true,"lab_results":true,"imaging":false,"stock":false,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('rheumatology',      'Rhumatologie',                 'أمراض الروماتيزم',              'medical', 'Accessibility',  15, '{"appointments":true,"prescriptions":true,"consultations":true,"lab_results":true,"imaging":true,"stock":false,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),

-- ---- PARA-MEDICAL (شبه طبي) ----

('physiotherapy',     'Kinésithérapie',               'العلاج الطبيعي',                'para_medical', 'Dumbbell',      16, '{"appointments":true,"prescriptions":false,"consultations":true,"lab_results":false,"imaging":false,"stock":false,"sales":false,"odontogram":false,"before_after_photos":true,"exercise_programs":true,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('speech_therapy',    'Orthophonie',                  'النطق والتخاطب',                'para_medical', 'MessageCircle', 17, '{"appointments":true,"prescriptions":false,"consultations":true,"lab_results":false,"imaging":false,"stock":false,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('nutrition',         'Diététique et Nutrition',      'التغذية',                        'para_medical', 'Salad',         18, '{"appointments":true,"prescriptions":false,"consultations":true,"lab_results":false,"imaging":false,"stock":false,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":true,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('psychology',        'Psychologie',                  'علم النفس',                      'para_medical', 'HeartPulse',    19, '{"appointments":true,"prescriptions":false,"consultations":true,"lab_results":false,"imaging":false,"stock":false,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('nursing',           'Soins Infirmiers',             'التمريض',                        'para_medical', 'Syringe',       20, '{"appointments":true,"prescriptions":false,"consultations":true,"lab_results":false,"imaging":false,"stock":true,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":true,"bed_management":false,"installments":false}'),
('optician',          'Opticien',                     'البصريات',                       'para_medical', 'Glasses',       21, '{"appointments":true,"prescriptions":false,"consultations":false,"lab_results":false,"imaging":false,"stock":true,"sales":true,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":true}'),
('podiatry',          'Podologie',                    'طب القدم',                       'para_medical', 'Footprints',    22, '{"appointments":true,"prescriptions":false,"consultations":true,"lab_results":false,"imaging":false,"stock":false,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('osteopathy',        'Ostéopathie',                  'تقويم العظام',                   'para_medical', 'PersonStanding',23, '{"appointments":true,"prescriptions":false,"consultations":true,"lab_results":false,"imaging":false,"stock":false,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":true,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),

-- ---- DIAGNOSTIC (تشخيصي) ----

('radiology',         'Radiologie',                   'الأشعة',                         'diagnostic', 'ScanLine',       24, '{"appointments":true,"prescriptions":false,"consultations":false,"lab_results":true,"imaging":true,"stock":false,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('medical_lab',       'Laboratoire d''Analyses',      'مختبر التحاليل الطبية',          'diagnostic', 'TestTube',       25, '{"appointments":true,"prescriptions":false,"consultations":false,"lab_results":true,"imaging":false,"stock":true,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('medical_imaging',   'Imagerie Médicale',            'التصوير الطبي',                  'diagnostic', 'MonitorCheck',   26, '{"appointments":true,"prescriptions":false,"consultations":false,"lab_results":true,"imaging":true,"stock":false,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('pathology',         'Anatomie Pathologique',        'التشريح المرضي',                 'diagnostic', 'Microscope',     27, '{"appointments":false,"prescriptions":false,"consultations":false,"lab_results":true,"imaging":false,"stock":true,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),

-- ---- PHARMACY & RETAIL (صيدلة وبيع) ----

('pharmacy',          'Pharmacie',                    'صيدلية',                         'pharmacy_retail', 'Pill',           28, '{"appointments":false,"prescriptions":true,"consultations":false,"lab_results":false,"imaging":false,"stock":true,"sales":true,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('parapharmacy',      'Parapharmacie',                'شبه صيدلية',                    'pharmacy_retail', 'ShoppingBag',    29, '{"appointments":false,"prescriptions":false,"consultations":false,"lab_results":false,"imaging":false,"stock":true,"sales":true,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":false}'),
('medical_equipment', 'Matériel Médical',             'المعدات الطبية',                 'pharmacy_retail', 'Wrench',         30, '{"appointments":false,"prescriptions":false,"consultations":false,"lab_results":false,"imaging":false,"stock":true,"sales":true,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":true}'),
('orthopedic_supply', 'Orthopédie et Appareillage',   'تقويم العظام والأجهزة',          'pharmacy_retail', 'Cog',            31, '{"appointments":true,"prescriptions":false,"consultations":false,"lab_results":false,"imaging":false,"stock":true,"sales":true,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":true}'),

-- ---- CLINICS & CENTERS (عيادات ومراكز) ----

('dental_clinic',     'Cabinet Dentaire',             'عيادة الأسنان',                  'clinics_centers', 'Smile',          32, '{"appointments":true,"prescriptions":true,"consultations":true,"lab_results":true,"imaging":true,"stock":true,"sales":false,"odontogram":true,"before_after_photos":true,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":true}'),
('polyclinic',        'Polyclinique',                 'عيادة متعددة التخصصات',          'clinics_centers', 'Building2',      33, '{"appointments":true,"prescriptions":true,"consultations":true,"lab_results":true,"imaging":true,"stock":true,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":true,"installments":true}'),
('medical_center',    'Centre Médical',               'مركز طبي',                       'clinics_centers', 'Hospital',       34, '{"appointments":true,"prescriptions":true,"consultations":true,"lab_results":true,"imaging":true,"stock":true,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":true,"bed_management":true,"installments":true}'),
('dialysis_center',   'Centre d''Hémodialyse',        'مركز غسيل الكلى',                'clinics_centers', 'Droplet',        35, '{"appointments":true,"prescriptions":true,"consultations":true,"lab_results":true,"imaging":false,"stock":true,"sales":false,"odontogram":false,"before_after_photos":false,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":true,"installments":false}'),
('rehabilitation',    'Centre de Rééducation',        'مركز إعادة التأهيل',             'clinics_centers', 'StretchVertical',36, '{"appointments":true,"prescriptions":false,"consultations":true,"lab_results":false,"imaging":false,"stock":false,"sales":false,"odontogram":false,"before_after_photos":true,"exercise_programs":true,"meal_plans":true,"growth_charts":false,"vaccination":false,"bed_management":true,"installments":true}'),
('aesthetic_clinic',  'Clinique Esthétique',          'عيادة التجميل',                  'clinics_centers', 'Sparkles',       37, '{"appointments":true,"prescriptions":false,"consultations":true,"lab_results":false,"imaging":false,"stock":true,"sales":true,"odontogram":false,"before_after_photos":true,"exercise_programs":false,"meal_plans":false,"growth_charts":false,"vaccination":false,"bed_management":false,"installments":true}');

-- ============================================================
-- 3. ADD clinic_type_key FK TO CLINICS TABLE
-- ============================================================

ALTER TABLE clinics
  ADD COLUMN clinic_type_key TEXT REFERENCES clinic_types(type_key);

CREATE INDEX idx_clinics_type_key ON clinics(clinic_type_key);

-- ============================================================
-- 4. ENABLE RLS ON CLINIC_TYPES
-- ============================================================

ALTER TABLE clinic_types ENABLE ROW LEVEL SECURITY;

-- Everyone can read clinic types (public reference data)
CREATE POLICY "clinic_types_select_all" ON clinic_types
  FOR SELECT USING (true);

-- Only super admins can modify clinic types
CREATE POLICY "sa_clinic_types_all" ON clinic_types
  FOR ALL USING (is_super_admin())
  WITH CHECK (is_super_admin());
