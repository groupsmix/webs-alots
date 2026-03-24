/**
 * Tenant Context Enforcement
 *
 * Sets `app.current_clinic_id` as a PostgreSQL session variable on every
 * Supabase client connection. This provides defense-in-depth alongside RLS
 * policies that check `get_user_clinic_id()`.
 *
 * WHY: Even if application-level filtering is accidentally omitted from a
 * query, the database-level session variable ensures RLS policies can
 * independently verify the intended tenant, preventing cross-tenant access.
 *
 * USAGE:
 *   const supabase = await createClient();
 *   await setTenantContext(supabase, clinicId);
 *   // All subsequent queries on this client are now scoped
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { logger } from "@/lib/logger";

/**
 * Validate that a clinic_id looks like a valid UUID.
 * Prevents SQL injection via malformed clinic_id values.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidClinicId(clinicId: string): boolean {
  return UUID_RE.test(clinicId);
}

/**
 * Set the tenant context on a Supabase client by setting the PostgreSQL
 * session variable `app.current_clinic_id`.
 *
 * This MUST be called before any tenant-scoped database operation.
 * RLS policies can then use `current_setting('app.current_clinic_id', true)`
 * as an additional isolation check.
 *
 * @throws Error if clinicId is missing or invalid
 */
export async function setTenantContext(
  supabase: SupabaseClient<Database>,
  clinicId: string,
): Promise<void> {
  if (!clinicId) {
    throw new Error("Tenant context error: clinic_id is required but was empty");
  }

  if (!isValidClinicId(clinicId)) {
    throw new Error(`Tenant context error: invalid clinic_id format: ${clinicId}`);
  }

  // Use rpc() with a type assertion because the set_tenant_context function
  // is added by migration 00030 and not yet in the generated Database types.
  // Once the migration is applied and types are regenerated, the assertion
  // can be removed.
  const { error } = await (supabase.rpc as CallableFunction)(
    "set_tenant_context",
    { p_clinic_id: clinicId },
  );

  if (error) {
    logger.error("Failed to set tenant context", {
      context: "tenant-context",
      clinicId,
      error,
    });
    const message = typeof error === "object" && error !== null && "message" in error
      ? (error as { message: string }).message
      : String(error);
    throw new Error(`Tenant context error: failed to set app.current_clinic_id: ${message}`);
  }
}

/**
 * Assert that a tenant context exists and is valid.
 * Call this before any database operation that requires tenant isolation.
 *
 * @param clinicId - The clinic_id to validate
 * @param operation - Description of the operation (for error messages)
 * @throws Error if clinicId is missing or invalid
 */
export function assertTenantContext(
  clinicId: string | null | undefined,
  operation: string,
): asserts clinicId is string {
  if (!clinicId) {
    throw new Error(
      `Tenant assertion failed: clinic_id is required for ${operation} but was ${clinicId === null ? "null" : "undefined"}`,
    );
  }

  if (!isValidClinicId(clinicId)) {
    throw new Error(
      `Tenant assertion failed: invalid clinic_id format for ${operation}: ${clinicId}`,
    );
  }
}

/**
 * Log tenant context for audit trail.
 * Call this at the entry point of every request handler.
 */
export function logTenantContext(
  clinicId: string | null | undefined,
  context: string,
  extra?: Record<string, unknown>,
): void {
  logger.info("Tenant context resolved", {
    context,
    clinicId: clinicId ?? "none",
    ...extra,
  });
}
