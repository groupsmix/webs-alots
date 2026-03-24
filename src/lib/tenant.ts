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
 * Get the current tenant or throw if not resolved.
 *
 * Use this in API routes and server functions where a tenant is REQUIRED.
 * Throws a descriptive error if the tenant could not be resolved from
 * the request context (e.g. missing subdomain).
 */
export async function requireTenant(): Promise<TenantInfo> {
  const tenant = await getTenant();
  if (!tenant?.clinicId) {
    throw new Error(
      "Tenant resolution failed: no clinic_id in request context. " +
      "Ensure the request is routed through a valid tenant subdomain.",
    );
  }
  return tenant;
}

/**
 * Resolve the clinic_id for the current request.
 *
 * For authenticated API routes that receive an AuthContext from withAuth(),
 * prefer using the profile's clinic_id (which comes from the user's DB record).
 * Falls back to the tenant header resolved by middleware.
 *
 * @param profileClinicId - The clinic_id from the authenticated user's profile (may be null for super_admin).
 * @returns The resolved clinic_id string.
 * @throws Error if neither source provides a clinic_id.
 */
export async function resolveClinicId(profileClinicId?: string | null): Promise<string> {
  if (profileClinicId) return profileClinicId;
  const tenant = await getTenant();
  if (tenant?.clinicId) return tenant.clinicId;
  throw new Error(
    "Tenant resolution failed: no clinic_id from user profile or request headers.",
  );
}
