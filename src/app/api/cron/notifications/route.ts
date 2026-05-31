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
 * Called by the Cloudflare Worker scheduled handler every 15 minutes.
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

// A76-F2: The notification queue is the primary delivery mechanism. The 15-minute
// cron is a recovery sweep for items that missed their delivery window (e.g. a
// Worker was restarted mid-delivery). It MUST NOT duplicate work done by the
// inline queue processor. The queue's built-in idempotency check (status='sent')
// prevents double-delivery as long as items are marked before the next sweep.
//
// If the reminders cron also directly calls sendInteractiveMessage, that path
// bypasses this queue entirely — the reminders cron should be migrated to use
// enqueueNotification() for WhatsApp so this cron remains the sole delivery path.
export const GET = withSentryCron("notifications-every-15m", "*/15 * * * *", handler);
