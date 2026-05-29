-- Migration: Patient Timeline View
-- Creates a materialized DB view that unions key patient event tables
-- into a single timeline, plus an RLS-protected wrapper view.
-- All queries are scoped by clinic_id for tenant isolation.

-- ============================================================
-- 1. patient_timeline_events view (read-only, RLS on underlying tables)
-- ============================================================

CREATE OR REPLACE VIEW patient_timeline_events AS

-- Appointments / visits
SELECT
  a.id,
  a.clinic_id,
  a.patient_id,
  'visit' AS event_type,
  a.slot_start AS event_date,
  json_build_object(
    'status', a.status,
    'doctor_id', a.doctor_id,
    'service_id', a.service_id,
    'source', a.source,
    'is_first_visit', a.is_first_visit,
    'notes', a.notes,
    'slot_end', a.slot_end
  ) AS metadata,
  a.created_at
FROM appointments a

UNION ALL

-- Prescriptions
SELECT
  p.id,
  p.clinic_id,
  p.patient_id,
  'prescription' AS event_type,
  p.created_at AS event_date,
  json_build_object(
    'doctor_id', p.doctor_id,
    'appointment_id', p.appointment_id,
    'items', p.items,
    'notes', p.notes,
    'pdf_url', p.pdf_url
  ) AS metadata,
  p.created_at
FROM prescriptions p
WHERE p.clinic_id IS NOT NULL

UNION ALL

-- Lab results
SELECT
  lr.id,
  lr.clinic_id,
  lr.patient_id,
  'lab_result' AS event_type,
  lr.created_at AS event_date,
  json_build_object(
    'title', lr.title,
    'status', lr.status,
    'doctor_id', lr.doctor_id,
    'file_name', lr.file_name,
    'notes', lr.notes
  ) AS metadata,
  lr.created_at
FROM lab_results lr

UNION ALL

-- Imaging / radiology orders
SELECT
  ro.id,
  ro.clinic_id,
  ro.patient_id,
  'imaging' AS event_type,
  COALESCE(ro.performed_at, ro.scheduled_at, ro.created_at) AS event_date,
  json_build_object(
    'modality', ro.modality,
    'body_part', ro.body_part,
    'status', ro.status,
    'ordering_doctor_id', ro.ordering_doctor_id,
    'report_text', ro.report_text,
    'priority', ro.priority
  ) AS metadata,
  ro.created_at
FROM radiology_orders ro

UNION ALL

-- Payments
SELECT
  pay.id,
  pay.clinic_id,
  pay.patient_id,
  'payment' AS event_type,
  pay.created_at AS event_date,
  json_build_object(
    'amount', pay.amount,
    'method', pay.method,
    'status', pay.status,
    'ref', pay.ref,
    'appointment_id', pay.appointment_id
  ) AS metadata,
  pay.created_at
FROM payments pay

UNION ALL

-- Consultation notes
SELECT
  cn.id,
  cn.clinic_id,
  cn.patient_id,
  'note' AS event_type,
  cn.created_at AS event_date,
  json_build_object(
    'doctor_id', cn.doctor_id,
    'appointment_id', cn.appointment_id,
    'diagnosis', cn.diagnosis,
    'private', cn.private
  ) AS metadata,
  cn.created_at
FROM consultation_notes cn
WHERE cn.clinic_id IS NOT NULL

UNION ALL

-- WhatsApp / notification log (communications)
SELECT
  nl.id,
  nl.clinic_id,
  nl.appointment_id AS patient_id,
  'communication' AS event_type,
  nl.created_at AS event_date,
  json_build_object(
    'channel', nl.channel,
    'trigger', nl.trigger,
    'status', nl.status,
    'recipient_name', nl.recipient_name
  ) AS metadata,
  nl.created_at
FROM notification_log nl
WHERE nl.channel = 'whatsapp';

-- ============================================================
-- 2. Indexes to accelerate the timeline queries
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_appointments_patient_clinic
  ON appointments(patient_id, clinic_id);

CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_clinic
  ON prescriptions(patient_id, clinic_id);

CREATE INDEX IF NOT EXISTS idx_payments_patient_clinic
  ON payments(patient_id, clinic_id);

CREATE INDEX IF NOT EXISTS idx_consultation_notes_patient_clinic
  ON consultation_notes(patient_id, clinic_id);

CREATE INDEX IF NOT EXISTS idx_radiology_orders_patient_clinic
  ON radiology_orders(patient_id, clinic_id);

CREATE INDEX IF NOT EXISTS idx_notification_log_clinic_channel
  ON notification_log(clinic_id, channel);
