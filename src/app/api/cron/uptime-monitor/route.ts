import { NextRequest } from "next/server";
import { apiSuccess, apiInternalError } from "@/lib/api-response";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { withSentryCron } from "@/lib/sentry-cron";
import { sendTextMessage } from "@/lib/whatsapp";

const HEALTH_ENDPOINT =
  process.env.HEALTH_CHECK_URL ??
  `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/health`;

const ALERT_PHONE = process.env.UPTIME_ALERT_PHONE ?? "";

interface HealthPayload {
  ok: boolean;
  data?: {
    status: "healthy" | "degraded" | "unhealthy";
    checks: Record<string, { status: string; error?: string }>;
    timestamp: string;
  };
}

/**
 * GET /api/cron/uptime-monitor
 *
 * Pings the /api/health endpoint every 5 minutes.
 * If the health status is degraded or unhealthy, sends a WhatsApp alert
 * to the configured UPTIME_ALERT_PHONE number.
 *
 * Protected by CRON_SECRET via Authorization: Bearer header.
 */
async function handler(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  try {
    const start = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    let response: Response;
    try {
      response = await fetch(HEALTH_ENDPOINT, {
        signal: controller.signal,
        headers: { "User-Agent": "Oltigo-Uptime-Monitor/1.0" },
      });
    } catch (fetchError) {
      clearTimeout(timeout);
      const latency = Date.now() - start;
      logger.error("Uptime monitor: health endpoint unreachable", {
        context: "uptime-monitor",
        latency,
        error: fetchError,
      });

      await sendAlert(
        "unhealthy",
        `Health endpoint unreachable (${latency}ms). Error: ${fetchError instanceof Error ? fetchError.message : "unknown"}`,
      );

      return apiSuccess({
        status: "unhealthy",
        latencyMs: latency,
        alertSent: !!ALERT_PHONE,
        error: "Health endpoint unreachable",
      });
    }

    clearTimeout(timeout);
    const latency = Date.now() - start;

    let healthData: HealthPayload | null = null;
    try {
      healthData = (await response.json()) as HealthPayload;
    } catch {
      logger.warn("Uptime monitor: failed to parse health response", {
        context: "uptime-monitor",
        statusCode: response.status,
      });
    }

    const healthStatus = healthData?.data?.status ?? (response.ok ? "healthy" : "unhealthy");
    const isDegraded = healthStatus === "degraded" || healthStatus === "unhealthy";

    logger.info("Uptime monitor check completed", {
      context: "uptime-monitor",
      status: healthStatus,
      latencyMs: latency,
      httpStatus: response.status,
    });

    if (isDegraded) {
      const failedChecks = healthData?.data?.checks
        ? Object.entries(healthData.data.checks)
            .filter(([, v]) => v.status !== "ok")
            .map(([k, v]) => `${k}: ${v.error ?? v.status}`)
            .join(", ")
        : `HTTP ${response.status}`;

      await sendAlert(healthStatus, `Latency: ${latency}ms. Issues: ${failedChecks}`);
    }

    return apiSuccess({
      status: healthStatus,
      latencyMs: latency,
      httpStatus: response.status,
      alertSent: isDegraded && !!ALERT_PHONE,
    });
  } catch (err) {
    logger.error("Uptime monitor failed", {
      context: "uptime-monitor",
      error: err,
    });
    return apiInternalError();
  }
}

async function sendAlert(status: string, details: string): Promise<void> {
  if (!ALERT_PHONE) {
    logger.warn("Uptime monitor: UPTIME_ALERT_PHONE not configured, skipping WhatsApp alert", {
      context: "uptime-monitor",
    });
    return;
  }

  const message =
    `⚠️ Oltigo Health — Service ${status.toUpperCase()}\n\n` +
    `${details}\n\n` +
    `Time: ${new Date().toISOString()}\n` +
    `Endpoint: ${HEALTH_ENDPOINT}`;

  try {
    const result = await sendTextMessage(ALERT_PHONE, message);
    if (!result.success) {
      logger.error("Uptime monitor: WhatsApp alert failed", {
        context: "uptime-monitor",
        error: result.error,
      });
    }
  } catch (err) {
    logger.error("Uptime monitor: WhatsApp alert exception", {
      context: "uptime-monitor",
      error: err,
    });
  }
}

export const GET = withSentryCron("uptime-monitor", "*/5 * * * *", handler);
