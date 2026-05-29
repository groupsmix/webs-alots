-- =============================================================================
-- Migration 00099: Add covering indexes for unindexed foreign-key columns
--
-- AUDIT FINDING (Performance / migration hygiene):
-- A static scan of all migrations found 13 foreign-key columns with no
-- supporting index. In PostgreSQL an unindexed FK column forces a sequential
-- scan of the child table whenever a referenced parent row is updated/deleted
-- (ON DELETE CASCADE / SET NULL) and slows every join/filter on that column.
-- All other FK columns in the schema are already indexed; these were missed.
--
-- Idempotent: every statement uses CREATE INDEX IF NOT EXISTS, so re-running
-- (or running against a DB where an index was added out of band) is a no-op.
-- No RLS / data changes — purely additive performance indexes.
-- =============================================================================

BEGIN;

-- Clinical tables ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_admissions_doctor_id
  ON admissions (doctor_id);

CREATE INDEX IF NOT EXISTS idx_beds_department_id
  ON beds (department_id);

CREATE INDEX IF NOT EXISTS idx_beds_patient_id
  ON beds (patient_id);

CREATE INDEX IF NOT EXISTS idx_ivf_cycles_partner_id
  ON ivf_cycles (partner_id);

CREATE INDEX IF NOT EXISTS idx_ivf_timeline_events_clinic_id
  ON ivf_timeline_events (clinic_id);

CREATE INDEX IF NOT EXISTS idx_lab_test_orders_doctor_id
  ON lab_test_orders (doctor_id);

CREATE INDEX IF NOT EXISTS idx_lab_test_orders_validated_by
  ON lab_test_orders (validated_by);

CREATE INDEX IF NOT EXISTS idx_patient_feedback_doctor_id
  ON patient_feedback (doctor_id);

CREATE INDEX IF NOT EXISTS idx_radiology_images_uploaded_by
  ON radiology_images (uploaded_by);

-- Inventory / catalog --------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_parapharmacy_categories_parent_id
  ON parapharmacy_categories (parent_id);

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_product_id
  ON purchase_order_items (product_id);

-- Webhook idempotency tables (FK to clinics, ON DELETE CASCADE/SET NULL) ------
CREATE INDEX IF NOT EXISTS idx_processed_stripe_events_clinic_id
  ON processed_stripe_events (clinic_id);

CREATE INDEX IF NOT EXISTS idx_processed_whatsapp_messages_clinic_id
  ON processed_whatsapp_messages (clinic_id);

COMMIT;
