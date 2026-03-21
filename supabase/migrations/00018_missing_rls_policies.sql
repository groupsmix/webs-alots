-- ============================================================
-- Migration 00018: Missing RLS Policies
-- Adds Row Level Security to tables from migrations 00011,
-- 00012, and 00014 that were created without RLS policies.
-- ============================================================

-- ============================================================
-- 1. ENABLE RLS ON ALL TABLES
-- ============================================================

-- From 00011_specialty_modules.sql (Pediatrics, Gynecology, Ophthalmology)
ALTER TABLE growth_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE vaccinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE developmental_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE pregnancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE ultrasound_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE vision_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE iop_measurements ENABLE ROW LEVEL SECURITY;

-- From 00012_specialist_features.sql (Derm, Cardio, ENT, Ortho, Psych, Neuro, etc.)
ALTER TABLE skin_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE skin_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecg_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE blood_pressure_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE heart_monitoring_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE hearing_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ent_exam_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE xray_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE fracture_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE rehab_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE psych_session_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE psych_medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE eeg_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE neuro_exam_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE urology_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE spirometry_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE respiratory_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE blood_sugar_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE hormone_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE diabetes_management ENABLE ROW LEVEL SECURITY;
ALTER TABLE joint_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mobility_tests ENABLE ROW LEVEL SECURITY;

-- From 00014_diagnostic_pharmacy_equipment.sql
ALTER TABLE lab_test_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_test_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE radiology_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE radiology_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE radiology_report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE parapharmacy_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_maintenance ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. SPECIALTY MODULES (00011) -- Pediatrics
-- ============================================================

-- growth_measurements
CREATE POLICY "sa_growth_measurements_all" ON growth_measurements FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_growth_measurements" ON growth_measurements FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_growth_measurements_read" ON growth_measurements FOR SELECT USING (patient_id = get_my_user_id());

-- vaccinations
CREATE POLICY "sa_vaccinations_all" ON vaccinations FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_vaccinations" ON vaccinations FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_vaccinations_read" ON vaccinations FOR SELECT USING (patient_id = get_my_user_id());

-- developmental_milestones
CREATE POLICY "sa_developmental_milestones_all" ON developmental_milestones FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_developmental_milestones" ON developmental_milestones FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_developmental_milestones_read" ON developmental_milestones FOR SELECT USING (patient_id = get_my_user_id());

-- ============================================================
-- 3. SPECIALTY MODULES (00011) -- Gynecology
-- ============================================================

-- pregnancies
CREATE POLICY "sa_pregnancies_all" ON pregnancies FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_pregnancies" ON pregnancies FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_pregnancies_read" ON pregnancies FOR SELECT USING (patient_id = get_my_user_id());

-- ultrasound_records
CREATE POLICY "sa_ultrasound_records_all" ON ultrasound_records FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_ultrasound_records" ON ultrasound_records FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_ultrasound_records_read" ON ultrasound_records FOR SELECT USING (patient_id = get_my_user_id());

-- ============================================================
-- 4. SPECIALTY MODULES (00011) -- Ophthalmology
-- ============================================================

-- vision_tests
CREATE POLICY "sa_vision_tests_all" ON vision_tests FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_vision_tests" ON vision_tests FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_vision_tests_read" ON vision_tests FOR SELECT USING (patient_id = get_my_user_id());

-- iop_measurements
CREATE POLICY "sa_iop_measurements_all" ON iop_measurements FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_iop_measurements" ON iop_measurements FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_iop_measurements_read" ON iop_measurements FOR SELECT USING (patient_id = get_my_user_id());

-- ============================================================
-- 5. SPECIALIST FEATURES (00012) -- Dermatologist
-- ============================================================

CREATE POLICY "sa_skin_photos_all" ON skin_photos FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_skin_photos" ON skin_photos FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_skin_photos_read" ON skin_photos FOR SELECT USING (patient_id = get_my_user_id());

CREATE POLICY "sa_skin_conditions_all" ON skin_conditions FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_skin_conditions" ON skin_conditions FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_skin_conditions_read" ON skin_conditions FOR SELECT USING (patient_id = get_my_user_id());

-- ============================================================
-- 6. SPECIALIST FEATURES (00012) -- Cardiologist
-- ============================================================

CREATE POLICY "sa_ecg_records_all" ON ecg_records FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_ecg_records" ON ecg_records FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_ecg_records_read" ON ecg_records FOR SELECT USING (patient_id = get_my_user_id());

CREATE POLICY "sa_bp_readings_all" ON blood_pressure_readings FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_bp_readings" ON blood_pressure_readings FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_bp_readings_read" ON blood_pressure_readings FOR SELECT USING (patient_id = get_my_user_id());

CREATE POLICY "sa_heart_notes_all" ON heart_monitoring_notes FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_heart_notes" ON heart_monitoring_notes FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_heart_notes_read" ON heart_monitoring_notes FOR SELECT USING (patient_id = get_my_user_id());

-- ============================================================
-- 7. SPECIALIST FEATURES (00012) -- ENT
-- ============================================================

CREATE POLICY "sa_hearing_tests_all" ON hearing_tests FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_hearing_tests" ON hearing_tests FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_hearing_tests_read" ON hearing_tests FOR SELECT USING (patient_id = get_my_user_id());

CREATE POLICY "sa_ent_exams_all" ON ent_exam_records FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_ent_exams" ON ent_exam_records FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_ent_exams_read" ON ent_exam_records FOR SELECT USING (patient_id = get_my_user_id());

-- ============================================================
-- 8. SPECIALIST FEATURES (00012) -- Orthopedist
-- ============================================================

CREATE POLICY "sa_xray_records_all" ON xray_records FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_xray_records" ON xray_records FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_xray_records_read" ON xray_records FOR SELECT USING (patient_id = get_my_user_id());

CREATE POLICY "sa_fracture_records_all" ON fracture_records FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_fracture_records" ON fracture_records FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_fracture_records_read" ON fracture_records FOR SELECT USING (patient_id = get_my_user_id());

CREATE POLICY "sa_rehab_plans_all" ON rehab_plans FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_rehab_plans" ON rehab_plans FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_rehab_plans_read" ON rehab_plans FOR SELECT USING (patient_id = get_my_user_id());

-- ============================================================
-- 9. SPECIALIST FEATURES (00012) -- Psychiatrist
-- ============================================================

CREATE POLICY "sa_psych_notes_all" ON psych_session_notes FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_psych_notes" ON psych_session_notes FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());

CREATE POLICY "sa_psych_meds_all" ON psych_medications FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_psych_meds" ON psych_medications FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_psych_meds_read" ON psych_medications FOR SELECT USING (patient_id = get_my_user_id());

-- ============================================================
-- 10. SPECIALIST FEATURES (00012) -- Neurologist
-- ============================================================

CREATE POLICY "sa_eeg_records_all" ON eeg_records FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_eeg_records" ON eeg_records FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_eeg_records_read" ON eeg_records FOR SELECT USING (patient_id = get_my_user_id());

CREATE POLICY "sa_neuro_exams_all" ON neuro_exam_records FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_neuro_exams" ON neuro_exam_records FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_neuro_exams_read" ON neuro_exam_records FOR SELECT USING (patient_id = get_my_user_id());

-- ============================================================
-- 11. SPECIALIST FEATURES (00012) -- Remaining Specialists
-- ============================================================

-- Urologist
CREATE POLICY "sa_urology_exams_all" ON urology_exams FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_urology_exams" ON urology_exams FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_urology_exams_read" ON urology_exams FOR SELECT USING (patient_id = get_my_user_id());

-- Pulmonologist
CREATE POLICY "sa_spirometry_all" ON spirometry_records FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_spirometry" ON spirometry_records FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_spirometry_read" ON spirometry_records FOR SELECT USING (patient_id = get_my_user_id());

CREATE POLICY "sa_respiratory_tests_all" ON respiratory_tests FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_respiratory_tests" ON respiratory_tests FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_respiratory_tests_read" ON respiratory_tests FOR SELECT USING (patient_id = get_my_user_id());

-- Endocrinologist
CREATE POLICY "sa_blood_sugar_all" ON blood_sugar_readings FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_blood_sugar" ON blood_sugar_readings FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_blood_sugar_read" ON blood_sugar_readings FOR SELECT USING (patient_id = get_my_user_id());

CREATE POLICY "sa_hormone_levels_all" ON hormone_levels FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_hormone_levels" ON hormone_levels FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_hormone_levels_read" ON hormone_levels FOR SELECT USING (patient_id = get_my_user_id());

CREATE POLICY "sa_diabetes_mgmt_all" ON diabetes_management FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_diabetes_mgmt" ON diabetes_management FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_diabetes_mgmt_read" ON diabetes_management FOR SELECT USING (patient_id = get_my_user_id());

-- Rheumatologist
CREATE POLICY "sa_joint_assessments_all" ON joint_assessments FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_joint_assessments" ON joint_assessments FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_joint_assessments_read" ON joint_assessments FOR SELECT USING (patient_id = get_my_user_id());

CREATE POLICY "sa_mobility_tests_all" ON mobility_tests FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_mobility_tests" ON mobility_tests FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_mobility_tests_read" ON mobility_tests FOR SELECT USING (patient_id = get_my_user_id());

-- ============================================================
-- 12. DIAGNOSTIC -- Lab (00014)
-- ============================================================

-- lab_test_catalog (reference data: everyone reads, staff manages)
CREATE POLICY "sa_lab_test_catalog_all" ON lab_test_catalog FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_lab_test_catalog" ON lab_test_catalog FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "lab_test_catalog_select" ON lab_test_catalog FOR SELECT USING (clinic_id = get_user_clinic_id());

-- lab_test_items
CREATE POLICY "sa_lab_test_items_all" ON lab_test_items FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_lab_test_items" ON lab_test_items FOR ALL
  USING (is_clinic_staff() AND EXISTS (SELECT 1 FROM lab_test_orders o WHERE o.id = lab_test_items.order_id AND o.clinic_id = get_user_clinic_id()))
  WITH CHECK (is_clinic_staff() AND EXISTS (SELECT 1 FROM lab_test_orders o WHERE o.id = lab_test_items.order_id AND o.clinic_id = get_user_clinic_id()));
CREATE POLICY "patient_lab_test_items_read" ON lab_test_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM lab_test_orders o WHERE o.id = lab_test_items.order_id AND o.patient_id = get_my_user_id()));

-- lab_test_results
CREATE POLICY "sa_lab_test_results_all" ON lab_test_results FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_lab_test_results" ON lab_test_results FOR ALL
  USING (is_clinic_staff() AND EXISTS (SELECT 1 FROM lab_test_orders o WHERE o.id = lab_test_results.order_id AND o.clinic_id = get_user_clinic_id()))
  WITH CHECK (is_clinic_staff() AND EXISTS (SELECT 1 FROM lab_test_orders o WHERE o.id = lab_test_results.order_id AND o.clinic_id = get_user_clinic_id()));
CREATE POLICY "patient_lab_test_results_read" ON lab_test_results FOR SELECT
  USING (EXISTS (SELECT 1 FROM lab_test_orders o WHERE o.id = lab_test_results.order_id AND o.patient_id = get_my_user_id()));

-- ============================================================
-- 13. DIAGNOSTIC -- Radiology (00014)
-- ============================================================

CREATE POLICY "sa_radiology_orders_all" ON radiology_orders FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_radiology_orders" ON radiology_orders FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_radiology_orders_read" ON radiology_orders FOR SELECT USING (patient_id = get_my_user_id());

CREATE POLICY "sa_radiology_images_all" ON radiology_images FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_radiology_images" ON radiology_images FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "patient_radiology_images_read" ON radiology_images FOR SELECT
  USING (EXISTS (SELECT 1 FROM radiology_orders o WHERE o.id = radiology_images.order_id AND o.patient_id = get_my_user_id()));

CREATE POLICY "sa_radiology_templates_all" ON radiology_report_templates FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_radiology_templates" ON radiology_report_templates FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());

-- ============================================================
-- 14. PHARMACY & RETAIL (00014)
-- ============================================================

-- parapharmacy_categories
CREATE POLICY "sa_parapharmacy_categories_all" ON parapharmacy_categories FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_parapharmacy_categories" ON parapharmacy_categories FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "parapharmacy_categories_select" ON parapharmacy_categories FOR SELECT USING (clinic_id = get_user_clinic_id());

-- equipment_inventory
CREATE POLICY "sa_equipment_inventory_all" ON equipment_inventory FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_equipment_inventory" ON equipment_inventory FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
CREATE POLICY "equipment_inventory_select" ON equipment_inventory FOR SELECT USING (clinic_id = get_user_clinic_id());

-- equipment_rentals
CREATE POLICY "sa_equipment_rentals_all" ON equipment_rentals FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_equipment_rentals" ON equipment_rentals FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());

-- equipment_maintenance
CREATE POLICY "sa_equipment_maintenance_all" ON equipment_maintenance FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "staff_equipment_maintenance" ON equipment_maintenance FOR ALL USING (clinic_id = get_user_clinic_id() AND is_clinic_staff()) WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
