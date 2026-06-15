import { apiInternalError, apiSuccess } from "@/lib/api-response";
import { createClient } from "@/lib/supabase-server";
import { withAuth } from "@/lib/with-auth";

interface WebhookRow {
  status: string;
}

interface NotificationRow {
  status: string;
  next_attempt_at: string | null;
}

export const GET = withAuth(async () => {
  try {
    const supabase = await createClient();

    // 1. Webhooks
    // prettier-ignore
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const webhooksResult = await supabase.from("webhook_retry_queue" as any).select("status").in("status", ["pending", "failed"]);
    const webhooks = (webhooksResult.data ?? null) as WebhookRow[] | null;

    let webhooksPending = 0;
    let webhooksFailed = 0;

    if (webhooks) {
      for (const w of webhooks) {
        if (w.status === "pending") webhooksPending++;
        else if (w.status === "failed") webhooksFailed++;
      }
    }

    // 2. Notifications
    // prettier-ignore
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const notificationsResult = await supabase.from("notification_queue" as any).select("status, next_attempt_at").in("status", ["pending", "failed"]);
    const notifications = (notificationsResult.data ?? null) as NotificationRow[] | null;

    let notificationsPending = 0;
    let notificationsFailed = 0;
    let notificationsDeadLettered = 0;

    if (notifications) {
      for (const n of notifications) {
        if (n.status === "pending") notificationsPending++;
        else if (n.status === "failed") {
          if (n.next_attempt_at?.startsWith("9999")) {
            notificationsDeadLettered++;
          } else {
            notificationsFailed++;
          }
        }
      }
    }

    return apiSuccess({
      webhooks: {
        pending: webhooksPending,
        failed: webhooksFailed,
      },
      notifications: {
        pending: notificationsPending,
        failed: notificationsFailed,
        deadLettered: notificationsDeadLettered,
      },
    });
  } catch (_error) {
    return apiInternalError("Failed to load jobs data");
  }
}, ["super_admin"]);
