import { apiInternalError, apiSuccess } from "@/lib/api-response";
import { createClient } from "@/lib/supabase-server";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async () => {
  try {
    const supabase = await createClient();

    // 1. Webhooks
    const { data: webhooks } = await supabase
      .from("webhook_retry_queue")
      .select("status")
      .in("status", ["pending", "failed"]);

    let webhooksPending = 0;
    let webhooksFailed = 0;

    if (webhooks) {
      for (const w of webhooks) {
        if (w.status === "pending") webhooksPending++;
        else if (w.status === "failed") webhooksFailed++;
      }
    }

    // 2. Notifications
    const { data: notifications } = await supabase
      .from("notification_queue")
      .select("status, next_attempt_at")
      .in("status", ["pending", "failed"]);

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
      }
    });
  } catch (_error) {
    return apiInternalError("Failed to load jobs data");
  }
}, ["super_admin"]);
