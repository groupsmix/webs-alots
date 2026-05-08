import { NextRequest } from "next/server";
import { apiSuccess, apiError, apiForbidden } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { drainAuditQueue } from "@/lib/cron/audit-archive";

/**
 * GET /api/cron/audit-archive
 *
 * F-A188: Cron endpoint that drains the audit_archive_queue to R2 (WORM).
 * Called by Cloudflare Cron Triggers every 5 minutes.
 *
 * Security: Requires CRON_SECRET header to prevent unauthorized triggering.
 */
export async function GET(request: NextRequest) {
  // Validate the cron secret — the Cloudflare Worker sends Authorization: Bearer
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const expectedAuth = cronSecret ? `Bearer ${cronSecret}` : null;

  if (!expectedAuth || authHeader !== expectedAuth) {
    logger.warn("Unauthorized audit-archive cron trigger attempt", {
      context: "cron/audit-archive",
    });
    return apiForbidden("Unauthorized");
  }

  try {
    const startMs = Date.now();
    const archived = await drainAuditQueue();
    const durationMs = Date.now() - startMs;

    logger.info("Audit archive cron completed", {
      context: "cron/audit-archive",
      archived,
      durationMs,
    });

    return apiSuccess({ archived, durationMs });
  } catch (err) {
    logger.error("Audit archive cron failed", {
      context: "cron/audit-archive",
      error: err,
    });
    return apiError("Audit archive failed", 500);
  }
}
