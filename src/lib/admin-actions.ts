/**
 * Clinic-Admin Supabase actions — the write layer for the `(admin)` dashboard.
 *
 * This module re-exports the domain-specific actions from `src/lib/admin/*`.
 *
 * SECURITY MODEL — every exported function:
 *   1. Calls `requireRole("clinic_admin", "super_admin")` to authenticate.
 *   2. Derives `clinic_id` from the authenticated profile. The browser never
 *      supplies a clinic id for writes, so a caller cannot reach another tenant.
 *   3. Adds an explicit `.eq("clinic_id", clinicId)` as defence-in-depth on top
 *      of the `admin_users_all` / `admin_services_all` RLS policies.
 */

export * from "./admin/base";
export * from "./admin/user-actions";
export * from "./admin/service-actions";
export * from "./admin/department-actions";
export * from "./admin/dialysis-actions";
export * from "./admin/lab-actions";
