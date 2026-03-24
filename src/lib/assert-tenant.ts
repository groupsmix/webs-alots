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
