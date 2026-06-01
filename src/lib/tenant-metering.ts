/**
 * Per-tenant resource usage metering.
 *
 * Records consumption events (WhatsApp sends, R2 uploads, AI tokens)
 * to the `tenant_usage_log` table for quota enforcement and billing.
 *
 * All writes are fire-and-forget (non-blocking, non-fatal) so metering
 * never breaks the primary request path.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

// ── Resource types ──

export type ResourceType = "whatsapp" | "sms" | "r2_storage" | "ai_tokens";

// ── Cost constants (USD) ──

/** Estimated per-unit costs for metering. */
const RESOURCE_COSTS: Record<ResourceType, number> = {
  whatsapp: 0.005, // ~$0.005 per message (Meta utility template avg)
  sms: 0.01, // ~$0.01 per SMS (Morocco rates)
  r2_storage: 0.000000015, // $0.015 per GB-month ≈ $0.000000015 per byte-month
  ai_tokens: 0, // tracked separately via ai-cost-tracker.ts
};

// ── Public API ──

/**
 * Record a metered usage event for a clinic.
 *
 * Fire-and-forget — errors are logged but never thrown.
 */
export async function recordUsage(
  supabase: SupabaseClient,
  clinicId: string,
  resourceType: ResourceType,
  unitCount: number,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    const costUsd = unitCount * RESOURCE_COSTS[resourceType];

    await supabase.from("tenant_usage_log").insert({
      clinic_id: clinicId,
      resource_type: resourceType,
      unit_count: unitCount,
      cost_usd: costUsd,
      metadata: metadata ?? null,
    });
  } catch (err) {
    logger.error("tenant-metering: failed to record usage", {
      context: "tenant-metering",
      clinicId,
      resourceType,
      unitCount,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ── Query helpers ──

export interface UsageSummary {
  resourceType: ResourceType;
  totalUnits: number;
  totalCostUsd: number;
  eventCount: number;
}

/**
 * Get usage summary for a clinic in the current calendar month.
 */
export async function getMonthlyUsage(
  supabase: SupabaseClient,
  clinicId: string,
): Promise<UsageSummary[]> {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("tenant_usage_log")
    .select("resource_type, unit_count, cost_usd")
    .eq("clinic_id", clinicId) // tenant-scoped
    .gte("created_at", monthStart.toISOString());

  if (error) {
    logger.error("tenant-metering: failed to fetch monthly usage", {
      context: "tenant-metering",
      clinicId,
      error: error.message,
    });
    return [];
  }

  const byType: Record<string, { units: number; cost: number; count: number }> = {};
  for (const row of data ?? []) {
    const rt = row.resource_type as string;
    if (!byType[rt]) byType[rt] = { units: 0, cost: 0, count: 0 };
    byType[rt].units += Number(row.unit_count) || 0;
    byType[rt].cost += Number(row.cost_usd) || 0;
    byType[rt].count += 1;
  }

  return Object.entries(byType).map(([rt, v]) => ({
    resourceType: rt as ResourceType,
    totalUnits: v.units,
    totalCostUsd: v.cost,
    eventCount: v.count,
  }));
}

/**
 * Get total unit count for a specific resource type this month.
 * Used by quota enforcement to check limits.
 */
export async function getMonthlyUnitCount(
  supabase: SupabaseClient,
  clinicId: string,
  resourceType: ResourceType,
): Promise<number> {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("tenant_usage_log")
    .select("unit_count")
    .eq("clinic_id", clinicId) // tenant-scoped
    .eq("resource_type", resourceType)
    .gte("created_at", monthStart.toISOString());

  if (error) {
    logger.error("tenant-metering: failed to fetch unit count", {
      context: "tenant-metering",
      clinicId,
      resourceType,
      error: error.message,
    });
    return 0;
  }

  return (data ?? []).reduce((sum, row) => sum + (Number(row.unit_count) || 0), 0);
}

/**
 * Get usage for all clinics (super-admin overview).
 * Returns one row per clinic per resource type for the current month.
 */
export async function getAllClinicsMonthlyUsage(
  supabase: SupabaseClient,
): Promise<
  Array<{ clinicId: string; resourceType: string; totalUnits: number; totalCostUsd: number }>
> {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  // nosemgrep: tenant-scoping — intentional cross-tenant query for super-admin overview
  const { data, error } = await supabase
    .from("tenant_usage_log")
    .select("clinic_id, resource_type, unit_count, cost_usd")
    .gte("created_at", monthStart.toISOString())
    .order("clinic_id");

  if (error) {
    logger.error("tenant-metering: failed to fetch all clinics usage", {
      context: "tenant-metering",
      error: error.message,
    });
    return [];
  }

  const grouped: Record<string, { units: number; cost: number }> = {};
  for (const row of data ?? []) {
    const key = `${row.clinic_id}::${row.resource_type}`;
    if (!grouped[key]) grouped[key] = { units: 0, cost: 0 };
    grouped[key].units += Number(row.unit_count) || 0;
    grouped[key].cost += Number(row.cost_usd) || 0;
  }

  return Object.entries(grouped).map(([key, v]) => {
    const [clinicId, resourceType] = key.split("::");
    return { clinicId, resourceType, totalUnits: v.units, totalCostUsd: v.cost };
  });
}
