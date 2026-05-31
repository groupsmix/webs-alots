/**
 * Financial reporting and aggregation.
 *
 * Generates revenue reports, expense tracking, and accounts receivable
 * aging — all scoped by clinic_id.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FinancialReportQuery {
  clinicId: string;
  startDate: string;
  endDate: string;
}

export interface RevenueBreakdown {
  consultations: number;
  procedures: number;
  pharmacy: number;
  other: number;
  total: number;
}

export interface AccountsReceivableEntry {
  patientId: string;
  patientName: string;
  amountOwed: number;
  daysPastDue: number;
  agingBucket: "current" | "30_days" | "60_days" | "90_plus";
}

export interface FinancialSummary {
  period: { start: string; end: string };
  currency: string;
  revenue: RevenueBreakdown;
  totalPayments: number;
  outstandingBalance: number;
  accountsReceivable: AccountsReceivableEntry[];
}

// ─── Implementation ──────────────────────────────────────────────────────────

export async function getFinancialReport(
  supabase: SupabaseClient<Database>,
  query: FinancialReportQuery,
): Promise<FinancialSummary> {
  const { clinicId, startDate, endDate } = query;

  const [revenue, receivable] = await Promise.all([
    computeRevenue(supabase, clinicId, startDate, endDate),
    computeAccountsReceivable(supabase, clinicId),
  ]);

  const outstandingBalance = receivable.reduce((sum, r) => sum + r.amountOwed, 0);

  return {
    period: { start: startDate, end: endDate },
    currency: "MAD",
    revenue,
    totalPayments: revenue.total,
    outstandingBalance,
    accountsReceivable: receivable,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function computeRevenue(
  supabase: SupabaseClient<Database>,
  clinicId: string,
  startDate: string,
  endDate: string,
): Promise<RevenueBreakdown> {
  const { data } = await supabase
    .from("payments")
    .select("amount, payment_type")
    .eq("clinic_id", clinicId)
    .eq("status", "paid")
    .gte("created_at", startDate)
    .lte("created_at", endDate);

  const payments = data ?? [];

  const breakdown: RevenueBreakdown = {
    consultations: 0,
    procedures: 0,
    pharmacy: 0,
    other: 0,
    total: 0,
  };

  for (const p of payments) {
    const amount = p.amount ?? 0;
    const paymentType = (p.payment_type as string) ?? "other";

    switch (paymentType) {
      case "consultation":
        breakdown.consultations += amount;
        break;
      case "procedure":
        breakdown.procedures += amount;
        break;
      case "pharmacy":
        breakdown.pharmacy += amount;
        break;
      default:
        breakdown.other += amount;
    }
    breakdown.total += amount;
  }

  return breakdown;
}

async function computeAccountsReceivable(
  supabase: SupabaseClient<Database>,
  clinicId: string,
): Promise<AccountsReceivableEntry[]> {
  const { data } = await supabase
    .from("payments")
    .select("patient_id, amount, created_at")
    .eq("clinic_id", clinicId)
    .eq("status", "pending");

  if (!data || data.length === 0) return [];

  const now = Date.now();
  const entries: AccountsReceivableEntry[] = [];

  for (const p of data) {
    if (!p.patient_id) continue;
    const daysPastDue = Math.floor((now - new Date(p.created_at ?? "").getTime()) / 86_400_000);
    const agingBucket: AccountsReceivableEntry["agingBucket"] =
      daysPastDue <= 0
        ? "current"
        : daysPastDue <= 30
          ? "30_days"
          : daysPastDue <= 60
            ? "60_days"
            : "90_plus";

    entries.push({
      patientId: p.patient_id as string,
      patientName: "",
      amountOwed: (p.amount as number) ?? 0,
      daysPastDue: Math.max(0, daysPastDue),
      agingBucket,
    });
  }

  return entries;
}
