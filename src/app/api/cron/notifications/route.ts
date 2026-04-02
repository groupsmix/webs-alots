import { NextRequest } from "next/server";
import { apiInternalError, apiSuccess } from "@/lib/api-response";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { processNotificationQueue } from "@/lib/notification-queue";
import { withSentryCron } from "@/lib/sentry-cron";

/**
 * GET /api/cron/notifications
 *
 * Processes the notification queue — delivers pending WhatsApp/SMS messages
 * with retry and exponential backoff.
 *
 * Called by the Cloudflare Worker scheduled handler every 5 minutes.
 * Protected by CRON_SECRET via Authorization: Bearer header.
 */
async function handler(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  try {
    const result = await processNotificationQueue();

    return apiSuccess({
      message: "Notification queue processed",
      ...result,
    });
  } catch (err) {
    logger.error("Notification queue cron failed", {
      context: "cron/notifications",
      error: err,
    });
    return apiInternalError("Failed to process notification queue");
  }
}

export const GET = withSentryCron("notifications-every-5m", "*/5 * * * *", handler);
