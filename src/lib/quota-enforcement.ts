/**
 * Per-tenant quota enforcement.
 *
 * Checks monthly resource usage against plan limits before allowing
 * expensive operations (WhatsApp sends, AI calls, etc.).
 *
 * Quota tiers are derived from the clinic's subscription plan
 * (free → starter → professional → enterprise).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import type { ResourceType } from "@/lib/tenant-metering";
import { getMonthlyUnitCount } from "@/lib/tenant-metering";

// ── Quota limits per plan ──

export type QuotaPlan = "free" | "starter" | "professional" | "enterprise";

interface QuotaLimits {
  whatsapp: number;
  sms: number;
  ai_tokens: number;
  r2_storage: number; // bytes
}

/** Monthly quota limits per plan. -1 = unlimited. */
const PLAN_QUOTAS: Record<QuotaPlan, QuotaLimits> = {
  free: {
    whatsapp: 0,
    sms: 0,
    ai_tokens: 5000,
    r2_storage: 100 * 1024 * 1024, // 100 MB
  },
  starter: {
    whatsapp: 100,
    sms: 100,
    ai_tokens: 50_000,
    r2_storage: 1024 * 1024 * 1024, // 1 GB
  },
  professional: {
    whatsapp: 500,
    sms: 500,
    ai_tokens: 500_000,
    r2_storage: 10 * 1024 * 1024 * 1024, // 10 GB
  },
  enterprise: {
    whatsapp: -1,
    sms: -1,
    ai_tokens: -1,
    r2_storage: -1,
  },
};

// ── Public API ──

export interface QuotaCheckResult {
  allowed: boolean;
  currentUsage: number;
  limit: number;
  remainingUnits: number;
  plan: QuotaPlan;
}

/**
 * Check whether a clinic can consume more of a resource.
 *
 * Returns the check result (never throws). Callers decide how to handle
 * a denied request (e.g. return 429).
 */
async function checkQuota(
  supabase: SupabaseClient,
  clinicId: string,
  clinicTier: string,
  resourceType: ResourceType,
  unitsRequested = 1,
): Promise<QuotaCheckResult> {
  const plan = normalizePlan(clinicTier);
  const limits = PLAN_QUOTAS[plan];
  const limit = limits[resourceType];

  // Unlimited plan
  if (limit === -1) {
    return { allowed: true, currentUsage: 0, limit: -1, remainingUnits: -1, plan };
  }

  const currentUsage = await getMonthlyUnitCount(supabase, clinicId, resourceType);
  const remaining = Math.max(0, limit - currentUsage);
  const allowed = currentUsage + unitsRequested <= limit;

  if (!allowed) {
    logger.warn("quota-enforcement: quota exceeded", {
      context: "quota-enforcement",
      clinicId,
      resourceType,
      currentUsage,
      limit,
      unitsRequested,
      plan,
    });
  }

  return {
    allowed,
    currentUsage,
    limit,
    remainingUnits: remaining,
    plan,
  };
}

/**
 * Get quota status for all resource types for a clinic.
 */
export async function getClinicQuotaStatus(
  supabase: SupabaseClient,
  clinicId: string,
  clinicTier: string,
): Promise<Record<ResourceType, QuotaCheckResult>> {
  const resourceTypes: ResourceType[] = ["whatsapp", "sms", "ai_tokens", "r2_storage"];

  const results = await Promise.all(
    resourceTypes.map((rt) => checkQuota(supabase, clinicId, clinicTier, rt)),
  );

  const status = {} as Record<ResourceType, QuotaCheckResult>;
  resourceTypes.forEach((rt, i) => {
    status[rt] = results[i];
  });
  return status;
}

/**
 * Get quota limits for a plan (for display in admin dashboards).
 */
export function getQuotaLimits(plan: QuotaPlan): QuotaLimits {
  return { ...PLAN_QUOTAS[plan] };
}

// ── Internals ──

function normalizePlan(tier: string): QuotaPlan {
  const t = tier.toLowerCase().trim();
  if (t === "free" || t === "starter" || t === "professional" || t === "enterprise") {
    return t;
  }
  // Default to free for unknown tiers (safe default)
  return "free";
}
