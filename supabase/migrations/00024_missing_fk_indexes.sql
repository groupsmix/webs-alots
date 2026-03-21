-- ============================================================
-- Migration 00024: Add Missing FK Indexes
--
-- Foreign-key columns without a corresponding index hurt query
-- performance on JOINs / cascading deletes as data grows.
-- This migration adds IF NOT EXISTS indexes for every FK column
-- that was not already indexed in prior migrations.
-- ============================================================

-- ============================================================
-- 00001 tables (initial schema)
-- ============================================================

-- appointments.service_id
CREATE INDEX IF NOT EXISTS idx_appointments_service ON appointments(service_id);

-- payments.appointment_id
CREATE INDEX IF NOT EXISTS idx_payments_appointment ON payments(appointment_id);

-- reviews.doctor_id (patient_id & clinic_id already indexed)
CREATE INDEX IF NOT EXISTS idx_reviews_doctor ON reviews(doctor_id);

-- waiting_list.doctor_id & service_id
CREATE INDEX IF NOT EXISTS idx_waiting_list_doctor ON waiting_list(doctor_id);
CREATE INDEX IF NOT EXISTS idx_waiting_list_service ON waiting_list(service_id);

-- prescriptions.appointment_id & clinic_id
CREATE INDEX IF NOT EXISTS idx_prescriptions_appointment ON prescriptions(appointment_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_clinic ON prescriptions(clinic_id);

-- consultation_notes.appointment_id & clinic_id
CREATE INDEX IF NOT EXISTS idx_consultation_notes_appointment ON consultation_notes(appointment_id);
CREATE INDEX IF NOT EXISTS idx_consultation_notes_clinic ON consultation_notes(clinic_id);

-- odontogram.clinic_id
CREATE INDEX IF NOT EXISTS idx_odontogram_clinic ON odontogram(clinic_id);

-- treatment_plans.doctor_id & clinic_id
CREATE INDEX IF NOT EXISTS idx_treatment_plans_doctor ON treatment_plans(doctor_id);
CREATE INDEX IF NOT EXISTS idx_treatment_plans_clinic ON treatment_plans(clinic_id);

-- lab_orders.patient_id
CREATE INDEX IF NOT EXISTS idx_lab_orders_patient ON lab_orders(patient_id);

-- installments.clinic_id
CREATE INDEX IF NOT EXISTS idx_installments_clinic ON installments(clinic_id);

-- stock.supplier_id
CREATE INDEX IF NOT EXISTS idx_stock_supplier ON stock(supplier_id);

-- prescription_requests.patient_id (already exists)
-- loyalty_points — already indexed

-- ============================================================
-- 00005 tables (schema gaps)
-- ============================================================

-- blog_posts.author_id
CREATE INDEX IF NOT EXISTS idx_blog_posts_author ON blog_posts(author_id);

-- clinic_feature_overrides.feature_id
CREATE INDEX IF NOT EXISTS idx_clinic_feature_overrides_feature ON clinic_feature_overrides(feature_id);

-- subscriptions.tier_slug
-- (already indexed as idx_subscriptions_tier)

-- sales.patient_id (already indexed)

-- before_after_photos.treatment_plan_id (already indexed)

-- pain_questionnaires.appointment_id (already indexed)

-- loyalty_transactions.sale_id
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_sale ON loyalty_transactions(sale_id);

-- ============================================================
-- 00010 medical_features
-- ============================================================

-- medical_certificates.appointment_id
CREATE INDEX IF NOT EXISTS idx_medical_certificates_appointment ON medical_certificates(appointment_id);

-- ============================================================
-- 00011 specialty_modules
-- ============================================================

-- vaccinations.doctor_id
CREATE INDEX IF NOT EXISTS idx_vaccinations_doctor ON vaccinations(doctor_id);

-- developmental_milestones.doctor_id
CREATE INDEX IF NOT EXISTS idx_milestones_doctor ON developmental_milestones(doctor_id);

-- pregnancies — already have clinic, patient, doctor, status indexes

-- ultrasound_records.doctor_id
CREATE INDEX IF NOT EXISTS idx_ultrasound_doctor ON ultrasound_records(doctor_id);

-- ============================================================
-- 00012 specialist_features
-- ============================================================

-- skin_photos.doctor_id
CREATE INDEX IF NOT EXISTS idx_skin_photos_doctor ON skin_photos(doctor_id);

-- skin_conditions.doctor_id
CREATE INDEX IF NOT EXISTS idx_skin_conditions_doctor ON skin_conditions(doctor_id);

-- ecg_records.doctor_id
CREATE INDEX IF NOT EXISTS idx_ecg_records_doctor ON ecg_records(doctor_id);

-- blood_pressure_readings.doctor_id
CREATE INDEX IF NOT EXISTS idx_bp_readings_doctor ON blood_pressure_readings(doctor_id);

-- heart_monitoring_notes.doctor_id
CREATE INDEX IF NOT EXISTS idx_heart_notes_doctor ON heart_monitoring_notes(doctor_id);

-- hearing_tests.doctor_id
CREATE INDEX IF NOT EXISTS idx_hearing_tests_doctor ON hearing_tests(doctor_id);

-- ent_exam_records.doctor_id
CREATE INDEX IF NOT EXISTS idx_ent_exams_doctor ON ent_exam_records(doctor_id);

-- xray_records.doctor_id
CREATE INDEX IF NOT EXISTS idx_xray_records_doctor ON xray_records(doctor_id);

-- fracture_records.doctor_id & xray_record_id
CREATE INDEX IF NOT EXISTS idx_fracture_records_doctor ON fracture_records(doctor_id);
CREATE INDEX IF NOT EXISTS idx_fracture_records_xray ON fracture_records(xray_record_id);

-- rehab_plans.doctor_id
CREATE INDEX IF NOT EXISTS idx_rehab_plans_doctor ON rehab_plans(doctor_id);

-- psych_medications.doctor_id
CREATE INDEX IF NOT EXISTS idx_psych_meds_doctor ON psych_medications(doctor_id);

-- eeg_records.doctor_id
CREATE INDEX IF NOT EXISTS idx_eeg_records_doctor ON eeg_records(doctor_id);

-- neuro_exam_records.doctor_id
CREATE INDEX IF NOT EXISTS idx_neuro_exams_doctor ON neuro_exam_records(doctor_id);

-- urology_exams.patient_id & doctor_id
CREATE INDEX IF NOT EXISTS idx_urology_exams_patient ON urology_exams(patient_id);
CREATE INDEX IF NOT EXISTS idx_urology_exams_doctor ON urology_exams(doctor_id);

-- spirometry_records.patient_id & doctor_id
CREATE INDEX IF NOT EXISTS idx_spirometry_patient ON spirometry_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_spirometry_doctor ON spirometry_records(doctor_id);

-- respiratory_tests.patient_id & doctor_id
CREATE INDEX IF NOT EXISTS idx_respiratory_tests_patient ON respiratory_tests(patient_id);
CREATE INDEX IF NOT EXISTS idx_respiratory_tests_doctor ON respiratory_tests(doctor_id);

-- blood_sugar_readings.doctor_id
CREATE INDEX IF NOT EXISTS idx_blood_sugar_doctor ON blood_sugar_readings(doctor_id);

-- hormone_levels.doctor_id
CREATE INDEX IF NOT EXISTS idx_hormone_levels_doctor ON hormone_levels(doctor_id);

-- diabetes_management.doctor_id
CREATE INDEX IF NOT EXISTS idx_diabetes_mgmt_doctor ON diabetes_management(doctor_id);

-- joint_assessments.doctor_id
CREATE INDEX IF NOT EXISTS idx_joint_assessments_doctor ON joint_assessments(doctor_id);

-- mobility_tests.patient_id & doctor_id
CREATE INDEX IF NOT EXISTS idx_mobility_tests_patient ON mobility_tests(patient_id);
CREATE INDEX IF NOT EXISTS idx_mobility_tests_doctor ON mobility_tests(doctor_id);

-- ============================================================
-- 00013 para_medical_tables
-- ============================================================

-- exercise_programs: clinic_id, patient_id, therapist_id
CREATE INDEX IF NOT EXISTS idx_exercise_programs_clinic ON exercise_programs(clinic_id);
CREATE INDEX IF NOT EXISTS idx_exercise_programs_patient ON exercise_programs(patient_id);
CREATE INDEX IF NOT EXISTS idx_exercise_programs_therapist ON exercise_programs(therapist_id);

-- physio_sessions: clinic_id, patient_id, therapist_id, program_id
CREATE INDEX IF NOT EXISTS idx_physio_sessions_clinic ON physio_sessions(clinic_id);
CREATE INDEX IF NOT EXISTS idx_physio_sessions_patient ON physio_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_physio_sessions_therapist ON physio_sessions(therapist_id);
CREATE INDEX IF NOT EXISTS idx_physio_sessions_program ON physio_sessions(program_id);

-- progress_photos: clinic_id, patient_id
CREATE INDEX IF NOT EXISTS idx_progress_photos_clinic ON progress_photos(clinic_id);
CREATE INDEX IF NOT EXISTS idx_progress_photos_patient ON progress_photos(patient_id);

-- meal_plans: clinic_id, patient_id, nutritionist_id
CREATE INDEX IF NOT EXISTS idx_meal_plans_clinic ON meal_plans(clinic_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_patient ON meal_plans(patient_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_nutritionist ON meal_plans(nutritionist_id);

-- body_measurements: clinic_id, patient_id
CREATE INDEX IF NOT EXISTS idx_body_measurements_clinic ON body_measurements(clinic_id);
CREATE INDEX IF NOT EXISTS idx_body_measurements_patient ON body_measurements(patient_id);

-- therapy_session_notes: clinic_id, patient_id, therapist_id
CREATE INDEX IF NOT EXISTS idx_therapy_notes_clinic ON therapy_session_notes(clinic_id);
CREATE INDEX IF NOT EXISTS idx_therapy_notes_patient ON therapy_session_notes(patient_id);
CREATE INDEX IF NOT EXISTS idx_therapy_notes_therapist ON therapy_session_notes(therapist_id);

-- therapy_plans: clinic_id, patient_id, therapist_id
CREATE INDEX IF NOT EXISTS idx_therapy_plans_clinic ON therapy_plans(clinic_id);
CREATE INDEX IF NOT EXISTS idx_therapy_plans_patient ON therapy_plans(patient_id);
CREATE INDEX IF NOT EXISTS idx_therapy_plans_therapist ON therapy_plans(therapist_id);

-- speech_exercises: clinic_id
CREATE INDEX IF NOT EXISTS idx_speech_exercises_clinic ON speech_exercises(clinic_id);

-- speech_sessions: clinic_id, patient_id, therapist_id
CREATE INDEX IF NOT EXISTS idx_speech_sessions_clinic ON speech_sessions(clinic_id);
CREATE INDEX IF NOT EXISTS idx_speech_sessions_patient ON speech_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_speech_sessions_therapist ON speech_sessions(therapist_id);

-- speech_progress_reports: clinic_id, patient_id, therapist_id
CREATE INDEX IF NOT EXISTS idx_speech_reports_clinic ON speech_progress_reports(clinic_id);
CREATE INDEX IF NOT EXISTS idx_speech_reports_patient ON speech_progress_reports(patient_id);
CREATE INDEX IF NOT EXISTS idx_speech_reports_therapist ON speech_progress_reports(therapist_id);

-- lens_inventory: clinic_id
CREATE INDEX IF NOT EXISTS idx_lens_inventory_clinic ON lens_inventory(clinic_id);

-- frame_catalog: clinic_id
CREATE INDEX IF NOT EXISTS idx_frame_catalog_clinic ON frame_catalog(clinic_id);

-- optical_prescriptions: clinic_id, patient_id, frame_id
CREATE INDEX IF NOT EXISTS idx_optical_prescriptions_clinic ON optical_prescriptions(clinic_id);
CREATE INDEX IF NOT EXISTS idx_optical_prescriptions_patient ON optical_prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_optical_prescriptions_frame ON optical_prescriptions(frame_id);

-- ============================================================
-- 00014 diagnostic_pharmacy_equipment
-- ============================================================

-- lab_test_orders.ordering_doctor_id, assigned_technician_id, validated_by
CREATE INDEX IF NOT EXISTS idx_lab_test_orders_doctor ON lab_test_orders(ordering_doctor_id);
CREATE INDEX IF NOT EXISTS idx_lab_test_orders_technician ON lab_test_orders(assigned_technician_id);

-- lab_test_items.test_id
CREATE INDEX IF NOT EXISTS idx_lab_test_items_test ON lab_test_items(test_id);

-- lab_test_results.entered_by
CREATE INDEX IF NOT EXISTS idx_lab_test_results_entered_by ON lab_test_results(entered_by);

-- radiology_orders.ordering_doctor_id, radiologist_id
CREATE INDEX IF NOT EXISTS idx_radiology_orders_ordering_doctor ON radiology_orders(ordering_doctor_id);
CREATE INDEX IF NOT EXISTS idx_radiology_orders_radiologist ON radiology_orders(radiologist_id);

-- ============================================================
-- 00015 phase6_clinics_centers
-- ============================================================

-- departments.head_doctor_id
CREATE INDEX IF NOT EXISTS idx_departments_head_doctor ON departments(head_doctor_id);

-- doctor_departments.clinic_id
CREATE INDEX IF NOT EXISTS idx_doctor_departments_clinic ON doctor_departments(clinic_id);

-- rooms.department_id (already indexed)

-- beds.clinic_id, current_patient_id
CREATE INDEX IF NOT EXISTS idx_beds_clinic ON beds(clinic_id);
CREATE INDEX IF NOT EXISTS idx_beds_current_patient ON beds(current_patient_id);

-- admissions.bed_id, department_id, admitting_doctor_id, doctor_id
CREATE INDEX IF NOT EXISTS idx_admissions_bed ON admissions(bed_id);
CREATE INDEX IF NOT EXISTS idx_admissions_department ON admissions(department_id);
CREATE INDEX IF NOT EXISTS idx_admissions_doctor ON admissions(admitting_doctor_id);

-- patient_packages.package_id
CREATE INDEX IF NOT EXISTS idx_patient_packages_package ON patient_packages(package_id);

-- consultation_photos.doctor_id
CREATE INDEX IF NOT EXISTS idx_consultation_photos_doctor ON consultation_photos(doctor_id);

-- ivf_cycles.patient_id, doctor_id, partner_id, protocol_id
CREATE INDEX IF NOT EXISTS idx_ivf_cycles_patient ON ivf_cycles(patient_id);
CREATE INDEX IF NOT EXISTS idx_ivf_cycles_doctor ON ivf_cycles(doctor_id);

-- ivf_timeline_events.cycle_id
CREATE INDEX IF NOT EXISTS idx_ivf_timeline_cycle ON ivf_timeline_events(cycle_id);

-- dialysis_sessions.patient_id, doctor_id, machine_id
CREATE INDEX IF NOT EXISTS idx_dialysis_sessions_patient ON dialysis_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_dialysis_sessions_doctor ON dialysis_sessions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_dialysis_sessions_machine ON dialysis_sessions(machine_id);

-- ============================================================
-- 00016 custom_fields
-- ============================================================

-- custom_field_definitions.clinic_type_key
CREATE INDEX IF NOT EXISTS idx_custom_field_defs_type ON custom_field_definitions(clinic_type_key);

-- custom_field_values.clinic_id, entity_type, entity_id
CREATE INDEX IF NOT EXISTS idx_custom_field_values_clinic ON custom_field_values(clinic_id);
CREATE INDEX IF NOT EXISTS idx_custom_field_values_entity ON custom_field_values(entity_type, entity_id);

-- custom_field_overrides.clinic_id, field_definition_id
CREATE INDEX IF NOT EXISTS idx_custom_field_overrides_clinic ON custom_field_overrides(clinic_id);
CREATE INDEX IF NOT EXISTS idx_custom_field_overrides_field ON custom_field_overrides(field_definition_id);

-- ============================================================
-- 00017 lab_clinic_center_tables
-- ============================================================

-- prosthetic_orders.clinic_id, dentist_id
CREATE INDEX IF NOT EXISTS idx_prosthetic_orders_clinic ON prosthetic_orders(clinic_id);
CREATE INDEX IF NOT EXISTS idx_prosthetic_orders_dentist ON prosthetic_orders(dentist_id);

-- lab_materials.clinic_id
CREATE INDEX IF NOT EXISTS idx_lab_materials_clinic ON lab_materials(clinic_id);

-- lab_deliveries.clinic_id, order_id
CREATE INDEX IF NOT EXISTS idx_lab_deliveries_clinic ON lab_deliveries(clinic_id);
CREATE INDEX IF NOT EXISTS idx_lab_deliveries_order ON lab_deliveries(order_id);

-- lab_invoices.clinic_id, dentist_id
CREATE INDEX IF NOT EXISTS idx_lab_invoices_clinic ON lab_invoices(clinic_id);
CREATE INDEX IF NOT EXISTS idx_lab_invoices_dentist ON lab_invoices(dentist_id);

-- ============================================================
-- 00022 fix_schema_drift
-- ============================================================

-- clinic_api_keys.clinic_id (already indexed)
-- clinic_subscriptions.clinic_id (already indexed)
-- billing_events.clinic_id (already indexed)
-- beds.department_id & patient_id — covered above
