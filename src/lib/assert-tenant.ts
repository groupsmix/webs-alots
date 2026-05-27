/**
 * Global Tenant Assertion Layer
 *
 * Provides assertion functions that MUST be called before any database
 * operation requiring tenant isolation. These act as a final safety net
 * to ensure no cross-tenant data access is possible.
 *
 * Usage:
 *   import { assertClinicId, assertTenantMatch } from "@/lib/assert-tenant";
 *
 *   // Before any DB operation:
 *   assertClinicId(clinicId, "appointments.insert");
 *
 *   // Before cross-referencing entities:
 *   assertTenantMatch(doctor.clinic_id, clinicId, "doctor", "appointment");
 */

import { isValidClinicId } from "@/lib/tenant-context";

/**
 * Assert that a clinic_id is present and valid before a database operation.
 *
 * @param clinicId - The clinic_id to validate
 * @param operation - Description of the DB operation (for error messages)
 * @throws Error if clinicId is missing, empty, or not a valid UUID
 */
export function assertClinicId(
  clinicId: string | null | undefined,
  operation: string,
): asserts clinicId is string {
  if (!clinicId) {
    throw new Error(
      `[TENANT SAFETY] clinic_id is required for "${operation}" but was ${clinicId === null ? "null" : "undefined"}. Aborting to prevent cross-tenant access.`,
    );
  }

  if (!isValidClinicId(clinicId)) {
    throw new Error(
      `[TENANT SAFETY] Invalid clinic_id format for "${operation}": "${clinicId}". Aborting to prevent cross-tenant access.`,
    );
  }
}

/**
 * Assert that two clinic_id values match, ensuring an entity belongs
 * to the expected tenant before performing a cross-reference operation.
 *
 * @param entityClinicId - The clinic_id from the entity being referenced
 * @param expectedClinicId - The expected clinic_id from the current tenant context
 * @param entityType - Type of entity being referenced (for error messages)
 * @param operation - Description of the operation (for error messages)
 * @throws Error if the clinic_ids do not match
 */
export function assertTenantMatch(
  entityClinicId: string | null | undefined,
  expectedClinicId: string,
  entityType: string,
  operation: string,
): void {
  if (!entityClinicId) {
    throw new Error(
      `[TENANT SAFETY] ${entityType} has no clinic_id during "${operation}". Aborting to prevent cross-tenant access.`,
    );
  }

  if (entityClinicId !== expectedClinicId) {
    throw new Error(
      `[TENANT SAFETY] ${entityType} belongs to clinic "${entityClinicId}" but operation "${operation}" is for clinic "${expectedClinicId}". Cross-tenant access blocked.`,
    );
  }
}

/**
 * A27-01: Apply the soft-delete filter to a Supabase query builder.
 *
 * Tables with a `deleted_at` column (currently only `clinics`) must
 * always filter out soft-deleted rows unless explicitly querying
 * deleted records (e.g. for admin recovery). Call this on every
 * query builder that reads from a soft-delete table.
 *
 * @example
 *   const q = supabase.from("clinics").select("*").eq("status", "active");
 *   const { data } = await excludeSoftDeleted(q);
 */
function excludeSoftDeleted<
  Q extends { is: (column: string, value: null) => Q },
>(query: Q): Q {
  return query.is("deleted_at", null);
}

/**
 * AZ-001 / IDOR-001: Enforce tenant scope on a database row after fetch.
 *
 * Use this as a post-query guard when you need to verify that a fetched
 * row actually belongs to the current tenant. Throws if the row's
 * `clinic_id` does not match the expected value.
 *
 * @returns The row unchanged (for chaining)
 * @throws Error if row.clinic_id !== expectedClinicId
 */
function enforceTenantScope<T extends { clinic_id: string }>(
  row: T,
  expectedClinicId: string,
  entityType: string,
): T {
  if (row.clinic_id !== expectedClinicId) {
    throw new Error(
      `[TENANT SAFETY] ${entityType} row belongs to clinic "${row.clinic_id}" but current tenant is "${expectedClinicId}". IDOR blocked.`,
    );
  }
  return row;
}
