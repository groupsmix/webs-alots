/**
 * GET  /api/admin/revenue-forecast — Fetch revenue forecasts and historical snapshots
 * POST /api/admin/revenue-forecast — Generate new forecast from current MRR + pipeline
 *
 * Predicts next month's SaaS revenue from MRR + pipeline data.
 * Historical trend analysis with confidence intervals.
 *
 * Requires super_admin role.
 */

import { type NextRequest } from "next/server";
import { apiSuccess, apiInternalError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { SUBSCRIPTION_PLANS, type PlanSlug } from "@/lib/config/subscription-plans";
import { logger } from "@/lib/logger";
import { createAdminClient, createUntypedAdminClient } from "@/lib/supabase-server";
import type { UserRole } from "@/lib/types/database";
import { safeParse } from "@/lib/validations/helpers";
import { revenueForecastQuerySchema } from "@/lib/validations/super-admin";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const ALLOWED_ROLES: UserRole[] = ["super_admin"];

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

async function handleGet(request: NextRequest, auth: AuthContext) {
  try {
    const { searchParams } = new URL(request.url);
    const parseResult = safeParse(revenueForecastQuerySchema, {
      months_ahead: searchParams.get("months_ahead") ?? undefined,
    });
    const params = parseResult.success ? parseResult.data : { months_ahead: 3 };

    const untypedAdmin = createUntypedAdminClient("super_admin");

    // Fetch historical snapshots
    const { data: snapshots, error: snapError } = await untypedAdmin
      .from("revenue_snapshots")
      .select("*")
      .order("month", { ascending: false })
      .limit(12);

    if (snapError) {
      logger.error("Failed to fetch revenue snapshots", {
        context: "revenue-forecast",
        error: snapError,
      });
    }

    // Fetch existing forecasts
    const { data: forecasts, error: forecastError } = await untypedAdmin
      .from("revenue_forecasts")
      .select("*")
      .order("forecast_month", { ascending: true })
      .limit(params.months_ahead);

    if (forecastError) {
      logger.error("Failed to fetch revenue forecasts", {
        context: "revenue-forecast",
        error: forecastError,
      });
    }

    // Calculate current MRR
    // MA-04: exclude soft-deleted clinics
    const { data: clinics } = await auth.supabase
      .from("clinics")
      .select("id, config, status, tier, created_at")
      .is("deleted_at", null);

    let currentMrr = 0;
    const planBreakdown: Record<string, number> = {};
    let totalClinics = 0;
    let paidClinics = 0;

    for (const clinic of clinics ?? []) {
      totalClinics++;
      const config = clinic.config as Record<string, unknown> | null;
      const planSlug = (config?.subscription_plan as PlanSlug) ?? "free";
      const plan = SUBSCRIPTION_PLANS[planSlug];
      if (plan) {
        planBreakdown[planSlug] = (planBreakdown[planSlug] ?? 0) + 1;
        if (plan.price > 0 && clinic.status === "active") {
          currentMrr += plan.price;
          paidClinics++;
        }
      }
    }

    return apiSuccess({
      current: {
        mrr: currentMrr,
        arr: currentMrr * 12,
        totalClinics,
        paidClinics,
        planBreakdown,
        month: getMonthKey(new Date()),
      },
      historical: (snapshots ?? []).reverse(),
      forecasts: forecasts ?? [],
    });
  } catch (error) {
    logger.error("Revenue forecast fetch failed", {
      context: "revenue-forecast",
      error,
    });
    return apiInternalError();
  }
}

async function handlePost(request: NextRequest, auth: AuthContext) {
  try {
    const { searchParams } = new URL(request.url);
    const parseResult = safeParse(revenueForecastQuerySchema, {
      months_ahead: searchParams.get("months_ahead") ?? undefined,
    });
    const monthsAhead = parseResult.success ? parseResult.data.months_ahead : 3;

    const typedAdmin = createAdminClient("super_admin");
    const untypedAdmin = createUntypedAdminClient("super_admin");

    // Get current clinic data
    // MA-04: exclude soft-deleted clinics
    const { data: clinics } = await typedAdmin
      .from("clinics")
      .select("id, config, status, tier, created_at")
      .is("deleted_at", null);

    // Calculate current MRR
    let currentMrr = 0;
    const planBreakdown: Record<string, number> = {};
    let totalClinics = 0;
    let paidClinics = 0;
    let newClinicsThisMonth = 0;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    for (const clinic of clinics ?? []) {
      totalClinics++;
      const config = clinic.config as Record<string, unknown> | null;
      const planSlug = (config?.subscription_plan as PlanSlug) ?? "free";
      const plan = SUBSCRIPTION_PLANS[planSlug];
      if (plan) {
        planBreakdown[planSlug] = (planBreakdown[planSlug] ?? 0) + 1;
        if (plan.price > 0 && clinic.status === "active") {
          currentMrr += plan.price;
          paidClinics++;
        }
      }
      if (clinic.created_at && new Date(clinic.created_at) >= monthStart) {
        newClinicsThisMonth++;
      }
    }

    // Save current month snapshot
    const currentMonth = getMonthKey(now);
    const { error: snapError } = await untypedAdmin.from("revenue_snapshots").upsert(
      {
        month: currentMonth,
        mrr: currentMrr,
        arr: currentMrr * 12,
        total_clinics: totalClinics,
        paid_clinics: paidClinics,
        churned_clinics: 0,
        new_clinics: newClinicsThisMonth,
        expansion_revenue: 0,
        contraction_revenue: 0,
        plan_breakdown: planBreakdown,
      },
      { onConflict: "month" },
    );

    if (snapError) {
      logger.error("Failed to upsert revenue snapshot", {
        context: "revenue-forecast",
        error: snapError,
      });
    }

    // Fetch historical data for trend analysis
    const { data: historicalSnapshots } = await untypedAdmin
      .from("revenue_snapshots")
      .select("month, mrr, total_clinics, paid_clinics, new_clinics, churned_clinics")
      .order("month", { ascending: true })
      .limit(12);

    // Calculate growth rate from historical data
    const history = historicalSnapshots ?? [];
    let avgGrowthRate = 0.03; // Default 3% monthly growth assumption

    if (history.length >= 2) {
      const growthRates: number[] = [];
      for (let i = 1; i < history.length; i++) {
        const prevMrr = Number(history[i - 1].mrr);
        const currMrr = Number(history[i].mrr);
        if (prevMrr > 0) {
          growthRates.push((currMrr - prevMrr) / prevMrr);
        }
      }
      if (growthRates.length > 0) {
        avgGrowthRate = growthRates.reduce((a, b) => a + b, 0) / growthRates.length;
      }
    }

    // Generate forecasts
    const forecasts = [];
    let forecastMrr = currentMrr;

    for (let i = 1; i <= monthsAhead; i++) {
      const forecastDate = addMonths(now, i);
      const forecastMonth = getMonthKey(forecastDate);

      forecastMrr = forecastMrr * (1 + avgGrowthRate);

      // Confidence interval widens with time
      const confidenceSpread = forecastMrr * 0.1 * i;

      forecasts.push({
        forecast_month: forecastMonth,
        predicted_mrr: Math.round(forecastMrr * 100) / 100,
        predicted_arr: Math.round(forecastMrr * 12 * 100) / 100,
        confidence_low: Math.round((forecastMrr - confidenceSpread) * 100) / 100,
        confidence_high: Math.round((forecastMrr + confidenceSpread) * 100) / 100,
        assumptions: {
          growth_rate: Math.round(avgGrowthRate * 10000) / 100,
          base_mrr: currentMrr,
          months_of_history: history.length,
        },
        model_version: "v1",
      });
    }

    // Save forecasts
    for (const forecast of forecasts) {
      const { error: fError } = await untypedAdmin
        .from("revenue_forecasts")
        .upsert(forecast, { onConflict: "forecast_month,model_version" });

      if (fError) {
        logger.error("Failed to save forecast", {
          context: "revenue-forecast",
          error: fError,
          month: forecast.forecast_month,
        });
      }
    }

    await logAuditEvent({
      supabase: auth.supabase,
      action: "revenue_forecast_generated",
      type: "admin",
      clinicId: "system",
      actor: auth.user.id,
      description: `Generated ${monthsAhead}-month revenue forecast`,
      metadata: {
        current_mrr: currentMrr,
        growth_rate: avgGrowthRate,
        months_ahead: monthsAhead,
      },
    });

    return apiSuccess({
      current: {
        mrr: currentMrr,
        arr: currentMrr * 12,
        totalClinics,
        paidClinics,
        planBreakdown,
        month: currentMonth,
      },
      forecasts,
      growthRate: Math.round(avgGrowthRate * 10000) / 100,
      historicalMonths: history.length,
    });
  } catch (error) {
    logger.error("Revenue forecast generation failed", {
      context: "revenue-forecast",
      error,
    });
    return apiInternalError();
  }
}

export const GET = withAuth(handleGet, ALLOWED_ROLES);
export const POST = withAuth(handlePost, ALLOWED_ROLES);
