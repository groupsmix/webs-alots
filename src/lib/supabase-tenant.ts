/**
 * C-07: Tenant-context Supabase client wrapper.
 *
 * Service-role Supabase clients bypass RLS by design. In webhook, cron,
 * and queue handlers the only tenant isolation is application-level
 * `.eq("clinic_id", clinicId)` calls. A single missed `.eq()` is a
 * cross-tenant read or write.
 *
 * This module provides `createTenantScopedClient()` which creates a
 * service-role Supabase client with the Postgres session variable
 * `app.current_clinic_id` set for defense-in-depth. RLS policies that
 * reference this variable get an additional isolation layer.
 *
 * IMPORTANT (AUDIT-07): This wrapper does NOT auto-inject
 * `.eq("clinic_id", clinicId)` on queries. Callers MUST still add
 * `.eq("clinic_id", clinicId)` to every `.from("table")` call
 * themselves. The Postgres session variable is defense-in-depth only;
 * application-level scoping is the primary control.
 *
 * Usage:
 *   const { client, clinicId } = await createTenantScopedClient(clinicId);
 *   // You MUST add .eq("clinic_id", clinicId) to every query:
 *   const { data } = await client
 *     .from("appointments")
 *     .select("*")
 *     .eq("clinic_id", clinicId);  // <-- REQUIRED
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { assertClinicId } from "@/lib/assert-tenant";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase-server";
import { setTenantContext } from "@/lib/tenant-context";
import type { Database } from "@/lib/types/database";

// AUDIT-07: Removed unused _UNSCOPED_TABLES set. The previous doc comment
// implied automatic .eq("clinic_id") injection which is not implemented.
// These tables are documented here for reference only:
//   - clinics, clinic_api_keys, rate_limit_entries, audit_log
// do NOT have per-tenant clinic_id scoping.

export interface TenantScopedClient {
  /** The underlying Supabase client (with tenant context set) */
  client: SupabaseClient<Database>;
  /** The clinic_id this client is scoped to */
  clinicId: string;
}

/**
 * Create a Supabase client that is scoped to a specific clinic.
 *
 * - Validates the clinic_id format (UUID assertion)
 * - Sets the Postgres session variable `app.current_clinic_id` for
 *   defense-in-depth (even though service-role bypasses RLS)
 * - Logs the tenant context for audit trail
 *
 * @param clinicId - UUID of the clinic to scope to
 * @param context - Descriptive label for logging (e.g. "webhooks/whatsapp")
 */
export async function createTenantScopedClient(
  clinicId: string,
  context: string = "tenant-scoped-client",
): Promise<TenantScopedClient> {
  assertClinicId(clinicId, `${context}.createTenantScopedClient`);

  const client = await createClient();

  try {
    await setTenantContext(client, clinicId);
  } catch (err) {
    logger.error("Failed to set tenant context on scoped client", {
      context,
      clinicId,
      error: err,
    });
    throw err;
  }

  logger.debug("Created tenant-scoped Supabase client", {
    context,
    clinicId,
  });

  return { client, clinicId };
}

/**
 * Helper to verify that a query result's clinic_id matches the expected
 * tenant. Use this as a post-query assertion for defense-in-depth.
 *
 * @throws Error if a row's clinic_id doesn't match
 */
export function assertTenantMatch(
  rows: Array<{ clinic_id?: string | null }>,
  expectedClinicId: string,
  context: string,
): void {
  for (const row of rows) {
    if (row.clinic_id && row.clinic_id !== expectedClinicId) {
      const message = `[TENANT VIOLATION] Row clinic_id ${row.clinic_id} does not match expected ${expectedClinicId}`;
      logger.error(message, { context, expectedClinicId, actualClinicId: row.clinic_id });
      throw new Error(message);
    }
  }
}
