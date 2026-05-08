import { NextRequest } from "next/server";
import { apiInternalError, apiSuccess } from "@/lib/api-response";
import { verifyCronSecret } from "@/lib/cron-auth";
import { withCronInfrastructure } from "@/lib/cron-infrastructure";
import { logger } from "@/lib/logger";
import { processNotificationQueue } from "@/lib/notification-queue";
import { withSentryCron } from "@/lib/sentry-cron";

/**
 * GET /api/cron/notifications
 *
 * Processes the notification queue — delivers pending WhatsApp/SMS messages
 * with retry and exponential backoff.
 *
 * Called by the Cloudflare Worker scheduled handler every 15 minutes.
 * Protected by CRON_SECRET via Authorization: Bearer header.
 *
 * A43: Includes idempotency locks, DLQ tracking, and retry logic.
 */
async function handler(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  // A43: Wrap handler with cron infrastructure (idempotency, DLQ, retry)
  return withCronInfrastructure("notifications", async () => {
    const result = await processNotificationQueue();

    return apiSuccess({
      message: "Notification queue processed",
      ...result,
    });
  });
}

export const GET = withSentryCron("notifications-every-15m", "*/15 * * * *", handler);
