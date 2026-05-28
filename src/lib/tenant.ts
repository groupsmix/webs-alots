/**
 * Server-side tenant resolution.
 *
 * In middleware, the resolved clinic is stored in request headers.
 * Server Components and API routes read it from headers().
 *
 * IMPORTANT: All tenant-specific data (clinic_id, timezone, booking config,
 * working hours, currency) MUST come from request context or DB — never
 * from static config files.
 */

import { headers } from "next/headers";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { logTenantContext } from "@/lib/tenant-context";

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
    throw new Error(
      "Tenant context is required but was not resolved. Ensure the request includes a valid subdomain.",
    );
  }
  logTenantContext(tenant.clinicId, "requireTenant");
  return tenant;
}

// ── Tenant-specific clinic configuration ──────────────────────────────

/**
 * Per-tenant booking configuration resolved from the clinics table `config`
 * JSONB column, with hardcoded sensible defaults.
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

/** Sensible defaults for working hours (Mon-Fri 09-17, Sat 09-13, Sun off). */
const DEFAULT_WORKING_HOURS: TenantClinicConfig["workingHours"] = {
  0: { open: "09:00", close: "17:00", enabled: false },
  1: { open: "09:00", close: "17:00", enabled: true },
  2: { open: "09:00", close: "17:00", enabled: true },
  3: { open: "09:00", close: "17:00", enabled: true },
  4: { open: "09:00", close: "17:00", enabled: true },
  5: { open: "09:00", close: "17:00", enabled: true },
  6: { open: "09:00", close: "13:00", enabled: true },
};

const DEFAULT_BOOKING: TenantClinicConfig["booking"] = {
  slotDuration: 30,
  bufferTime: 10,
  maxAdvanceDays: 30,
  maxPerSlot: 1,
  cancellationHours: 24,
  depositAmount: undefined,
  depositPercentage: 20,
  maxRecurringWeeks: 12,
};

/**
 * Fetch tenant-specific clinic configuration from the DB.
 *
 * Reads the `config` JSONB column from the `clinics` table for the
 * current tenant and merges with hardcoded defaults.
 * This ensures each tenant can have its own timezone, currency,
 * working hours, and booking settings.
 */
export async function getClinicConfig(clinicId: string): Promise<TenantClinicConfig> {
  // Dynamic import to avoid circular dependency
  const { createTenantClient } = await import("@/lib/supabase-server");
  const supabase = await createTenantClient(clinicId);

  const { data } = await supabase.from("clinics").select("config").eq("id", clinicId).single();

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

  // Merge DB config with hardcoded defaults (DB takes precedence)
  return {
    timezone: dbConfig.timezone ?? DEFAULT_TIMEZONE,
    currency: dbConfig.currency ?? "MAD",
    workingHours: dbConfig.workingHours ?? DEFAULT_WORKING_HOURS,
    booking: {
      slotDuration: dbConfig.slotDuration ?? DEFAULT_BOOKING.slotDuration,
      bufferTime: dbConfig.bufferTime ?? DEFAULT_BOOKING.bufferTime,
      maxAdvanceDays: dbConfig.maxAdvanceDays ?? DEFAULT_BOOKING.maxAdvanceDays,
      maxPerSlot: dbConfig.maxPerSlot ?? DEFAULT_BOOKING.maxPerSlot,
      cancellationHours: dbConfig.cancellationHours ?? DEFAULT_BOOKING.cancellationHours,
      depositAmount: dbConfig.depositAmount ?? DEFAULT_BOOKING.depositAmount,
      depositPercentage: dbConfig.depositPercentage ?? DEFAULT_BOOKING.depositPercentage,
      maxRecurringWeeks: dbConfig.maxRecurringWeeks ?? DEFAULT_BOOKING.maxRecurringWeeks,
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
