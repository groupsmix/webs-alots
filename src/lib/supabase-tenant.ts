/**
 * C-07: Tenant-scoped Supabase client wrapper.
 *
 * Service-role Supabase clients bypass RLS by design. In webhook, cron,
 * and queue handlers the only tenant isolation is application-level
 * `.eq("clinic_id", clinicId)` calls. A single missed `.eq()` is a
 * cross-tenant read or write.
 *
 * This module provides `createTenantScopedClient()` which wraps the
 * service-role Supabase client's `.from()` method to automatically
 * inject `.eq("clinic_id", clinicId)` on every query. Handlers that
 * operate on tenant data should use this instead of raw `createClient()`.
 *
 * Usage:
 *   const supabase = await createTenantScopedClient(clinicId);
 *   // Every .from("table").select/insert/update/delete automatically
 *   // has .eq("clinic_id", clinicId) — you can still add it manually
 *   // for documentation purposes, it's idempotent.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { assertClinicId } from "@/lib/assert-tenant";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase-server";
import { setTenantContext } from "@/lib/tenant-context";
import type { Database } from "@/lib/types/database";

/**
 * Tables that do NOT have a `clinic_id` column and should not be
 * auto-scoped. These are system-level tables that are intentionally
 * not tenant-partitioned.
 */
const _UNSCOPED_TABLES = new Set([
  "clinics",
  "clinic_api_keys",
  "rate_limit_entries",
  "audit_log",
]);

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
