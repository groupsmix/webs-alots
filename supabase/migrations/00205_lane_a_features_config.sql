-- Lane A feature flag reset.
--
-- All clinic types now start from the operational (Lane A) defaults defined in
-- src/lib/features.ts: scheduling, reminders, billing, managed website and
-- WhatsApp are enabled; clinical/PHI modules (radiology, prescriptions, patient
-- documents, vitals, insurance claims, patient timeline/export) are OFF.
--
-- The application merges this JSON with DEFAULT_FEATURES, so an empty object
-- means the canonical code defaults are used. Per-type clinical feature toggles
-- can be re-enabled later once CNDP / Loi 09-08 compliance and a DPA are in
-- place.
UPDATE clinic_types
SET features_config = '{}'::jsonb;
