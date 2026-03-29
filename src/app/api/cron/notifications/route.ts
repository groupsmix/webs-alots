import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { processNotificationQueue } from "@/lib/notification-queue";
import { logger } from "@/lib/logger";

/**
 * GET /api/cron/notifications
 *
 * Processes the notification queue — delivers pending WhatsApp/SMS messages
 * with retry and exponential backoff.
 *
 * Called by the Cloudflare Worker scheduled handler every 5 minutes.
 * Protected by CRON_SECRET via Authorization: Bearer header.
 */
export async function GET(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  try {
    const result = await processNotificationQueue();

    return NextResponse.json({
      message: "Notification queue processed",
      ...result,
    });
  } catch (err) {
    logger.error("Notification queue cron failed", {
      context: "cron/notifications",
      error: err,
    });
    return NextResponse.json(
      { error: "Failed to process notification queue" },
      { status: 500 },
    );
  }
}
