/**
 * Plan limit enforcement helpers.
 *
 * withPlanLimit() — Higher-order route wrapper that checks a clinic's
 * current usage against their plan limits before allowing an operation.
 *
 * assertPlanLimit() — Throws PlanLimitError if limit is exceeded.
 * requireFeature() — Throws if the plan doesn't include a feature.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { canAccessFeature, type FeatureMatrix } from "@/lib/pricing-tiers";
import { SUBSCRIPTION_PLANS } from "@/lib/subscription-billing";
import { getMonthlyUnitCount } from "@/lib/tenant-metering";
import type { UserRole } from "@/lib/types/database";
import { withAuth, type AuthContext } from "@/lib/with-auth";

// ── Error class ──────────────────────────────────────────────────────────────

export class PlanLimitError extends Error {
  readonly code = "PLAN_LIMIT_EXCEEDED";
  readonly limitKey: string;
  readonly current: number;
  readonly limit: number;
  readonly planSlug: string;
  readonly upgradeUrl = "/admin/billing";

  constructor(limitKey: string, current: number, limit: number, planSlug: string) {
    super(
      `Plan limit exceeded: ${limitKey} (${current}/${limit}) on plan "${planSlug}". Upgrade at /admin/billing.`,
    );
    this.name = "PlanLimitError";
    this.limitKey = limitKey;
    this.current = current;
    this.limit = limit;
    this.planSlug = planSlug;
  }
}

// ── Limit key type ───────────────────────────────────────────────────────────

export type LimitKey =
  | "max_doctors"
  | "max_appointments_per_month"
  | "max_whatsapp_per_month"
  | "ai_features"
  | "custom_domain"
  | "advanced_analytics";

// ── Internal helpers ─────────────────────────────────────────────────────────

/** Normalize a clinic tier string to a known plan slug, defaulting to "free". */
function normalizePlanSlug(tier: string): "free" | "starter" | "professional" | "enterprise" {
  const t = (tier ?? "free").toLowerCase().trim();
  if (t === "free" || t === "starter" || t === "professional" || t === "enterprise") {
    return t;
  }
  // trial or unknown → treat as free (safe default)
  return "free";
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Check the clinic's current usage for a limit and throw PlanLimitError if exceeded.
 *
 * Count-based limits compare current month usage against the plan's configured ceiling.
 * Boolean feature limits check the FeatureMatrix from pricing-tiers.
 *
 * Errors fetching usage data are logged and treated as pass-through (fail-open)
 * to avoid blocking the primary request path on a monitoring failure.
 */
export async function assertPlanLimit(
  supabase: SupabaseClient,
  clinicId: string,
  limitKey: LimitKey,
): Promise<void> {
  // 1. Fetch clinic tier — scoped to this clinic only
  const { data: clinic, error: clinicError } = await supabase
    .from("clinics")
    .select("tier")
    .eq("id", clinicId)
    .single();

  if (clinicError || !clinic) {
    logger.error("plan-enforcement: failed to fetch clinic tier", {
      context: "plan-enforcement",
      clinicId,
      limitKey,
      error: clinicError?.message,
    });
    // Fail-open: cannot enforce without knowing the plan
    return;
  }

  const tier = normalizePlanSlug(clinic.tier ?? "free");

  // 2. Boolean feature checks (no count required)
  if (
    limitKey === "ai_features" ||
    limitKey === "custom_domain" ||
    limitKey === "advanced_analytics"
  ) {
    const featureMap: Record<string, keyof FeatureMatrix> = {
      ai_features: "aiFeatures",
      custom_domain: "customDomain",
      advanced_analytics: "advancedAnalytics",
    };
    const featureKey = featureMap[limitKey] as keyof FeatureMatrix;
    if (!canAccessFeature(tier, featureKey)) {
      throw new PlanLimitError(limitKey, 0, 0, tier);
    }
    return;
  }

  // 3. Count-based limits — look up plan config
  const plan = SUBSCRIPTION_PLANS.find((p) => p.id === tier) ?? SUBSCRIPTION_PLANS[0];

  if (limitKey === "max_doctors") {
    const limit = plan.maxDoctors;
    if (limit === -1) return; // unlimited

    const { count, error: countError } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("clinic_id", clinicId) // tenant-scoped
      .eq("role", "doctor");

    if (countError) {
      logger.error("plan-enforcement: failed to count doctors", {
        context: "plan-enforcement",
        clinicId,
        error: countError.message,
      });
      return; // fail-open
    }

    const current = count ?? 0;
    if (current >= limit) {
      throw new PlanLimitError(limitKey, current, limit, tier);
    }
    return;
  }

  if (limitKey === "max_appointments_per_month") {
    const limit = plan.maxAppointmentsPerMonth;
    if (limit === -1) return; // unlimited

    const now = new Date();
    const monthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;

    const { count, error: countError } = await supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("clinic_id", clinicId) // tenant-scoped
      .gte("appointment_date", monthStart);

    if (countError) {
      logger.error("plan-enforcement: failed to count appointments", {
        context: "plan-enforcement",
        clinicId,
        error: countError.message,
      });
      return; // fail-open
    }

    const current = count ?? 0;
    if (current >= limit) {
      throw new PlanLimitError(limitKey, current, limit, tier);
    }
    return;
  }

  if (limitKey === "max_whatsapp_per_month") {
    const limit = plan.whatsappCredits;
    if (limit === -1) return; // unlimited

    const current = await getMonthlyUnitCount(supabase, clinicId, "whatsapp");
    if (current >= limit) {
      throw new PlanLimitError(limitKey, current, limit, tier);
    }
    return;
  }
}

/**
 * Throw PlanLimitError if the clinic's plan doesn't include a boolean feature.
 *
 * Analogous to assertPlanLimit() but for feature-gate (on/off) checks
 * that don't have a numeric ceiling.
 */
export async function requireFeature(
  supabase: SupabaseClient,
  clinicId: string,
  feature: keyof FeatureMatrix,
): Promise<void> {
  const { data: clinic } = await supabase
    .from("clinics")
    .select("tier")
    .eq("id", clinicId) // tenant-scoped
    .single();

  const tier = normalizePlanSlug(clinic?.tier ?? "free");
  if (!canAccessFeature(tier, feature)) {
    throw new PlanLimitError(String(feature), 0, 0, tier);
  }
}

// ── Route wrapper ────────────────────────────────────────────────────────────

type AuthenticatedHandler = (request: NextRequest, auth: AuthContext) => Promise<NextResponse>;

/**
 * Higher-order route wrapper that gate-checks a plan limit before the handler runs.
 *
 * Wraps withAuth so the full authentication + RBAC pipeline applies first.
 * Returns 403 PLAN_LIMIT_EXCEEDED if the clinic has reached its limit.
 *
 * @example
 *   export const POST = withPlanLimit(
 *     "max_doctors",
 *     async (request, auth) => {
 *       // Only reached if the doctor count is within plan limits
 *       return apiSuccess({ created: true });
 *     },
 *     ["clinic_admin"],
 *   );
 */
export function withPlanLimit(
  limitKey: LimitKey,
  handler: AuthenticatedHandler,
  allowedRoles: UserRole[],
): (request: NextRequest) => Promise<NextResponse> {
  return withAuth(async (request: NextRequest, auth: AuthContext) => {
    const clinicId = auth.profile.clinic_id;

    if (!clinicId) {
      return apiError("Clinic context required", 403, "FORBIDDEN");
    }

    try {
      await assertPlanLimit(auth.supabase, clinicId, limitKey);
    } catch (err) {
      if (err instanceof PlanLimitError) {
        logger.warn("plan-enforcement: plan limit blocked request", {
          context: "plan-enforcement",
          clinicId,
          limitKey,
          current: err.current,
          limit: err.limit,
          plan: err.planSlug,
        });
        return apiError(
          `Plan limit reached for "${limitKey}". Upgrade your plan to continue.`,
          403,
          "PLAN_LIMIT_EXCEEDED",
        );
      }
      // Unexpected error — re-throw to let the withAuth wrapper's catch handle it
      throw err;
    }

    return handler(request, auth);
  }, allowedRoles);
}
