/**
 * GET  /api/admin/churn-prediction — Fetch churn risk scores for all clinics
 * POST /api/admin/churn-prediction — Recalculate churn scores (trigger AI analysis)
 *
 * AI-powered churn prediction that flags clinics likely to cancel based on:
 * - Login frequency decline
 * - Appointment volume trends
 * - Support ticket volume
 * - Revenue patterns
 *
 * Requires super_admin role.
 */

import { type NextRequest } from "next/server";
import { apiSuccess, apiInternalError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { createAdminClient, createUntypedAdminClient } from "@/lib/supabase-server";
import type { UserRole } from "@/lib/types/database";
import { safeParse } from "@/lib/validations/helpers";
import { churnPredictionQuerySchema } from "@/lib/validations/super-admin";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const ALLOWED_ROLES: UserRole[] = ["super_admin"];

interface ChurnFactor {
  factor: string;
  weight: number;
  description: string;
}

function computeChurnScore(metrics: {
  loginFrequency30d: number;
  appointmentVolume30d: number;
  appointmentVolumePrev30d: number;
  supportTickets30d: number;
  daysSinceLastLogin: number | null;
  revenue30d: number;
  status: string;
}): { score: number; riskLevel: string; factors: ChurnFactor[] } {
  const factors: ChurnFactor[] = [];
  let score = 0;

  // Factor 1: Login frequency (0-25 points)
  if (metrics.daysSinceLastLogin !== null && metrics.daysSinceLastLogin > 30) {
    const loginScore = Math.min(25, metrics.daysSinceLastLogin - 30);
    score += loginScore;
    factors.push({
      factor: "inactive_login",
      weight: loginScore,
      description: `No login for ${metrics.daysSinceLastLogin} days`,
    });
  } else if (metrics.loginFrequency30d < 5) {
    const loginScore = Math.max(0, 15 - metrics.loginFrequency30d * 3);
    score += loginScore;
    factors.push({
      factor: "low_login_frequency",
      weight: loginScore,
      description: `Only ${metrics.loginFrequency30d} logins in last 30 days`,
    });
  }

  // Factor 2: Appointment volume decline (0-30 points)
  if (metrics.appointmentVolumePrev30d > 0) {
    const declineRate =
      (metrics.appointmentVolumePrev30d - metrics.appointmentVolume30d) /
      metrics.appointmentVolumePrev30d;
    if (declineRate > 0) {
      const appointmentScore = Math.min(30, Math.round(declineRate * 30));
      score += appointmentScore;
      factors.push({
        factor: "appointment_decline",
        weight: appointmentScore,
        description: `${Math.round(declineRate * 100)}% decline in appointments`,
      });
    }
  } else if (metrics.appointmentVolume30d === 0) {
    score += 20;
    factors.push({
      factor: "no_appointments",
      weight: 20,
      description: "Zero appointments in last 30 days",
    });
  }

  // Factor 3: Support tickets (0-15 points)
  if (metrics.supportTickets30d > 5) {
    const ticketScore = Math.min(15, (metrics.supportTickets30d - 5) * 3);
    score += ticketScore;
    factors.push({
      factor: "high_support_tickets",
      weight: ticketScore,
      description: `${metrics.supportTickets30d} support tickets in last 30 days`,
    });
  }

  // Factor 4: Revenue (0-20 points)
  if (metrics.revenue30d === 0) {
    score += 20;
    factors.push({
      factor: "zero_revenue",
      weight: 20,
      description: "No revenue in last 30 days",
    });
  }

  // Factor 5: Account status (0-10 points)
  if (metrics.status === "suspended") {
    score += 10;
    factors.push({
      factor: "suspended_account",
      weight: 10,
      description: "Account is suspended",
    });
  }

  score = Math.min(100, score);

  let riskLevel: string;
  if (score >= 75) riskLevel = "critical";
  else if (score >= 50) riskLevel = "high";
  else if (score >= 25) riskLevel = "medium";
  else riskLevel = "low";

  return { score, riskLevel, factors };
}

async function handleGet(request: NextRequest, _auth: AuthContext) {
  try {
    const { searchParams } = new URL(request.url);
    const parseResult = safeParse(churnPredictionQuerySchema, {
      risk_level: searchParams.get("risk_level") ?? undefined,
      sort_by: searchParams.get("sort_by") ?? undefined,
      sort_order: searchParams.get("sort_order") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    const params = parseResult.success
      ? parseResult.data
      : {
          risk_level: "all" as const,
          sort_by: "score" as const,
          sort_order: "desc" as const,
          limit: 50,
        };

    const untypedAdmin = createUntypedAdminClient("super_admin");
    const typedAdmin = createAdminClient("super_admin");

    let query = untypedAdmin
      .from("clinic_churn_scores")
      .select(
        `
        id,
        clinic_id,
        score,
        risk_level,
        factors,
        login_frequency_30d,
        appointment_volume_30d,
        appointment_volume_prev_30d,
        support_tickets_30d,
        days_since_last_login,
        revenue_30d,
        calculated_at
      `,
      )
      .order("calculated_at", { ascending: false })
      .limit(params.limit);

    if (params.risk_level !== "all") {
      query = query.eq("risk_level", params.risk_level);
    }

    const { data: rawScores, error } = await query;

    if (error) {
      logger.error("Failed to fetch churn scores", {
        context: "churn-prediction",
        error,
      });
      return apiInternalError();
    }

    interface RawChurnScore {
      id: string;
      clinic_id: string;
      score: number;
      risk_level: string;
      factors: ChurnFactor[];
      login_frequency_30d: number;
      appointment_volume_30d: number;
      appointment_volume_prev_30d: number;
      support_tickets_30d: number;
      days_since_last_login: number | null;
      revenue_30d: number;
      calculated_at: string;
    }

    const scores = (rawScores ?? []) as RawChurnScore[];

    // Fetch clinic names for display
    const clinicIds = [...new Set(scores.map((s) => s.clinic_id))];
    // MA-04: exclude soft-deleted clinics
    const { data: clinics } = await typedAdmin
      .from("clinics")
      .select("id, name, type, tier, status, subdomain")
      .in("id", clinicIds.length > 0 ? clinicIds : ["none"])
      .is("deleted_at", null);

    const clinicMap = new Map((clinics ?? []).map((c) => [c.id, c]));

    const enrichedScores = scores.map((s) => {
      const clinic = clinicMap.get(s.clinic_id);
      return {
        ...s,
        clinic_name: clinic?.name ?? "Unknown",
        clinic_type: clinic?.type ?? "unknown",
        clinic_tier: clinic?.tier ?? "unknown",
        clinic_status: clinic?.status ?? "unknown",
        clinic_subdomain: clinic?.subdomain ?? null,
      };
    });

    // Sort
    enrichedScores.sort((a, b) => {
      if (params.sort_by === "clinic_name") {
        return params.sort_order === "asc"
          ? a.clinic_name.localeCompare(b.clinic_name)
          : b.clinic_name.localeCompare(a.clinic_name);
      }
      if (params.sort_by === "calculated_at") {
        const aDate = new Date(a.calculated_at).getTime();
        const bDate = new Date(b.calculated_at).getTime();
        return params.sort_order === "asc" ? aDate - bDate : bDate - aDate;
      }
      return params.sort_order === "asc" ? a.score - b.score : b.score - a.score;
    });

    // Summary
    const summary = {
      total: enrichedScores.length,
      critical: enrichedScores.filter((s) => s.risk_level === "critical").length,
      high: enrichedScores.filter((s) => s.risk_level === "high").length,
      medium: enrichedScores.filter((s) => s.risk_level === "medium").length,
      low: enrichedScores.filter((s) => s.risk_level === "low").length,
      averageScore:
        enrichedScores.length > 0
          ? Math.round(enrichedScores.reduce((sum, s) => sum + s.score, 0) / enrichedScores.length)
          : 0,
    };

    return apiSuccess({ summary, scores: enrichedScores });
  } catch (error) {
    logger.error("Churn prediction fetch failed", {
      context: "churn-prediction",
      error,
    });
    return apiInternalError();
  }
}

async function handlePost(_request: NextRequest, auth: AuthContext) {
  try {
    const typedAdmin = createAdminClient("super_admin");
    const untypedAdmin = createUntypedAdminClient("super_admin");

    // Fetch all clinics and their metrics
    const [clinicsRes, appointmentsRes, paymentsRes, activityRes] = await Promise.all([
      typedAdmin.from("clinics").select("id, name, status, created_at").is("deleted_at", null),
      typedAdmin.from("appointments").select("clinic_id, status, created_at"),
      typedAdmin
        .from("payments")
        .select("clinic_id, amount, status, created_at")
        .eq("status", "completed"),
      typedAdmin
        .from("activity_logs")
        .select("clinic_id, action, created_at")
        .in("action", ["login.success", "login.failed", "support_ticket_created"]),
    ]);

    const clinics = clinicsRes.data ?? [];
    const appointments = appointmentsRes.data ?? [];
    const payments = paymentsRes.data ?? [];
    const activityLogs = activityRes.data ?? [];

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const scores = [];

    for (const clinic of clinics) {
      const clinicAppointments = appointments.filter((a) => a.clinic_id === clinic.id);
      const clinicPayments = payments.filter((p) => p.clinic_id === clinic.id);
      const clinicActivity = activityLogs.filter((a) => a.clinic_id === clinic.id);

      const appointmentVolume30d = clinicAppointments.filter(
        (a) => a.created_at && new Date(a.created_at) >= thirtyDaysAgo,
      ).length;

      const appointmentVolumePrev30d = clinicAppointments.filter(
        (a) =>
          a.created_at &&
          new Date(a.created_at) >= sixtyDaysAgo &&
          new Date(a.created_at) < thirtyDaysAgo,
      ).length;

      const loginEvents = clinicActivity.filter(
        (a) =>
          a.action === "login.success" && a.created_at && new Date(a.created_at) >= thirtyDaysAgo,
      );

      const supportTickets = clinicActivity.filter(
        (a) =>
          a.action === "support_ticket_created" &&
          a.created_at &&
          new Date(a.created_at) >= thirtyDaysAgo,
      );

      const lastLogin = clinicActivity
        .filter((a) => a.action === "login.success" && a.created_at)
        .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime())[0];

      const daysSinceLastLogin = lastLogin?.created_at
        ? Math.floor(
            (now.getTime() - new Date(lastLogin.created_at).getTime()) / (1000 * 60 * 60 * 24),
          )
        : null;

      const revenue30d = clinicPayments
        .filter((p) => p.created_at && new Date(p.created_at) >= thirtyDaysAgo)
        .reduce((sum, p) => sum + (typeof p.amount === "number" ? p.amount : 0), 0);

      const { score, riskLevel, factors } = computeChurnScore({
        loginFrequency30d: loginEvents.length,
        appointmentVolume30d,
        appointmentVolumePrev30d,
        supportTickets30d: supportTickets.length,
        daysSinceLastLogin,
        revenue30d,
        status: clinic.status ?? "active",
      });

      scores.push({
        clinic_id: clinic.id,
        score,
        risk_level: riskLevel,
        factors,
        login_frequency_30d: loginEvents.length,
        appointment_volume_30d: appointmentVolume30d,
        appointment_volume_prev_30d: appointmentVolumePrev30d,
        support_tickets_30d: supportTickets.length,
        days_since_last_login: daysSinceLastLogin,
        revenue_30d: revenue30d,
        calculated_at: now.toISOString(),
      });
    }

    // Upsert scores
    if (scores.length > 0) {
      const { error: insertError } = await untypedAdmin.from("clinic_churn_scores").insert(scores);

      if (insertError) {
        logger.error("Failed to insert churn scores", {
          context: "churn-prediction",
          error: insertError,
        });
        return apiInternalError("Failed to save churn scores");
      }
    }

    await logAuditEvent({
      supabase: auth.supabase,
      action: "churn_scores_calculated",
      type: "admin",
      clinicId: "system",
      actor: auth.user.id,
      description: `Recalculated churn scores for ${scores.length} clinics`,
      metadata: {
        total: scores.length,
        critical: scores.filter((s) => s.risk_level === "critical").length,
        high: scores.filter((s) => s.risk_level === "high").length,
      },
    });

    return apiSuccess({
      calculated: scores.length,
      summary: {
        critical: scores.filter((s) => s.risk_level === "critical").length,
        high: scores.filter((s) => s.risk_level === "high").length,
        medium: scores.filter((s) => s.risk_level === "medium").length,
        low: scores.filter((s) => s.risk_level === "low").length,
      },
    });
  } catch (error) {
    logger.error("Churn prediction calculation failed", {
      context: "churn-prediction",
      error,
    });
    return apiInternalError();
  }
}

export const GET = withAuth(handleGet, ALLOWED_ROLES, { failOpen: true });
export const POST = withAuth(handlePost, ALLOWED_ROLES);
