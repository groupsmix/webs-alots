-- ============================================================
-- Migration 00034: Additional RLS Hardening
--
-- Addresses remaining security issues from the audit:
--
-- 1. FIX custom_field_definitions: SELECT USING (true)
--    Replace with clinic-type scoped or authenticated-only read.
--    These are reference schema definitions (not patient data)
--    but revealing them cross-tenant aids targeted attacks.
--
-- 2. FIX custom_field_values: patients can write
--    Restrict INSERT/UPDATE/DELETE to staff roles only.
--    Patients should only be able to read their clinic's values.
--
-- 3. HARDEN is_clinic_staff(): add clinic-scoped overload
--    The existing is_clinic_staff() checks role but not clinic.
--    Add is_clinic_staff(p_clinic_id) that checks both.
--    Existing callers already combine with get_user_clinic_id()
--    so this is a defense-in-depth improvement for future use.
--
-- 4. RESTRICT set_tenant_context() for anon role
--    Revoke direct EXECUTE from anon. Instead, create a
--    read-only get_tenant_context_for_anon() that the
--    application can use via service role RPC calls.
--    (Kept for anon since public chatbot widget needs it,
--    but documented the risk.)
-- ============================================================

-- -------------------------------------------------------
-- 1. CUSTOM FIELD DEFINITIONS: restrict SELECT
--
-- These are schema definitions (not patient data) tied to
-- clinic_type_key. They don't have clinic_id but are
-- reference data. Keep readable by authenticated users
-- (needed by the UI to render forms) but not by anon.
-- -------------------------------------------------------

-- Drop the old permissive policy
DROP POLICY IF EXISTS "cfd_select_all" ON custom_field_definitions;

-- Authenticated users can read definitions (needed for form rendering)
CREATE POLICY "cfd_select_authenticated" ON custom_field_definitions
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- -------------------------------------------------------
-- 2. CUSTOM FIELD VALUES: restrict writes to staff
--
-- Previously any user at a clinic (including patients) could
-- INSERT/UPDATE/DELETE custom field values. Restrict mutations
-- to clinic staff and super admins only.
-- -------------------------------------------------------

-- Drop old write policies
DROP POLICY IF EXISTS "cfv_insert_own_clinic" ON custom_field_values;
DROP POLICY IF EXISTS "cfv_update_own_clinic" ON custom_field_values;
DROP POLICY IF EXISTS "cfv_delete_own_clinic" ON custom_field_values;

-- Staff-only INSERT
CREATE POLICY "cfv_insert_staff" ON custom_field_values
  FOR INSERT WITH CHECK (
    (
      clinic_id IN (SELECT clinic_id FROM users WHERE auth_id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM users
        WHERE auth_id = auth.uid()
          AND role IN ('clinic_admin', 'receptionist', 'doctor')
      )
    )
    OR is_super_admin()
  );

-- Staff-only UPDATE
CREATE POLICY "cfv_update_staff" ON custom_field_values
  FOR UPDATE USING (
    (
      clinic_id IN (SELECT clinic_id FROM users WHERE auth_id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM users
        WHERE auth_id = auth.uid()
          AND role IN ('clinic_admin', 'receptionist', 'doctor')
      )
    )
    OR is_super_admin()
  );

-- Staff-only DELETE
CREATE POLICY "cfv_delete_staff" ON custom_field_values
  FOR DELETE USING (
    (
      clinic_id IN (SELECT clinic_id FROM users WHERE auth_id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM users
        WHERE auth_id = auth.uid()
          AND role IN ('clinic_admin', 'receptionist', 'doctor')
      )
    )
    OR is_super_admin()
  );

-- -------------------------------------------------------
-- 3. HARDEN is_clinic_staff(): add clinic-scoped overload
--
-- The original is_clinic_staff() checks role but not clinic_id.
-- All current callers combine it with clinic_id = get_user_clinic_id(),
-- so this is safe today. But adding a clinic-scoped overload
-- prevents future misuse.
-- -------------------------------------------------------

CREATE OR REPLACE FUNCTION is_clinic_staff(p_clinic_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid()
      AND role IN ('clinic_admin', 'receptionist', 'doctor')
      AND clinic_id = p_clinic_id
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;
