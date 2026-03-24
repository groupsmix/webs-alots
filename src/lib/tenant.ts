/**
 * Server-side tenant resolution.
 *
 * In middleware, the resolved clinic is stored in request headers.
 * Server Components and API routes read it from headers().
 */

import { headers } from "next/headers";

/** Minimal tenant info passed via request headers from middleware. */
export interface TenantInfo {
  clinicId: string;
  clinicName: string;
  subdomain: string;
  clinicType: string;
  clinicTier: string;
}

/** Header names used to pass tenant info from middleware. */
export const TENANT_HEADERS = {
  clinicId: "x-tenant-clinic-id",
  clinicName: "x-tenant-clinic-name",
  subdomain: "x-tenant-subdomain",
  clinicType: "x-tenant-clinic-type",
  clinicTier: "x-tenant-clinic-tier",
} as const;

/**
 * Get the current tenant from request headers (set by middleware).
 * Returns null if no subdomain was resolved (i.e., root domain / super-admin).
 *
 * Use in Server Components and API routes.
 */
export async function getTenant(): Promise<TenantInfo | null> {
  const h = await headers();
  const clinicId = h.get(TENANT_HEADERS.clinicId);

  if (!clinicId) return null;

  return {
    clinicId,
    clinicName: h.get(TENANT_HEADERS.clinicName) ?? "",
    subdomain: h.get(TENANT_HEADERS.subdomain) ?? "",
    clinicType: h.get(TENANT_HEADERS.clinicType) ?? "",
    clinicTier: h.get(TENANT_HEADERS.clinicTier) ?? "",
  };
}

/**
 * Get the current tenant or throw an error if not resolved.
 *
 * Use in API routes and server-side logic where tenant context
 * is mandatory. Prevents execution without tenant isolation.
 */
export async function requireTenant(): Promise<TenantInfo> {
  const tenant = await getTenant();
  if (!tenant?.clinicId) {
    throw new Error("Tenant context is required but was not resolved. Ensure the request includes a valid subdomain.");
  }
  return tenant;
}
