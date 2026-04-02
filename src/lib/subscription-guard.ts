/**
 * Subscription enforcement utilities.
 *
 * Checks whether a clinic's current plan includes a given feature or
 * is within its usage limits.  Used by API routes to gate access.
 *
 * @example
 *   import { checkSubscriptionLimit, getUsage } from "@/lib/subscription-guard";
 *
 *   const allowed = await checkSubscriptionLimit(supabase, clinicId, "ai_receptionist");
 *   if (!allowed.ok) return apiError(allowed.message, 403, "PLAN_LIMIT");
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SUBSCRIPTION_PLANS,
  PLAN_ORDER,
  type PlanSlug,
  type PlanLimits,
} from "@/lib/config/subscription-plans";
import { logger } from "@/lib/logger";
import type { Database } from "@/lib/types/database";

// ── Types ───────────────────────────────────────────────────

export interface UsageStats {
  appointmentsThisMonth: number;
  staffCount: number;
  storageUsedGB: number;
}

export interface LimitCheckResult {
  ok: boolean;
  message: string;
  currentPlan: PlanSlug;
  /** The cheapest plan that unlocks the requested feature. */
  upgradeTo?: PlanSlug;
}

// ── Helpers ─────────────────────────────────────────────────

/**
 * Resolve the clinic's current plan slug from the database.
 *
 * Looks at `clinics.subscription_plan` first; falls back to mapping
 * the legacy `clinics.tier` column to a plan slug.
 */
async function resolveClinicPlan(
  supabase: SupabaseClient<Database>,
  clinicId: string,
): Promise<PlanSlug> {
  const { data, error } = await supabase
    .from("clinics")
    .select("tier, config")
    .eq("id", clinicId)
    .single();

  if (error || !data) {
    logger.warn("Failed to resolve clinic plan — defaulting to free", {
      context: "subscription-guard",
      clinicId,
      error,
    });
    return "free";
  }

  // Check config for explicit subscription_plan
  const config = data.config as Record<string, unknown> | null;
  if (config?.subscription_plan && typeof config.subscription_plan === "string") {
    const slug = config.subscription_plan as PlanSlug;
    if (SUBSCRIPTION_PLANS[slug]) return slug;
  }

  // Map legacy tier to plan slug
  const tierMap: Record<string, PlanSlug> = {
    vitrine: "free",
    cabinet: "starter",
    pro: "professional",
    premium: "enterprise",
  };

  const tier = data.tier as string | null;
  return tierMap[tier ?? ""] ?? "free";
}

/**
 * Get the plan limits for a clinic.
 */
export async function getClinicLimits(
  supabase: SupabaseClient<Database>,
  clinicId: string,
): Promise<{ plan: PlanSlug; limits: PlanLimits }> {
  const plan = await resolveClinicPlan(supabase, clinicId);
  return { plan, limits: SUBSCRIPTION_PLANS[plan].limits };
}

/**
 * Get current usage stats for a clinic.
 */
export async function getUsage(
  supabase: SupabaseClient<Database>,
  clinicId: string,
): Promise<UsageStats> {
  // Get first day of current month in UTC
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString();

  const [appointmentsRes, staffRes] = await Promise.all([
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .gte("created_at", monthStart),
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .in("role", ["clinic_admin", "receptionist", "doctor"]),
  ]);

  return {
    appointmentsThisMonth: appointmentsRes.count ?? 0,
    staffCount: staffRes.count ?? 0,
    storageUsedGB: 0, // TODO: Calculate from R2 when billing integration is complete
  };
}

/**
 * Check if a clinic's plan includes a specific feature.
 *
 * Features checked:
 * - `"ai_receptionist"` / `"ai_chatbot"` — requires aiChatbot !== false
 * - `"api_access"` — requires apiAccess === true
 * - `"custom_domain"` — requires customDomain === true
 * - `"multi_location"` — requires multiLocation === true
 * - `"appointments"` — checks appointmentsPerMonth limit against usage
 * - `"staff"` — checks staffMembers limit against usage
 */
export async function checkSubscriptionLimit(
  supabase: SupabaseClient<Database>,
  clinicId: string,
  feature: string,
): Promise<LimitCheckResult> {
  const plan = await resolveClinicPlan(supabase, clinicId);
  const planConfig = SUBSCRIPTION_PLANS[plan];
  const limits = planConfig.limits;

  const ok = (message = ""): LimitCheckResult => ({
    ok: true,
    message,
    currentPlan: plan,
  });

  const deny = (message: string, upgradeTo?: PlanSlug): LimitCheckResult => ({
    ok: false,
    message,
    currentPlan: plan,
    upgradeTo,
  });

  // Find the cheapest plan that includes the feature
  const findUpgradePlan = (check: (l: PlanLimits) => boolean): PlanSlug | undefined => {
    const currentIndex = PLAN_ORDER.indexOf(plan);
    for (let i = currentIndex + 1; i < PLAN_ORDER.length; i++) {
      const candidate = PLAN_ORDER[i];
      if (check(SUBSCRIPTION_PLANS[candidate].limits)) {
        return candidate;
      }
    }
    return undefined;
  };

  switch (feature) {
    case "ai_receptionist":
    case "ai_chatbot": {
      if (limits.aiChatbot === false) {
        const upgrade = findUpgradePlan((l) => l.aiChatbot !== false);
        const upgradeName = upgrade ? SUBSCRIPTION_PLANS[upgrade].name : "un plan supérieur";
        return deny(
          `Passez au plan ${upgradeName} pour débloquer le Réceptionniste IA`,
          upgrade,
        );
      }
      return ok();
    }

    case "api_access": {
      if (!limits.apiAccess) {
        const upgrade = findUpgradePlan((l) => l.apiAccess);
        const upgradeName = upgrade ? SUBSCRIPTION_PLANS[upgrade].name : "un plan supérieur";
        return deny(
          `Passez au plan ${upgradeName} pour débloquer l'accès API`,
          upgrade,
        );
      }
      return ok();
    }

    case "custom_domain": {
      if (!limits.customDomain) {
        const upgrade = findUpgradePlan((l) => l.customDomain);
        const upgradeName = upgrade ? SUBSCRIPTION_PLANS[upgrade].name : "un plan supérieur";
        return deny(
          `Passez au plan ${upgradeName} pour utiliser un domaine personnalisé`,
          upgrade,
        );
      }
      return ok();
    }

    case "multi_location": {
      if (!limits.multiLocation) {
        const upgrade = findUpgradePlan((l) => l.multiLocation);
        const upgradeName = upgrade ? SUBSCRIPTION_PLANS[upgrade].name : "un plan supérieur";
        return deny(
          `Passez au plan ${upgradeName} pour gérer plusieurs établissements`,
          upgrade,
        );
      }
      return ok();
    }

    case "appointments": {
      if (limits.appointmentsPerMonth === -1) return ok();
      const usage = await getUsage(supabase, clinicId);
      if (usage.appointmentsThisMonth >= limits.appointmentsPerMonth) {
        const upgrade = findUpgradePlan(
          (l) => l.appointmentsPerMonth === -1 || l.appointmentsPerMonth > limits.appointmentsPerMonth,
        );
        const upgradeName = upgrade ? SUBSCRIPTION_PLANS[upgrade].name : "un plan supérieur";
        return deny(
          `Limite de ${limits.appointmentsPerMonth} RDV/mois atteinte. Passez au plan ${upgradeName} pour plus de rendez-vous.`,
          upgrade,
        );
      }
      return ok();
    }

    case "staff": {
      if (limits.staffMembers === -1) return ok();
      const usage = await getUsage(supabase, clinicId);
      if (usage.staffCount >= limits.staffMembers) {
        const upgrade = findUpgradePlan(
          (l) => l.staffMembers === -1 || l.staffMembers > limits.staffMembers,
        );
        const upgradeName = upgrade ? SUBSCRIPTION_PLANS[upgrade].name : "un plan supérieur";
        return deny(
          `Limite de ${limits.staffMembers} membre(s) du personnel atteinte. Passez au plan ${upgradeName}.`,
          upgrade,
        );
      }
      return ok();
    }

    default:
      return ok();
  }
}
