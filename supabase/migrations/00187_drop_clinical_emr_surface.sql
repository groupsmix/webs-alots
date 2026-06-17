-- Migration 00187: Drop the clinical / EMR surface.
--
-- CONTEXT
--   Oltigo is a multi-tenant clinic OPERATIONS platform: scheduling,
--   reminders, payments, WhatsApp, owner analytics. It is NOT an EMR and must
--   not store or process clinical / medical-record data (diagnoses,
--   prescriptions, lab results, drug-interaction checks, clinical encounter
--   notes, telemedicine content).
--
--   We are PRE-LAUNCH. There is no real patient data in any environment, so a
--   destructive drop is safe and intentional — this migration permanently
--   removes the EMR tables that earlier batches introduced.
--
-- DECISION RULE (per-table)
--   REMOVE  -> stores/processes a diagnosis, prescription, lab result, drug
--              interaction, clinical note/encounter, vitals, or telemedicine
--              content.
--   KEEP    -> appointments, reminders, billing/payments, patient CONTACT
--              info (name/phone/email), staff, operational analytics.
--
-- SCOPE (exactly the 13 tables below — nothing else is touched)
--   clinical_encounters, encounter_addenda      (clinical encounter notes)
--   cdss_override_log                           (clinical decision support)
--   drug_interactions, drug_interaction_alerts  (drug-interaction checks)
--   lab_results, lab_test_orders, lab_tests     (laboratory / diagnostics)
--   prescription_drafts,
--   prescription_renewal_requests,
--   prescription_renewals                       (prescription workflow)
--   telemedicine_sessions                       (telemedicine content)
--
--   This migration intentionally does NOT touch appointments, clinics, users,
--   patients (contact), invoices/billing, or notification_queue.
--
-- SAFETY / IDEMPOTENCY
--   Every statement uses IF EXISTS and CASCADE so the migration is safe to
--   re-run and applies cleanly on a fresh `supabase db reset`. CASCADE removes
--   the dependent policies, triggers, indexes, FK constraints and views that
--   belong to or reference only these tables.
--
-- Companion pgTAP test: supabase/tests/drop_clinical_emr_surface.test.sql

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Preserve the operational patient timeline.
--
--    The `patient_timeline_events` view (migration 00113) unions several event
--    sources, one of which is `lab_results`. Dropping lab_results with CASCADE
--    would otherwise drop this view and break the (kept) operational timeline
--    used by dashboards. Redefine it FIRST without the lab_results branch so it
--    no longer depends on any table dropped below. All other branches
--    (appointments, prescriptions, radiology_orders, payments,
--    consultation_notes, notification_log) are operational and remain.
--
--    Column shape is unchanged (id, clinic_id, patient_id, event_type,
--    event_date, metadata, created_at), so CREATE OR REPLACE VIEW is valid.
-- ---------------------------------------------------------------------------
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

-- Prescriptions (base prescriptions table is retained)
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

-- ---------------------------------------------------------------------------
-- 2. Drop the dedicated trigger function for clinical encounters.
--
--    `prevent_signed_encounter_edit()` (migration 00116) exists solely to guard
--    edits to signed rows in clinical_encounters. Its trigger is removed by the
--    CASCADE below, but the function itself must be dropped explicitly because
--    it does not have a hard dependency on the table.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS prevent_signed_encounter_edit() CASCADE;

-- ---------------------------------------------------------------------------
-- 3. Drop the clinical / EMR tables (CASCADE).
--
--    Order is child-before-parent for readability; with IF EXISTS + CASCADE the
--    order is not load-bearing. CASCADE also removes the RLS policies, triggers,
--    indexes and FK constraints owned by or referencing only these tables.
-- ---------------------------------------------------------------------------

-- Drug-interaction checks (clinical decision support)
DROP TABLE IF EXISTS drug_interaction_alerts CASCADE;
DROP TABLE IF EXISTS drug_interactions CASCADE;
DROP TABLE IF EXISTS cdss_override_log CASCADE;

-- Laboratory / diagnostics
DROP TABLE IF EXISTS lab_results CASCADE;
DROP TABLE IF EXISTS lab_test_orders CASCADE;
DROP TABLE IF EXISTS lab_tests CASCADE;

-- Prescription workflow (drafts + renewals)
DROP TABLE IF EXISTS prescription_drafts CASCADE;
DROP TABLE IF EXISTS prescription_renewal_requests CASCADE;
DROP TABLE IF EXISTS prescription_renewals CASCADE;

-- Clinical encounter notes
DROP TABLE IF EXISTS encounter_addenda CASCADE;
DROP TABLE IF EXISTS clinical_encounters CASCADE;

-- Telemedicine content
DROP TABLE IF EXISTS telemedicine_sessions CASCADE;

COMMIT;
