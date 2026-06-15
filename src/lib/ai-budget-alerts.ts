import * as Sentry from "@sentry/nextjs";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { clinicDateTime } from "@/lib/timezone";

const DEFAULT_AI_DAILY_BUDGET_USD = 100;

type AiUsageSupabase = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: boolean,
      ) => {
        gte: (
          column: string,
          value: string,
        ) => {
          lt: (
            column: string,
            value: string,
          ) => Promise<{
            data: Array<{ cost_cents?: number | null }> | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };
};

function getAiDailyBudgetUsd(): number {
  const raw = process.env.AI_DAILY_BUDGET_USD;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_AI_DAILY_BUDGET_USD;
}

function getCasablancaDateString(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DEFAULT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

function addOneDay(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  const nextYear = next.getUTCFullYear();
  const nextMonth = String(next.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(next.getUTCDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

export async function alertIfAiDailyBudgetExceeded(
  supabase: AiUsageSupabase,
  currentCostCents: number,
): Promise<void> {
  if (!Number.isFinite(currentCostCents) || currentCostCents <= 0) {
    return;
  }

  const today = getCasablancaDateString();
  const tomorrow = addOneDay(today);
  const start = clinicDateTime(today, "00:00", DEFAULT_TIMEZONE).toISOString();
  const end = clinicDateTime(tomorrow, "00:00", DEFAULT_TIMEZONE).toISOString();
  const budgetUsd = getAiDailyBudgetUsd();
  const budgetCents = Math.round(budgetUsd * 100);

  const { data, error } = await supabase
    .from("ai_usage_logs")
    .select("cost_cents")
    .eq("success", true)
    .gte("created_at", start)
    .lt("created_at", end);

  if (error) {
    logger.warn("Failed to compute daily AI spend for budget alerting", {
      context: "ai-budget-alerts",
      error: error.message,
      day: today,
    });
    return;
  }

  const totalCostCents =
    data?.reduce(
      (sum, row) => sum + (typeof row.cost_cents === "number" ? row.cost_cents : 0),
      0,
    ) ?? 0;

  const previousTotalCents = totalCostCents - currentCostCents;
  if (totalCostCents <= budgetCents || previousTotalCents > budgetCents) {
    return;
  }

  Sentry.captureMessage("AI daily budget exceeded", {
    level: "warning",
    tags: {
      area: "ai",
      alert_type: "budget",
    },
    extra: {
      date: today,
      timezone: DEFAULT_TIMEZONE,
      totalCostUsd: totalCostCents / 100,
      budgetUsd,
      currentRequestCostUsd: currentCostCents / 100,
    },
  });
}
