import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { requireTenant } from "@/lib/tenant";
import { withAuth, type AuthContext } from "@/lib/with-auth";

/**
 * GET /api/support/dashboard
 * Returns support dashboard metrics for the current clinic.
 * Includes open tickets, response times, satisfaction scores, and channel breakdown.
 */
export const GET = withAuth(
  async (request: NextRequest, auth: AuthContext) => {
    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;
    const url = new URL(request.url);
    const dateFrom = url.searchParams.get("date_from");
    const dateTo = url.searchParams.get("date_to");

    // Fetch ticket counts by status
    const [openRes, inProgressRes, resolvedRes, closedRes] = await Promise.all([
      auth.supabase
        .from("support_tickets")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId)
        .eq("status", "open"),
      auth.supabase
        .from("support_tickets")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId)
        .eq("status", "in_progress"),
      auth.supabase
        .from("support_tickets")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId)
        .eq("status", "resolved"),
      auth.supabase
        .from("support_tickets")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId)
        .eq("status", "closed"),
    ]);

    // Fetch recent tickets for the list view
    let recentQuery = auth.supabase
      .from("support_tickets")
      .select(
        "id, subject, status, priority, channel, language, patient_name, patient_phone, assigned_to, satisfaction_rating, created_at, updated_at, resolved_at",
      )
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (dateFrom) {
      recentQuery = recentQuery.gte("created_at", `${dateFrom}T00:00:00`);
    }
    if (dateTo) {
      recentQuery = recentQuery.lte("created_at", `${dateTo}T23:59:59`);
    }

    const { data: recentTickets, error: recentError } = await recentQuery;

    if (recentError) {
      logger.error("Failed to fetch dashboard data", {
        context: "support/dashboard",
        error: recentError,
        clinicId,
      });
      return apiError("Failed to fetch dashboard data", 500, "INTERNAL_ERROR");
    }

    // Fetch tickets with satisfaction ratings for avg calculation
    const { data: ratedTickets } = await auth.supabase
      .from("support_tickets")
      .select("satisfaction_rating")
      .eq("clinic_id", clinicId)
      .not("satisfaction_rating", "is", null);

    const ratings = (ratedTickets ?? [])
      .map((t) => t.satisfaction_rating)
      .filter((r): r is number => r !== null);
    const avgSatisfaction =
      ratings.length > 0 ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : null;

    // Channel breakdown from recent tickets
    const channelBreakdown: Record<string, number> = {};
    for (const ticket of recentTickets ?? []) {
      const ch = ticket.channel ?? "chat";
      channelBreakdown[ch] = (channelBreakdown[ch] ?? 0) + 1;
    }

    // Language breakdown
    const languageBreakdown: Record<string, number> = {};
    for (const ticket of recentTickets ?? []) {
      const lang = ticket.language ?? "fr";
      languageBreakdown[lang] = (languageBreakdown[lang] ?? 0) + 1;
    }

    // Calculate average response time from resolved tickets
    const resolvedTickets = (recentTickets ?? []).filter((t) => t.resolved_at);
    let avgResponseTimeMinutes: number | null = null;
    if (resolvedTickets.length > 0) {
      const totalMinutes = resolvedTickets.reduce((sum, t) => {
        const created = new Date(t.created_at).getTime();
        const resolved = new Date(t.resolved_at!).getTime();
        return sum + (resolved - created) / 60000;
      }, 0);
      avgResponseTimeMinutes = Math.round(totalMinutes / resolvedTickets.length);
    }

    return apiSuccess({
      summary: {
        open: openRes.count ?? 0,
        in_progress: inProgressRes.count ?? 0,
        resolved: resolvedRes.count ?? 0,
        closed: closedRes.count ?? 0,
        total:
          (openRes.count ?? 0) +
          (inProgressRes.count ?? 0) +
          (resolvedRes.count ?? 0) +
          (closedRes.count ?? 0),
        avg_satisfaction: avgSatisfaction ? Math.round(avgSatisfaction * 10) / 10 : null,
        avg_response_time_minutes: avgResponseTimeMinutes,
      },
      channel_breakdown: channelBreakdown,
      language_breakdown: languageBreakdown,
      recent_tickets: recentTickets ?? [],
    });
  },
  ["super_admin", "clinic_admin", "receptionist"],
);
