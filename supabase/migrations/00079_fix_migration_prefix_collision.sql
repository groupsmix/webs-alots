-- =============================================================================
-- Migration 00079: A19-04 — Fix duplicate migration prefix 00072
-- =============================================================================
--
-- Finding A19-04: Two migration files shared the prefix 00072:
--   - 00072_appointments_slot_well_ordered.sql (legitimate slot CHECK constraint)
--   - 00072_notifications_clinic_id.sql        (notifications tenant isolation)
--
-- Most migration runners apply files in lexicographic order. When two files
-- share the same numeric prefix, execution order is file-name-dependent and
-- differs across OSes (case sensitivity). This can lead to:
--   1. Silent out-of-order application on some systems.
--   2. Errors on migration runners that enforce unique prefixes.
--   3. Confusion in audit trails and rollback procedures.
--
-- Resolution:
--   - 00072_notifications_clinic_id.sql has been renamed to
--     00078_notifications_clinic_id.sql (already applied).
--   - This migration is a no-op SQL guard confirming the notifications
--     table clinic_id column and RLS policy are present (idempotent).
--   - If the original 00072_notifications_clinic_id was never applied
--     (e.g. it was skipped because of the prefix collision), this
--     migration ensures the notifications table is correctly configured.
-- =============================================================================

-- Guard: Ensure clinic_id column exists on notifications (idempotent)
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE;

-- Guard: Ensure the index exists
CREATE INDEX IF NOT EXISTS idx_notifications_clinic_id
  ON notifications(clinic_id);

-- Guard: Enable RLS (safe to run if already enabled)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Guard: Ensure the RLS policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications' AND policyname = 'notifications_tenant_isolation'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY notifications_tenant_isolation ON notifications
        FOR ALL
        USING (
          clinic_id = COALESCE(
            current_setting('app.current_clinic_id', true)::uuid,
            (SELECT clinic_id FROM users WHERE auth_id = auth.uid())
          )
        )
    $policy$;
  END IF;
END $$;
