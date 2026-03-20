-- ============================================================
-- Migration 00009: Clinic Type Registry
-- Creates a clinic_types lookup table with 31 healthcare
-- speciality types grouped into 5 categories, and adds a
-- foreign key from clinics to clinic_types.
-- ============================================================

-- 1. Create the clinic_types table
CREATE TABLE clinic_types (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type_key        TEXT NOT NULL UNIQUE,
  name_fr         TEXT NOT NULL,
  name_ar         TEXT NOT NULL,
  category        TEXT NOT NULL CHECK (category IN (
    'medical',
    'para_medical',
    'diagnostic',
    'pharmacy_retail',
    'clinics_centers'
  )),
  icon            TEXT NOT NULL DEFAULT 'stethoscope',
  features_config JSONB NOT NULL DEFAULT '{}',
  sort_order      INT NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_clinic_types_key ON clinic_types(type_key);
CREATE INDEX idx_clinic_types_category ON clinic_types(category);

-- ============================================================
-- 2. Seed all clinic types
-- ============================================================

-- ============================================================
-- Category: Medical / Cabinet Médical (15 types)
-- ============================================================

INSERT INTO clinic_types (type_key, name_fr, name_ar, category, icon, sort_order, features_config) VALUES
  ('general_medicine', 'Médecin Généraliste', 'طبيب عام', 'medical', 'stethoscope', 1, '{"has_appointments": true, "has_prescriptions": true, "has_consultations": true, "has_medical_certificates": true}'),
  ('dentist', 'Chirurgien Dentiste', 'طبيب أسنان', 'medical', 'smile', 2, '{"has_appointments": true, "has_odontogram": true, "has_treatment_plans": true, "has_lab_orders": true, "has_sterilization": true, "has_before_after": true}'),
  ('pediatrics', 'Pédiatre', 'طبيب أطفال', 'medical', 'baby', 3, '{"has_appointments": true, "has_prescriptions": true, "has_consultations": true, "has_growth_charts": true, "has_vaccination_tracking": true}'),
  ('gynecology', 'Gynécologue', 'طبيب نساء', 'medical', 'heart-pulse', 4, '{"has_appointments": true, "has_prescriptions": true, "has_consultations": true, "has_pregnancy_tracking": true, "has_ultrasound_records": true}'),
  ('ophthalmology', 'Ophtalmologue', 'طبيب عيون', 'medical', 'eye', 5, '{"has_appointments": true, "has_prescriptions": true, "has_consultations": true, "has_vision_tests": true, "has_eye_pressure_tracking": true, "has_lens_prescriptions": true}'),
  ('dermatology', 'Dermatologue', 'طبيب جلد', 'medical', 'scan-face', 6, '{"has_appointments": true, "has_prescriptions": true, "has_consultations": true, "has_skin_photos": true, "has_before_after": true}'),
  ('cardiology', 'Cardiologue', 'طبيب قلب', 'medical', 'heart-pulse', 7, '{"has_appointments": true, "has_prescriptions": true, "has_consultations": true, "has_ecg_records": true, "has_blood_pressure_tracking": true}'),
  ('ent', 'ORL', 'طبيب أنف أذن حنجرة', 'medical', 'ear', 8, '{"has_appointments": true, "has_prescriptions": true, "has_consultations": true, "has_hearing_tests": true}'),
  ('orthopedics', 'Orthopédiste', 'طبيب عظام', 'medical', 'bone', 9, '{"has_appointments": true, "has_prescriptions": true, "has_consultations": true, "has_xray_records": true, "has_rehab_plans": true}'),
  ('psychiatry', 'Psychiatre', 'طبيب نفسي', 'medical', 'brain', 10, '{"has_appointments": true, "has_prescriptions": true, "has_consultations": true, "has_session_notes": true, "has_medication_tracking": true, "has_confidential_records": true}'),
  ('neurology', 'Neurologue', 'طبيب أعصاب', 'medical', 'brain', 11, '{"has_appointments": true, "has_prescriptions": true, "has_consultations": true, "has_eeg_records": true, "has_neurological_exams": true}'),
  ('urology', 'Urologue', 'طبيب مسالك بولية', 'medical', 'activity', 12, '{"has_appointments": true, "has_prescriptions": true, "has_consultations": true, "has_lab_results_tracking": true}'),
  ('pulmonology', 'Pneumologue', 'طبيب رئة', 'medical', 'wind', 13, '{"has_appointments": true, "has_prescriptions": true, "has_consultations": true, "has_respiratory_tests": true, "has_spirometry_records": true}'),
  ('endocrinology', 'Endocrinologue', 'طبيب غدد', 'medical', 'pill', 14, '{"has_appointments": true, "has_prescriptions": true, "has_consultations": true, "has_diabetes_tracking": true, "has_hormone_levels": true, "has_blood_sugar_charts": true}'),
  ('rheumatology', 'Rhumatologue', 'طبيب روماتيزم', 'medical', 'bone', 15, '{"has_appointments": true, "has_prescriptions": true, "has_consultations": true, "has_joint_tracking": true, "has_pain_scores": true, "has_mobility_tests": true}');

-- ============================================================
-- Category: Para-Medical / شبه طبي (5 types)
-- ============================================================

INSERT INTO clinic_types (type_key, name_fr, name_ar, category, icon, sort_order, features_config) VALUES
  ('physiotherapy', 'Kinésithérapeute', 'معالج طبيعي', 'para_medical', 'accessibility', 101, '{"has_appointments": true, "has_treatment_plans": true, "has_exercise_programs": true, "has_session_tracking": true, "has_progress_photos": true}'),
  ('dietetics', 'Nutritionniste', 'أخصائي تغذية', 'para_medical', 'apple', 102, '{"has_appointments": true, "has_consultations": true, "has_meal_plans": true, "has_weight_tracking": true, "has_body_measurements": true}'),
  ('psychology', 'Psychologue', 'أخصائي نفسي', 'para_medical', 'brain', 103, '{"has_appointments": true, "has_consultations": true, "has_session_notes": true, "has_therapy_plans": true, "has_progress_tracking": true}'),
  ('speech_therapy', 'Orthophoniste', 'أخصائي نطق', 'para_medical', 'mic', 104, '{"has_appointments": true, "has_session_tracking": true, "has_exercises": true, "has_progress_reports": true}'),
  ('optician', 'Opticien', 'نظاراتي', 'para_medical', 'glasses', 105, '{"has_appointments": true, "has_products": true, "has_lens_inventory": true, "has_frame_catalog": true, "has_prescription_tracking": true}');

-- ============================================================
-- Category: Diagnostic / تشخيص (3 types)
-- ============================================================

INSERT INTO clinic_types (type_key, name_fr, name_ar, category, icon, sort_order, features_config) VALUES
  ('medical_lab', 'Laboratoire d''Analyses', 'مختبر تحاليل', 'diagnostic', 'test-tubes', 201, '{"has_appointments": true, "has_documents": true, "has_test_orders": true, "has_results_management": true, "has_pdf_reports": true, "has_patient_history": true}'),
  ('radiology', 'Centre de Radiologie', 'مركز أشعة', 'diagnostic', 'scan', 202, '{"has_appointments": true, "has_documents": true, "has_image_management": true, "has_dicom_viewer": true, "has_reports": true}'),
  ('medical_imaging', 'Imagerie Médicale', 'تصوير طبي', 'diagnostic', 'monitor', 203, '{"has_appointments": true, "has_documents": true, "has_mri_scanner_reports": true, "has_image_storage": true}');

-- ============================================================
-- Category: Pharmacy & Retail / صيدلية (3 types)
-- ============================================================

INSERT INTO clinic_types (type_key, name_fr, name_ar, category, icon, sort_order, features_config) VALUES
  ('pharmacy', 'Pharmacie', 'صيدلية', 'pharmacy_retail', 'pill', 301, '{"has_products": true, "has_stock": true, "has_prescriptions": true, "has_loyalty": true, "has_sales": true, "has_on_duty": true, "has_suppliers": true, "has_expiry_tracking": true}'),
  ('parapharmacy', 'Parapharmacie', 'باراصيدلية', 'pharmacy_retail', 'package', 302, '{"has_products": true, "has_stock": true, "has_sales": true, "has_loyalty": true}'),
  ('medical_equipment', 'Matériel Médical', 'معدات طبية', 'pharmacy_retail', 'wrench', 303, '{"has_products": true, "has_stock": true, "has_sales": true, "has_rental_tracking": true, "has_maintenance_logs": true}');

-- ============================================================
-- Category: Clinics & Centers / مصحات و مراكز (5 types)
-- ============================================================

INSERT INTO clinic_types (type_key, name_fr, name_ar, category, icon, sort_order, features_config) VALUES
  ('polyclinic', 'Polyclinique', 'عيادة متعددة', 'clinics_centers', 'building-2', 401, '{"has_appointments": true, "has_prescriptions": true, "has_consultations": true, "has_lab_orders": true, "has_departments": true, "has_shared_patients": true, "has_bed_management": true}'),
  ('aesthetic_clinic', 'Clinique Esthétique', 'عيادة تجميل', 'clinics_centers', 'sparkles', 402, '{"has_appointments": true, "has_consultations": true, "has_before_after": true, "has_treatment_packages": true, "has_consultation_photos": true}'),
  ('ivf_center', 'Centre de Fertilité / FIV', 'مركز خصوبة', 'clinics_centers', 'heart-handshake', 403, '{"has_appointments": true, "has_consultations": true, "has_cycle_tracking": true, "has_treatment_protocols": true}'),
  ('dialysis_center', 'Centre d''Hémodialyse', 'مركز تصفية الدم', 'clinics_centers', 'droplets', 404, '{"has_appointments": true, "has_consultations": true, "has_session_scheduling": true, "has_vitals_tracking": true}'),
  ('dental_lab', 'Laboratoire Dentaire', 'مختبر أسنان', 'clinics_centers', 'flask-conical', 405, '{"has_lab_orders": true, "has_prosthetic_orders": true, "has_materials_tracking": true, "has_delivery_tracking": true}');

-- ============================================================
-- 3. Add clinic_type_id FK to clinics table
-- ============================================================

-- Add the FK column (nullable initially so existing rows don't break)
ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS clinic_type_id UUID REFERENCES clinic_types(id);

CREATE INDEX idx_clinics_type_id ON clinics(clinic_type_id);

-- Back-fill existing clinics based on their current `type` column:
--   doctor   -> general_medicine
--   dentist  -> dentist
--   pharmacy -> pharmacy
UPDATE clinics SET clinic_type_id = (
  SELECT id FROM clinic_types WHERE type_key = 'general_medicine'
) WHERE type = 'doctor' AND clinic_type_id IS NULL;

UPDATE clinics SET clinic_type_id = (
  SELECT id FROM clinic_types WHERE type_key = 'dentist'
) WHERE type = 'dentist' AND clinic_type_id IS NULL;

UPDATE clinics SET clinic_type_id = (
  SELECT id FROM clinic_types WHERE type_key = 'pharmacy'
) WHERE type = 'pharmacy' AND clinic_type_id IS NULL;

-- ============================================================
-- 4. RLS Policies for clinic_types
-- ============================================================

ALTER TABLE clinic_types ENABLE ROW LEVEL SECURITY;

-- Everyone can read clinic types (it's a public lookup table)
CREATE POLICY "clinic_types_public_read"
  ON clinic_types FOR SELECT
  USING (true);

-- Only super admins can manage clinic types
CREATE POLICY "clinic_types_super_admin_manage"
  ON clinic_types FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
        AND users.role = 'super_admin'
    )
  );
