/**
 * POST /api/ai/revenue-insights
 *
 * AI-powered revenue insights — natural language queries about finances.
 * Returns AI-generated answers based on the clinic's billing data.
 *
 * - Uses OpenAI-compatible API (configurable via OPENAI_BASE_URL)
 * - Read-only: never writes or modifies data
 * - Admin-only access
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";
import { resolveAIConfig } from "@/lib/ai/config";
import { getAIDisclaimer } from "@/lib/ai-disclaimer";
import { apiSuccess, apiError, apiInternalError, apiRateLimited } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { invoicesTable, paymentPlansTable } from "@/lib/billing-db";
import { logger } from "@/lib/logger";
import { aiGenerationLimiter } from "@/lib/rate-limit";
import type { Database } from "@/lib/types/database";
import { formatCurrency } from "@/lib/utils";
import { revenueInsightsQuerySchema } from "@/lib/validations/billing";

const ADMIN_ROLES = ["super_admin", "clinic_admin"] as const;

async function fetchFinancialContext(supabase: SupabaseClient<Database>, clinicId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  // nosemgrep: semgrep.tenant-scoping
  const [
    paidThisMonth,
    paidLastMonth,
    outstandingInvoices,
    overdueInvoices,
    activePlans,
    recentPaid,
  ] = await Promise.all([
    invoicesTable(supabase)
      .select("total_centimes, amount_paid_centimes, payment_method") // nosemgrep: semgrep.tenant-scoping
      .eq("clinic_id", clinicId)
      .eq("status", "paid")
      .gte("paid_at", startOfMonth.toISOString()),

    invoicesTable(supabase)
      .select("total_centimes, amount_paid_centimes, payment_method") // nosemgrep: semgrep.tenant-scoping
      .eq("clinic_id", clinicId)
      .eq("status", "paid")
      .gte("paid_at", startOfLastMonth.toISOString())
      .lte("paid_at", endOfLastMonth.toISOString()),

    invoicesTable(supabase)
      .select("total_centimes, amount_paid_centimes", { count: "exact" }) // nosemgrep: semgrep.tenant-scoping
      .eq("clinic_id", clinicId)
      .in("status", ["sent", "partially_paid"]),

    invoicesTable(supabase)
      .select("total_centimes, amount_paid_centimes", { count: "exact" }) // nosemgrep: semgrep.tenant-scoping
      .eq("clinic_id", clinicId)
      .eq("status", "overdue"),

    paymentPlansTable(supabase)
      .select("id, total_centimes", { count: "exact" }) // nosemgrep: semgrep.tenant-scoping
      .eq("clinic_id", clinicId)
      .eq("status", "active"),

    invoicesTable(supabase)
      .select("total_centimes, payment_method, paid_at, invoice_number") // nosemgrep: semgrep.tenant-scoping
      .eq("clinic_id", clinicId)
      .eq("status", "paid")
      .order("paid_at", { ascending: false })
      .limit(10),
  ]);

  const sumCentimes = (items: { amount_paid_centimes: number }[] | null) =>
    (items ?? []).reduce((s, i) => s + i.amount_paid_centimes, 0);

  const outstandingTotal = (outstandingInvoices.data ?? []).reduce(
    (s: number, i: { total_centimes: number; amount_paid_centimes: number }) =>
      s + (i.total_centimes - i.amount_paid_centimes),
    0,
  );

  const overdueTotal = (overdueInvoices.data ?? []).reduce(
    (s: number, i: { total_centimes: number; amount_paid_centimes: number }) =>
      s + (i.total_centimes - i.amount_paid_centimes),
    0,
  );

  const methodBreakdown: Record<string, number> = {};
  for (const inv of paidThisMonth.data ?? []) {
    const m = (inv as { payment_method: string | null }).payment_method ?? "other";
    methodBreakdown[m] =
      (methodBreakdown[m] ?? 0) + (inv as { amount_paid_centimes: number }).amount_paid_centimes;
  }

  return {
    revenueThisMonth: sumCentimes(paidThisMonth.data),
    revenueLastMonth: sumCentimes(paidLastMonth.data),
    invoicesPaidThisMonth: paidThisMonth.data?.length ?? 0,
    outstandingTotal,
    outstandingCount: outstandingInvoices.count ?? 0,
    overdueTotal,
    overdueCount: overdueInvoices.count ?? 0,
    activePlansCount: activePlans.count ?? 0,
    activePlansTotal: (activePlans.data ?? []).reduce(
      (s: number, p: { total_centimes: number }) => s + p.total_centimes,
      0,
    ),
    methodBreakdown,
    recentPayments: (recentPaid.data ?? []).map((p: Record<string, unknown>) => ({
      amount: formatCurrency((p.total_centimes as number) / 100, "fr", "MAD"),
      method: (p.payment_method as string | null) ?? "unknown",
      date: p.paid_at as string,
      invoice: p.invoice_number as string,
    })),
  };
}

export const POST = withAuthValidation(
  revenueInsightsQuerySchema,
  async (body, _request: NextRequest, { supabase, profile }) => {
    const clinicId = profile.clinic_id;
    if (!clinicId) return apiError("Clinic context required", 403);

    // AUDIT P1-10: per-user daily cap — this route calls a paid LLM
    const allowed = await aiGenerationLimiter.check(`ai-revenue-insights:${profile.id}`);
    if (!allowed) {
      return apiRateLimited("Limite quotidienne IA atteinte. Réessayez demain.");
    }

    const { question } = body;

    const aiResult = await resolveAIConfig();
    if (!aiResult.ok) {
      return apiError(aiResult.reason, aiResult.statusCode);
    }
    const { config: aiConfig } = aiResult;

    const ctx = await fetchFinancialContext(supabase, clinicId);

    const fmtMAD = (centimes: number) => formatCurrency(centimes / 100, "fr", "MAD");

    const systemPrompt = `You are a financial analyst assistant for a Moroccan healthcare clinic.
You answer questions about the clinic's revenue, invoices, payments, and financial health.
Always respond in the same language as the user's question.
Use MAD (Moroccan Dirham) for all currency values.
Be concise and actionable. Provide specific numbers when available.
Never reveal patient names or personal health information.

Current Financial Data:
- Revenue this month: ${fmtMAD(ctx.revenueThisMonth)} (${ctx.invoicesPaidThisMonth} invoices)
- Revenue last month: ${fmtMAD(ctx.revenueLastMonth)}
- Outstanding amount: ${fmtMAD(ctx.outstandingTotal)} (${ctx.outstandingCount} invoices)
- Overdue amount: ${fmtMAD(ctx.overdueTotal)} (${ctx.overdueCount} invoices)
- Active payment plans: ${ctx.activePlansCount} (total: ${fmtMAD(ctx.activePlansTotal)})
- Payment methods this month: ${JSON.stringify(Object.fromEntries(Object.entries(ctx.methodBreakdown).map(([k, v]) => [k, fmtMAD(v)])))}
- Recent payments: ${JSON.stringify(ctx.recentPayments)}`;

    try {
      const response = await fetch(`${aiConfig.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${aiConfig.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: aiConfig.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: question },
          ],
          max_tokens: 800,
          temperature: 0.3,
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        logger.error("AI API request failed", {
          context: "ai/revenue-insights",
          status: response.status,
        });
        return apiInternalError("AI service unavailable");
      }

      const data = await response.json();
      const answer = data.choices?.[0]?.message?.content ?? "No response generated.";
      const disclaimer = getAIDisclaimer("fr");

      await logAuditEvent({
        supabase,
        action: "ai.revenue_insights",
        type: "admin",
        clinicId,
        actor: profile.id,
        description: "AI revenue insights query",
        metadata: { question_length: question.length },
      });

      return apiSuccess({
        answer,
        disclaimer,
        context: {
          revenue_this_month_centimes: ctx.revenueThisMonth,
          revenue_last_month_centimes: ctx.revenueLastMonth,
          outstanding_centimes: ctx.outstandingTotal,
          overdue_centimes: ctx.overdueTotal,
        },
        aiGenerated: true,
      });
    } catch (err) {
      logger.error("AI revenue insights failed", {
        context: "ai/revenue-insights",
        error: err,
      });
      return apiInternalError("Failed to generate AI insights");
    }
  },
  [...ADMIN_ROLES],
);
