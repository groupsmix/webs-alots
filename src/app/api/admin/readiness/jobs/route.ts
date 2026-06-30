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

    // 1. Webhooks — handle missing table gracefully
    let webhooksPending = 0;
    let webhooksFailed = 0;

    try {
      // prettier-ignore
      // nosemgrep: semgrep.tenant-scoping
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const webhooksResult = await supabase.from("webhook_retry_queue" as any).select("status").in("status", ["pending", "failed"]);

      // If the table doesn't exist, Supabase returns an error with code 42P01
      if (!webhooksResult.error) {
        const webhooks = (webhooksResult.data ?? []) as unknown as WebhookRow[];
        for (const w of webhooks) {
          if (w.status === "pending") webhooksPending++;
          else if (w.status === "failed") webhooksFailed++;
        }
      }
    } catch {
      // Table may not exist in this deployment — return zeros
    }

    // 2. Notifications — handle missing table gracefully
    let notificationsPending = 0;
    let notificationsFailed = 0;
    let notificationsDeadLettered = 0;

    try {
      // prettier-ignore
      // nosemgrep: semgrep.tenant-scoping
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const notificationsResult = await supabase.from("notification_queue" as any).select("status, next_attempt_at").in("status", ["pending", "failed"]);

      // If the table doesn't exist, Supabase returns an error with code 42P01
      if (!notificationsResult.error) {
        const notifications = (notificationsResult.data ?? []) as unknown as NotificationRow[];
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
    } catch {
      // Table may not exist in this deployment — return zeros
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
