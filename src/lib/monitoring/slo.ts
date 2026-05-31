/**
 * SLO and error budget tracking.
 *
 * Defines service-level objectives, calculates error budgets,
 * and provides burn rate alerts.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SLODefinition {
  id: string;
  name: string;
  target: number;
  windowDays: number;
  metric: string;
  description: string;
}

export interface ErrorBudget {
  sloId: string;
  sloName: string;
  target: number;
  currentSLI: number;
  totalRequests: number;
  failedRequests: number;
  budgetTotal: number;
  budgetConsumed: number;
  budgetRemaining: number;
  budgetRemainingPercent: number;
  burnRate: number;
  isExhausted: boolean;
}

export interface BurnRateAlert {
  sloId: string;
  severity: "critical" | "warning";
  burnRate: number;
  shortWindowMinutes: number;
  longWindowMinutes: number;
  shouldAlert: boolean;
}

// ─── Default SLOs ────────────────────────────────────────────────────────────

export const DEFAULT_SLOS: SLODefinition[] = [
  {
    id: "api-availability",
    name: "API Availability",
    target: 0.999,
    windowDays: 30,
    metric: "api.requests.success_rate",
    description: "99.9% of API requests return non-5xx responses",
  },
  {
    id: "api-latency",
    name: "API Latency (P95 < 1s)",
    target: 0.95,
    windowDays: 30,
    metric: "api.requests.latency_under_1s_rate",
    description: "95% of API requests complete within 1 second",
  },
  {
    id: "booking-success",
    name: "Booking Success Rate",
    target: 0.995,
    windowDays: 30,
    metric: "booking.success_rate",
    description: "99.5% of booking attempts succeed without error",
  },
  {
    id: "notification-delivery",
    name: "Notification Delivery",
    target: 0.99,
    windowDays: 30,
    metric: "notification.delivery_rate",
    description: "99% of notifications delivered within 5 minutes",
  },
];

// ─── Implementation ──────────────────────────────────────────────────────────

export function calculateErrorBudget(
  slo: SLODefinition,
  totalRequests: number,
  failedRequests: number,
): ErrorBudget {
  const currentSLI = totalRequests > 0 ? 1 - failedRequests / totalRequests : 1;
  const budgetTotal = Math.floor(totalRequests * (1 - slo.target));
  const budgetConsumed = failedRequests;
  const budgetRemaining = Math.max(0, budgetTotal - budgetConsumed);
  const budgetRemainingPercent = budgetTotal > 0 ? budgetRemaining / budgetTotal : 1;
  const burnRate = budgetTotal > 0 ? budgetConsumed / budgetTotal : 0;

  return {
    sloId: slo.id,
    sloName: slo.name,
    target: slo.target,
    currentSLI,
    totalRequests,
    failedRequests,
    budgetTotal,
    budgetConsumed,
    budgetRemaining,
    budgetRemainingPercent,
    burnRate,
    isExhausted: budgetRemaining <= 0,
  };
}

export function checkBurnRate(
  slo: SLODefinition,
  shortWindowFailureRate: number,
  longWindowFailureRate: number,
): BurnRateAlert {
  const allowedFailureRate = 1 - slo.target;

  const shortBurnRate = allowedFailureRate > 0 ? shortWindowFailureRate / allowedFailureRate : 0;
  const longBurnRate = allowedFailureRate > 0 ? longWindowFailureRate / allowedFailureRate : 0;

  const isCritical = shortBurnRate > 14 && longBurnRate > 14;
  const isWarning = shortBurnRate > 6 && longBurnRate > 6;

  return {
    sloId: slo.id,
    severity: isCritical ? "critical" : "warning",
    burnRate: longBurnRate,
    shortWindowMinutes: 5,
    longWindowMinutes: 60,
    shouldAlert: isCritical || isWarning,
  };
}
