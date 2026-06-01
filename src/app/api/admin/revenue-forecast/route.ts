import { NextRequest } from "next/server";
import { apiSuccess, apiError, apiInternalError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { forecastRevenue, type MonthlyRevenue } from "@/lib/predictive/revenue-forecast";
import { withAuth } from "@/lib/with-auth";
import type { AuthContext } from "@/lib/with-auth";

/**
 * GET /api/admin/revenue-forecast?months=3
 *
 * Generates a revenue forecast for the clinic based on historical appointment and billing data.
 * Auth: clinic_admin and super_admin only.
 */
async function handler(req: NextRequest, auth: AuthContext) {
  const { searchParams } = new URL(req.url);
  const monthsAheadParam = searchParams.get("months") || "3";
  const monthsAhead = parseInt(monthsAheadParam, 10) || 3;

  const { supabase, profile } = auth;
  const clinicId = profile.clinic_id;

  if (!clinicId) {
    return apiError("No clinic associated with this account", 403, "NO_CLINIC");
  }

  try {
    // 1. Fetch historical revenue data (last 12 months)
    // We assume there's a billing/payments table or we aggregate from appointments
    // For this implementation, we will query appointments that were paid/completed

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    twelveMonthsAgo.setDate(1); // Start of month

    const { data: appointments, error } = await supabase
      .from("appointments")
      .select("start_time, status")
      .eq("clinic_id", clinicId)
      .in("status", ["completed", "paid"])
      .gte("start_time", twelveMonthsAgo.toISOString())
      .order("start_time", { ascending: true });

    if (error) {
      throw error;
    }

    // 2. Aggregate into MonthlyRevenue format
    // Real implementation would join with billing tables to get exact MAD amounts.
    // Here we use a simplified approximation based on appointment counts and average cost
    // or standard consultation fee (e.g., 200 MAD).
    const monthlyMap = new Map<string, number>();

    // Initialize last 12 months with 0
    for (let i = 0; i < 12; i++) {
      const d = new Date(twelveMonthsAgo);
      d.setMonth(d.getMonth() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthlyMap.set(key, 0);
    }

    const AVERAGE_CONSULTATION_FEE = 200; // MAD

    if (appointments) {
      for (const apt of appointments) {
        // start_time is nullable in the schema — skip rows without one
        // rather than feeding `new Date(null)` (which yields Invalid Date).
        if (!apt.start_time) continue;
        const d = new Date(apt.start_time);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (monthlyMap.has(key)) {
          monthlyMap.set(key, monthlyMap.get(key)! + AVERAGE_CONSULTATION_FEE);
        }
      }
    }

    const history: MonthlyRevenue[] = Array.from(monthlyMap.entries())
      .map(([month, revenue]) => ({ month, revenue }))
      .sort((a, b) => a.month.localeCompare(b.month)); // Ensure chronological order

    // 3. Generate forecast
    const forecast = forecastRevenue(history, Math.min(monthsAhead, 12));

    return apiSuccess({
      history,
      forecast,
    });
  } catch (err) {
    logger.error("Failed to generate revenue forecast", {
      context: "api/admin/revenue-forecast",
      error: err instanceof Error ? err.message : String(err),
      clinicId,
    });
    return apiInternalError("Failed to calculate revenue forecast");
  }
}

export const GET = withAuth(handler, ["clinic_admin", "super_admin"]);
