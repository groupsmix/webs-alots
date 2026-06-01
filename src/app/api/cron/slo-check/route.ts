import { NextRequest } from "next/server";
import { apiSuccess, apiInternalError } from "@/lib/api-response";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { checkBurnRate } from "@/lib/observability/slo";

/**
 * GET /api/cron/slo-check
 * Evaluates SLO burn rate and triggers alerts if the error budget is being
 * consumed too quickly.
 */
export async function GET(request: NextRequest) {
  // CRON endpoint protection
  const cronDenied = verifyCronSecret(request);
  if (cronDenied) return cronDenied;

  try {
    const status1h = await checkBurnRate("1h");
    const status6h = await checkBurnRate("6h");

    if (status1h.isAlerting || status6h.isAlerting) {
      logger.error("SLO Burn Rate Alert Triggered", {
        context: "cron/slo-check",
        status1h,
        status6h,
      });

      // Integrate with Sentry or PagerDuty here
      try {
        const Sentry = await import("@sentry/nextjs");
        Sentry.captureMessage("SLO Burn Rate Alert", {
          level: "fatal",
          extra: { status1h, status6h },
          tags: { component: "slo-monitor" },
        });
      } catch {
        // Sentry not available
      }
    }

    return apiSuccess({
      ok: true,
      message: "SLO check completed",
      data: { status1h, status6h },
    });
  } catch (err) {
    logger.error("SLO check cron failed", {
      context: "cron/slo-check",
      error: err,
    });
    return apiInternalError("SLO check failed");
  }
}
