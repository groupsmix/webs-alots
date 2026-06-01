import { logger } from "@/lib/logger";

export type SLOStatus = {
  window: "1h" | "6h" | "1d";
  errorRate: number;
  burnRate: number;
  isAlerting: boolean;
};

/**
 * Check the SLO burn rate over a specific window.
 * In a real-world scenario, this would query Sentry, Datadog, or
 * another observability platform for the actual error rates.
 *
 * For now, this is a stub that allows us to hook up the alerting logic.
 */
export async function checkBurnRate(window: "1h" | "6h" | "1d"): Promise<SLOStatus> {
  // MOCK: In production, query observability backend.
  // We simulate a healthy burn rate here.
  const errorRate = 0.0005; // 0.05% error rate
  const targetErrorRate = 0.001; // 99.9% availability target (0.1% error budget)
  
  // Burn rate is how fast the error budget is being consumed relative to the target.
  // e.g., if error rate is 0.5% and target is 0.1%, burn rate is 5.
  const burnRate = errorRate / targetErrorRate;

  // Alert if burn rate is > 5 over a 1h window (fast burn)
  let isAlerting = false;
  if (window === "1h" && burnRate > 5) {
    isAlerting = true;
  } else if (window === "6h" && burnRate > 2) {
    isAlerting = true;
  } else if (window === "1d" && burnRate > 1) {
    isAlerting = true;
  }

  logger.info("SLO Burn Rate Check", {
    context: "observability/slo",
    window,
    errorRate,
    burnRate,
    isAlerting,
  });

  return { window, errorRate, burnRate, isAlerting };
}
