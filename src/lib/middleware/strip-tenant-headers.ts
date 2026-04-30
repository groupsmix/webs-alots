/**
 * Shared utility for stripping tenant headers from incoming requests.
 *
 * Extracted from middleware.ts so both the production middleware and tests
 * can reference the same logic, preventing drift between the two (see
 * mutation-testing gap #4 / csrf-options-header-strip.test.ts).
 */

import { TENANT_HEADERS } from "@/lib/tenant";

/**
 * Remove all tenant-controlled headers from an incoming request.
 *
 * Tenant context MUST only come from subdomain resolution (server-side).
 * Without this, an attacker could inject `x-tenant-clinic-id` (or any
 * `x-tenant-*` header) on a root-domain request and impersonate another
 * tenant on public endpoints like /api/booking and /api/branding.
 */
export function stripTenantHeaders(requestHeaders: Headers): void {
  for (const key of Object.values(TENANT_HEADERS)) {
    requestHeaders.delete(key);
  }
  // RLS-05: Also strip the legacy x-clinic-id header used by tenant-scoped
  // Supabase clients (createTenantClient). An attacker could inject this
  // header to bypass RLS policies that read `request.headers->>'x-clinic-id'`.
  requestHeaders.delete("x-clinic-id");
}
