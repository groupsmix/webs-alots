-- ============================================================
-- Migration 00012: Custom Fields Engine (Phase 9, Tasks 38-39)
-- Flexible custom field definitions per clinic type, stored
-- with JSONB values for appointments, patients, consultations,
-- products, and lab orders.
-- ============================================================

-- ============================================================
-- 1. CUSTOM FIELD DEFINITIONS
-- Each clinic type can define its own set of fields that appear
-- on specific entities (appointments, patients, consultations, etc.)
-- ============================================================

CREATE TABLE custom_field_definitions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_type_key TEXT NOT NULL REFERENCES clinic_types(type_key),
  entity_type     TEXT NOT NULL CHECK (entity_type IN (
    'appointment', 'patient', 'consultation', 'product', 'lab_order'
  )),
  field_key       TEXT NOT NULL,
  field_type      TEXT NOT NULL CHECK (field_type IN (
    'text', 'number', 'date', 'select', 'multi_select', 'file', 'tooth_number'
  )),
  label_fr        TEXT NOT NULL,
  label_ar        TEXT NOT NULL DEFAULT '',
  description     TEXT,
  placeholder     TEXT,
  is_required     BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order      INT NOT NULL DEFAULT 0,
  options         JSONB DEFAULT '[]',      -- For select / multi_select: [{"value":"v1","label_fr":"...","label_ar":"..."}]
  validation      JSONB DEFAULT '{}',      -- min, max, pattern, min_length, max_length, etc.
  default_value   JSONB,                   -- Default value (type depends on field_type)
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_system       BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE for built-in fields (Task 39), cannot be deleted by clinic admins
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),

  -- Each clinic type + entity can only have one field with a given key
  UNIQUE (clinic_type_key, entity_type, field_key)
);

CREATE INDEX idx_cfd_clinic_type ON custom_field_definitions(clinic_type_key);
CREATE INDEX idx_cfd_entity ON custom_field_definitions(entity_type);
CREATE INDEX idx_cfd_active ON custom_field_definitions(is_active);

-- ============================================================
-- 2. CUSTOM FIELD VALUES
-- Stores actual values entered by users. One row per entity
-- instance, with all custom field values in a single JSONB column.
-- ============================================================

CREATE TABLE custom_field_values (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  entity_type     TEXT NOT NULL CHECK (entity_type IN (
    'appointment', 'patient', 'consultation', 'product', 'lab_order'
  )),
  entity_id       UUID NOT NULL,           -- FK to the specific record (appointment, patient, etc.)
  field_values    JSONB NOT NULL DEFAULT '{}',  -- { "field_key": value, ... }
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),

  -- One values row per entity instance
  UNIQUE (clinic_id, entity_type, entity_id)
);

CREATE INDEX idx_cfv_clinic ON custom_field_values(clinic_id);
CREATE INDEX idx_cfv_entity ON custom_field_values(entity_type, entity_id);
CREATE INDEX idx_cfv_values ON custom_field_values USING GIN (field_values);

-- ============================================================
-- 3. CLINIC-LEVEL FIELD OVERRIDES (optional)
-- Allows individual clinics to override system defaults
-- (e.g., change required flag, reorder fields).
-- ============================================================

CREATE TABLE custom_field_overrides (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id           UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  field_definition_id UUID NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
  is_enabled          BOOLEAN DEFAULT TRUE,
  is_required         BOOLEAN,
  sort_order          INT,
  created_at          TIMESTAMPTZ DEFAULT now(),

  UNIQUE (clinic_id, field_definition_id)
);

CREATE INDEX idx_cfo_clinic ON custom_field_overrides(clinic_id);

-- ============================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_overrides ENABLE ROW LEVEL SECURITY;

-- Definitions: everyone can read (reference data), only super admins can write
CREATE POLICY "cfd_select_all" ON custom_field_definitions
  FOR SELECT USING (true);

CREATE POLICY "cfd_sa_all" ON custom_field_definitions
  FOR ALL USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Values: users can read/write values for their own clinic
CREATE POLICY "cfv_select_own_clinic" ON custom_field_values
  FOR SELECT USING (
    clinic_id IN (SELECT clinic_id FROM users WHERE auth_id = auth.uid())
    OR is_super_admin()
  );

CREATE POLICY "cfv_insert_own_clinic" ON custom_field_values
  FOR INSERT WITH CHECK (
    clinic_id IN (SELECT clinic_id FROM users WHERE auth_id = auth.uid())
    OR is_super_admin()
  );

CREATE POLICY "cfv_update_own_clinic" ON custom_field_values
  FOR UPDATE USING (
    clinic_id IN (SELECT clinic_id FROM users WHERE auth_id = auth.uid())
    OR is_super_admin()
  );

CREATE POLICY "cfv_delete_own_clinic" ON custom_field_values
  FOR DELETE USING (
    clinic_id IN (SELECT clinic_id FROM users WHERE auth_id = auth.uid())
    OR is_super_admin()
  );

-- Overrides: clinic admins can manage their own overrides
CREATE POLICY "cfo_select_own" ON custom_field_overrides
  FOR SELECT USING (
    clinic_id IN (SELECT clinic_id FROM users WHERE auth_id = auth.uid())
    OR is_super_admin()
  );

CREATE POLICY "cfo_all_own" ON custom_field_overrides
  FOR ALL USING (
    clinic_id IN (SELECT clinic_id FROM users WHERE auth_id = auth.uid())
    OR is_super_admin()
  )
  WITH CHECK (
    clinic_id IN (SELECT clinic_id FROM users WHERE auth_id = auth.uid())
    OR is_super_admin()
  );

-- ============================================================
-- 5. SEED DEFAULT CUSTOM FIELDS (Task 39)
-- ============================================================

-- Dentist: "tooth number" on appointments
INSERT INTO custom_field_definitions (clinic_type_key, entity_type, field_key, field_type, label_fr, label_ar, description, is_required, sort_order, is_system, validation) VALUES
('dental_clinic', 'appointment', 'tooth_number', 'tooth_number', 'Numéro de dent', 'رقم السن', 'Tooth number using FDI notation (11-85)', FALSE, 1, TRUE, '{"min": 11, "max": 85}');

-- Also add for general dentistry types that exist
INSERT INTO custom_field_definitions (clinic_type_key, entity_type, field_key, field_type, label_fr, label_ar, description, is_required, sort_order, is_system, validation) VALUES
('dental_clinic', 'consultation', 'affected_teeth', 'multi_select', 'Dents concernées', 'الأسنان المعنية', 'Select all affected teeth', FALSE, 1, TRUE,
 '{}');

-- Pharmacy: "prescription required" flag on products
INSERT INTO custom_field_definitions (clinic_type_key, entity_type, field_key, field_type, label_fr, label_ar, description, is_required, sort_order, is_system, options) VALUES
('pharmacy', 'product', 'prescription_required', 'select', 'Ordonnance requise', 'وصفة طبية مطلوبة', 'Whether a prescription is required', TRUE, 1, TRUE,
 '[{"value":"yes","label_fr":"Oui","label_ar":"نعم"},{"value":"no","label_fr":"Non","label_ar":"لا"},{"value":"recommended","label_fr":"Recommandé","label_ar":"موصى به"}]');

INSERT INTO custom_field_definitions (clinic_type_key, entity_type, field_key, field_type, label_fr, label_ar, description, is_required, sort_order, is_system) VALUES
('pharmacy', 'product', 'drug_class', 'text', 'Classe thérapeutique', 'الفئة العلاجية', 'Therapeutic drug classification', FALSE, 2, TRUE);

-- Ophthalmologist: refraction values on consultations
INSERT INTO custom_field_definitions (clinic_type_key, entity_type, field_key, field_type, label_fr, label_ar, description, is_required, sort_order, is_system, validation) VALUES
('ophthalmology', 'consultation', 'od_sphere', 'number', 'OD Sphère (dioptries)', 'كرة العين اليمنى', 'Right eye sphere value', FALSE, 1, TRUE, '{"min": -30, "max": 30, "step": 0.25}'),
('ophthalmology', 'consultation', 'od_cylinder', 'number', 'OD Cylindre', 'أسطوانة العين اليمنى', 'Right eye cylinder value', FALSE, 2, TRUE, '{"min": -10, "max": 10, "step": 0.25}'),
('ophthalmology', 'consultation', 'od_axis', 'number', 'OD Axe (°)', 'محور العين اليمنى', 'Right eye axis in degrees', FALSE, 3, TRUE, '{"min": 0, "max": 180, "step": 1}'),
('ophthalmology', 'consultation', 'os_sphere', 'number', 'OS Sphère (dioptries)', 'كرة العين اليسرى', 'Left eye sphere value', FALSE, 4, TRUE, '{"min": -30, "max": 30, "step": 0.25}'),
('ophthalmology', 'consultation', 'os_cylinder', 'number', 'OS Cylindre', 'أسطوانة العين اليسرى', 'Left eye cylinder value', FALSE, 5, TRUE, '{"min": -10, "max": 10, "step": 0.25}'),
('ophthalmology', 'consultation', 'os_axis', 'number', 'OS Axe (°)', 'محور العين اليسرى', 'Left eye axis in degrees', FALSE, 6, TRUE, '{"min": 0, "max": 180, "step": 1}'),
('ophthalmology', 'consultation', 'od_visual_acuity', 'text', 'AV OD (acuité visuelle)', 'حدة البصر للعين اليمنى', 'Right eye visual acuity (e.g., 10/10)', FALSE, 7, TRUE),
('ophthalmology', 'consultation', 'os_visual_acuity', 'text', 'AV OS (acuité visuelle)', 'حدة البصر للعين اليسرى', 'Left eye visual acuity (e.g., 10/10)', FALSE, 8, TRUE),
('ophthalmology', 'consultation', 'intraocular_pressure_od', 'number', 'PIO OD (mmHg)', 'ضغط العين اليمنى', 'Right eye intraocular pressure', FALSE, 9, TRUE, '{"min": 0, "max": 80, "step": 1}'),
('ophthalmology', 'consultation', 'intraocular_pressure_os', 'number', 'PIO OS (mmHg)', 'ضغط العين اليسرى', 'Left eye intraocular pressure', FALSE, 10, TRUE, '{"min": 0, "max": 80, "step": 1}');

-- Pediatrician: growth percentile on visits
INSERT INTO custom_field_definitions (clinic_type_key, entity_type, field_key, field_type, label_fr, label_ar, description, is_required, sort_order, is_system, validation) VALUES
('pediatrics', 'consultation', 'weight_kg', 'number', 'Poids (kg)', 'الوزن (كغ)', 'Child weight in kilograms', FALSE, 1, TRUE, '{"min": 0, "max": 200, "step": 0.1}'),
('pediatrics', 'consultation', 'height_cm', 'number', 'Taille (cm)', 'الطول (سم)', 'Child height in centimeters', FALSE, 2, TRUE, '{"min": 0, "max": 250, "step": 0.1}'),
('pediatrics', 'consultation', 'head_circumference_cm', 'number', 'Périmètre crânien (cm)', 'محيط الرأس (سم)', 'Head circumference in centimeters', FALSE, 3, TRUE, '{"min": 0, "max": 80, "step": 0.1}'),
('pediatrics', 'consultation', 'weight_percentile', 'number', 'Percentile poids', 'النسبة المئوية للوزن', 'Weight-for-age percentile', FALSE, 4, TRUE, '{"min": 0, "max": 100, "step": 1}'),
('pediatrics', 'consultation', 'height_percentile', 'number', 'Percentile taille', 'النسبة المئوية للطول', 'Height-for-age percentile', FALSE, 5, TRUE, '{"min": 0, "max": 100, "step": 1}'),
('pediatrics', 'consultation', 'bmi_percentile', 'number', 'Percentile IMC', 'النسبة المئوية لمؤشر كتلة الجسم', 'BMI-for-age percentile', FALSE, 6, TRUE, '{"min": 0, "max": 100, "step": 1}'),
('pediatrics', 'consultation', 'growth_status', 'select', 'Statut de croissance', 'حالة النمو', 'Growth assessment status', FALSE, 7, TRUE,
 '[{"value":"normal","label_fr":"Normal","label_ar":"طبيعي"},{"value":"underweight","label_fr":"Insuffisance pondérale","label_ar":"نقص الوزن"},{"value":"overweight","label_fr":"Surpoids","label_ar":"زيادة الوزن"},{"value":"stunted","label_fr":"Retard de croissance","label_ar":"تأخر النمو"},{"value":"wasted","label_fr":"Émaciation","label_ar":"هزال"}]');

-- Lab: test category & urgency level on orders
INSERT INTO custom_field_definitions (clinic_type_key, entity_type, field_key, field_type, label_fr, label_ar, description, is_required, sort_order, is_system, options) VALUES
('medical_lab', 'lab_order', 'test_category', 'select', 'Catégorie d''analyse', 'فئة التحليل', 'Category of laboratory test', TRUE, 1, TRUE,
 '[{"value":"hematology","label_fr":"Hématologie","label_ar":"أمراض الدم"},{"value":"biochemistry","label_fr":"Biochimie","label_ar":"الكيمياء الحيوية"},{"value":"microbiology","label_fr":"Microbiologie","label_ar":"الأحياء الدقيقة"},{"value":"immunology","label_fr":"Immunologie","label_ar":"المناعة"},{"value":"parasitology","label_fr":"Parasitologie","label_ar":"الطفيليات"},{"value":"urinalysis","label_fr":"Analyse d''urine","label_ar":"تحليل البول"},{"value":"serology","label_fr":"Sérologie","label_ar":"الأمصال"},{"value":"hormones","label_fr":"Hormonologie","label_ar":"الهرمونات"},{"value":"other","label_fr":"Autre","label_ar":"أخرى"}]'),
('medical_lab', 'lab_order', 'urgency_level', 'select', 'Niveau d''urgence', 'مستوى الاستعجال', 'How urgent is this test', TRUE, 2, TRUE,
 '[{"value":"routine","label_fr":"Routine","label_ar":"روتيني"},{"value":"urgent","label_fr":"Urgent","label_ar":"عاجل"},{"value":"stat","label_fr":"STAT (immédiat)","label_ar":"فوري"},{"value":"timed","label_fr":"Programmé","label_ar":"مجدول"}]'),
('medical_lab', 'lab_order', 'fasting_required', 'select', 'À jeun requis', 'الصيام مطلوب', 'Whether fasting is required before the test', FALSE, 3, TRUE,
 '[{"value":"yes","label_fr":"Oui","label_ar":"نعم"},{"value":"no","label_fr":"Non","label_ar":"لا"},{"value":"preferred","label_fr":"Préféré","label_ar":"مفضل"}]'),
('medical_lab', 'lab_order', 'sample_type', 'select', 'Type d''échantillon', 'نوع العينة', 'Type of sample required', FALSE, 4, TRUE,
 '[{"value":"blood","label_fr":"Sang","label_ar":"دم"},{"value":"urine","label_fr":"Urine","label_ar":"بول"},{"value":"stool","label_fr":"Selles","label_ar":"براز"},{"value":"swab","label_fr":"Écouvillon","label_ar":"مسحة"},{"value":"tissue","label_fr":"Tissu","label_ar":"نسيج"},{"value":"csf","label_fr":"LCR","label_ar":"سائل نخاعي"},{"value":"other","label_fr":"Autre","label_ar":"أخرى"}]');

-- ============================================================
-- 6. UPDATE FEATURES CONFIG
-- Add custom_fields feature flag to all clinic types
-- ============================================================

UPDATE clinic_types
SET features_config = features_config || '{"custom_fields": true}'::jsonb
WHERE is_active = TRUE;
