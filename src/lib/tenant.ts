/**
 * Server-side tenant resolution.
 *
 * In middleware, the resolved clinic is stored in request headers.
 * Server Components and API routes read it from headers().
 *
 * IMPORTANT: All tenant-specific data (clinic_id, timezone, booking config,
 * working hours, currency) MUST come from request context or DB — never
 * from the static clinicConfig file.
 */

import { headers } from "next/headers";
import { clinicConfig } from "@/config/clinic.config";
import { logTenantContext } from "@/lib/tenant-context";
import { DEFAULT_TIMEZONE } from "@/lib/constants";

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
  logTenantContext(tenant.clinicId, "requireTenant");
  return tenant;
}

// ── Tenant-specific clinic configuration ──────────────────────────────

/**
 * Per-tenant booking configuration resolved from the clinics table `config`
 * JSONB column, with fallbacks to static clinicConfig defaults.
 */
export interface TenantClinicConfig {
  timezone: string;
  currency: string;
  workingHours: Record<number, { open: string; close: string; enabled: boolean }>;
  booking: {
    slotDuration: number;
    bufferTime: number;
    maxAdvanceDays: number;
    maxPerSlot: number;
    cancellationHours: number;
    depositAmount?: number;
    depositPercentage?: number;
    maxRecurringWeeks: number;
  };
}

/**
 * Fetch tenant-specific clinic configuration from the DB.
 *
 * Reads the `config` JSONB column from the `clinics` table for the
 * current tenant and merges with static defaults from clinicConfig.
 * This ensures each tenant can have its own timezone, currency,
 * working hours, and booking settings.
 *
 * Use in API routes and server-side logic instead of accessing
 * clinicConfig directly for these business-critical settings.
 */
export async function getClinicConfig(clinicId: string): Promise<TenantClinicConfig> {
  // Dynamic import to avoid circular dependency
  const { createTenantClient } = await import("@/lib/supabase-server");
  const supabase = await createTenantClient(clinicId);

  const { data } = await supabase
    .from("clinics")
    .select("config")
    .eq("id", clinicId)
    .single();

  /** Shape of the `clinics.config` JSONB column for tenant settings. */
  interface ClinicDbConfig {
    timezone?: string;
    currency?: string;
    workingHours?: TenantClinicConfig["workingHours"];
    slotDuration?: number;
    bufferTime?: number;
    maxAdvanceDays?: number;
    maxPerSlot?: number;
    cancellationHours?: number;
    depositAmount?: number;
    depositPercentage?: number;
    maxRecurringWeeks?: number;
  }

  const dbConfig = (data?.config ?? {}) as ClinicDbConfig;

  // Merge DB config with static defaults (DB takes precedence)
  return {
    timezone: dbConfig.timezone ?? clinicConfig.timezone ?? DEFAULT_TIMEZONE,
    currency: dbConfig.currency ?? clinicConfig.currency ?? "MAD",
    workingHours: dbConfig.workingHours ?? clinicConfig.workingHours,
    booking: {
      slotDuration: dbConfig.slotDuration ?? clinicConfig.booking.slotDuration,
      bufferTime: dbConfig.bufferTime ?? clinicConfig.booking.bufferTime,
      maxAdvanceDays: dbConfig.maxAdvanceDays ?? clinicConfig.booking.maxAdvanceDays,
      maxPerSlot: dbConfig.maxPerSlot ?? clinicConfig.booking.maxPerSlot,
      cancellationHours: dbConfig.cancellationHours ?? clinicConfig.booking.cancellationHours,
      depositAmount: dbConfig.depositAmount ?? clinicConfig.booking.depositAmount,
      depositPercentage: dbConfig.depositPercentage ?? clinicConfig.booking.depositPercentage,
      maxRecurringWeeks: dbConfig.maxRecurringWeeks ?? clinicConfig.booking.maxRecurringWeeks,
    },
  };
}

/**
 * Convenience: resolve tenant + load its clinic config in one call.
 * Returns both the TenantInfo and the TenantClinicConfig.
 */
export async function requireTenantWithConfig(): Promise<{
  tenant: TenantInfo;
  config: TenantClinicConfig;
}> {
  const tenant = await requireTenant();
  const config = await getClinicConfig(tenant.clinicId);
  return { tenant, config };
}
