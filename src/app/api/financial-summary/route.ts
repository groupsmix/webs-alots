import { type NextRequest, NextResponse } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { validateQuery } from "@/lib/api-validate";
import { invoicesTable, paymentPlansTable, paymentPlanInstallmentsTable } from "@/lib/billing-db";
import { logger } from "@/lib/logger";
import { financialSummaryQuerySchema } from "@/lib/validations/billing";
import { withAuth } from "@/lib/with-auth";

const ADMIN_ROLES = ["super_admin", "clinic_admin"] as const;

/**
 * GET /api/financial-summary
 * Financial dashboard data: revenue, outstanding, payment method breakdown, trends.
 * Admin-only endpoint.
 */
export const GET = withAuth(
  async (request: NextRequest, { supabase, profile }) => {
    const clinicId = profile.clinic_id;
    if (!clinicId) return apiError("Clinic context required", 403);

    const parsed = validateQuery(financialSummaryQuerySchema, request);
    if (parsed instanceof NextResponse) return parsed;
    const { period = "month", start_date, end_date } = parsed.data;
    const now = new Date();

    let startDate: string;
    let endDate: string;

    if (start_date && end_date) {
      startDate = start_date;
      endDate = end_date;
    } else {
      endDate = now.toISOString().slice(0, 10);
      switch (period) {
        case "week": {
          const d = new Date(now);
          d.setDate(d.getDate() - 7);
          startDate = d.toISOString().slice(0, 10);
          break;
        }
        case "quarter": {
          const d = new Date(now);
          d.setMonth(d.getMonth() - 3);
          startDate = d.toISOString().slice(0, 10);
          break;
        }
        case "year": {
          const d = new Date(now);
          d.setFullYear(d.getFullYear() - 1);
          startDate = d.toISOString().slice(0, 10);
          break;
        }
        case "month":
        default: {
          const d = new Date(now);
          d.setMonth(d.getMonth() - 1);
          startDate = d.toISOString().slice(0, 10);
          break;
        }
      }
    }

    // nosemgrep: semgrep.tenant-scoping
    const { data: paidInvoices, error: paidError } = await invoicesTable(supabase)
      .select("total_centimes, amount_paid_centimes, payment_method, paid_at") // nosemgrep: semgrep.tenant-scoping
      .eq("clinic_id", clinicId)
      .eq("status", "paid")
      .gte("paid_at", `${startDate}T00:00:00`)
      .lte("paid_at", `${endDate}T23:59:59`);

    if (paidError) {
      logger.error("Failed to fetch revenue", {
        context: "financial-summary/revenue",
        error: paidError,
      });
      return apiError("Failed to fetch revenue data", 500);
    }

    const totalRevenue = (paidInvoices ?? []).reduce(
      (sum: number, inv: { amount_paid_centimes: number }) => sum + inv.amount_paid_centimes,
      0,
    );

    // nosemgrep: semgrep.tenant-scoping
    const { data: outstandingInvoices, error: outstandingError } = await invoicesTable(supabase)
      .select("total_centimes, amount_paid_centimes") // nosemgrep: semgrep.tenant-scoping
      .eq("clinic_id", clinicId)
      .in("status", ["sent", "overdue", "partially_paid"]);

    if (outstandingError) {
      logger.error("Failed to fetch outstanding", {
        context: "financial-summary/outstanding",
        error: outstandingError,
      });
      return apiError("Failed to fetch outstanding data", 500);
    }

    const totalOutstanding = (outstandingInvoices ?? []).reduce(
      (sum: number, inv: { total_centimes: number; amount_paid_centimes: number }) =>
        sum + (inv.total_centimes - inv.amount_paid_centimes),
      0,
    );

    const methodBreakdown: Record<string, number> = {};
    for (const inv of paidInvoices ?? []) {
      const method = (inv as { payment_method: string | null }).payment_method ?? "other";
      methodBreakdown[method] =
        (methodBreakdown[method] ?? 0) +
        (inv as { amount_paid_centimes: number }).amount_paid_centimes;
    }

    // nosemgrep: semgrep.tenant-scoping
    const { data: allInvoices, error: allError } = await invoicesTable(supabase)
      .select("status") // nosemgrep: semgrep.tenant-scoping
      .eq("clinic_id", clinicId);

    if (allError) {
      logger.error("Failed to fetch status counts", {
        context: "financial-summary/status-counts",
        error: allError,
      });
      return apiError("Failed to fetch status data", 500);
    }

    const statusCounts: Record<string, number> = {};
    for (const inv of allInvoices ?? []) {
      const s = (inv as { status: string }).status;
      statusCounts[s] = (statusCounts[s] ?? 0) + 1;
    }

    // Monthly trends (last 6 months)
    const trends: { month: string; revenue_centimes: number; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i);
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);

      // nosemgrep: semgrep.tenant-scoping
      const { data: monthInvoices } = await invoicesTable(supabase)
        .select("amount_paid_centimes") // nosemgrep: semgrep.tenant-scoping
        .eq("clinic_id", clinicId)
        .eq("status", "paid")
        .gte("paid_at", `${monthStart}T00:00:00`)
        .lte("paid_at", `${monthEnd}T23:59:59`);

      const monthRevenue = (monthInvoices ?? []).reduce(
        (sum: number, inv: { amount_paid_centimes: number }) => sum + inv.amount_paid_centimes,
        0,
      );

      trends.push({
        month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        revenue_centimes: monthRevenue,
        count: monthInvoices?.length ?? 0,
      });
    }

    // nosemgrep: semgrep.tenant-scoping
    const { count: activePlansCount } = await paymentPlansTable(supabase)
      .select("id", { count: "exact", head: true }) // nosemgrep: semgrep.tenant-scoping
      .eq("clinic_id", clinicId)
      .eq("status", "active");

    // nosemgrep: semgrep.tenant-scoping
    const { data: overdueInstallments } = await paymentPlanInstallmentsTable(supabase)
      .select("amount_centimes") // nosemgrep: semgrep.tenant-scoping
      .eq("clinic_id", clinicId)
      .eq("status", "overdue");

    const overdueInstallmentTotal = (overdueInstallments ?? []).reduce(
      (sum: number, inst: { amount_centimes: number }) => sum + inst.amount_centimes,
      0,
    );

    return apiSuccess({
      period: { start_date: startDate, end_date: endDate },
      revenue: {
        total_centimes: totalRevenue,
        invoice_count: paidInvoices?.length ?? 0,
      },
      outstanding: {
        total_centimes: totalOutstanding,
        invoice_count: outstandingInvoices?.length ?? 0,
      },
      payment_method_breakdown: methodBreakdown,
      status_counts: statusCounts,
      trends,
      payment_plans: {
        active_count: activePlansCount ?? 0,
        overdue_installment_total_centimes: overdueInstallmentTotal,
      },
    });
  },
  [...ADMIN_ROLES],
);
