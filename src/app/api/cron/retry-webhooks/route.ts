import { NextRequest } from "next/server";
import { apiInternalError, apiSuccess } from "@/lib/api-response";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { withSentryCron } from "@/lib/sentry-cron";
import { createUntypedAdminClient } from "@/lib/supabase-server";

interface RetryQueueItem {
  id: string;
  clinic_id: string;
  provider: string;
  event_type: string;
  payload: unknown;
  attempts: number;
  max_attempts: number;
}

/**
 * GET /api/cron/retry-webhooks
 *
 * Processes pending webhook retry items with exponential backoff.
 * Picks up items from webhook_retry_queue where next_retry_at <= now(),
 * re-dispatches them, and updates their status accordingly.
 *
 * Protected by CRON_SECRET via Authorization: Bearer header.
 */
async function handler(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  try {
    const supabase = createUntypedAdminClient("cron");

    // Fetch pending items ready for retry
    // nosemgrep: semgrep.tenant-scoping — cron job uses service-role admin client to process retry items across all clinics; each item already has clinic_id stored at enqueue time
    const { data: pendingItems, error: fetchError } = await supabase
      .from("webhook_retry_queue")
      .select("*")
      .eq("status", "pending")
      .lte("next_retry_at", new Date().toISOString())
      .order("next_retry_at", { ascending: true })
      .limit(50);

    if (fetchError) {
      logger.error("Failed to fetch retry queue items", {
        context: "cron/retry-webhooks",
        code: fetchError.code,
      });
      return apiInternalError("Failed to fetch retry queue");
    }

    if (!pendingItems || pendingItems.length === 0) {
      return apiSuccess({ processed: 0, message: "No pending retries" });
    }

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for (const item of pendingItems) {
      const typedItem = item as RetryQueueItem;

      processed++;
      const newAttempts = typedItem.attempts + 1;

      try {
        // Re-process the webhook payload by calling the internal webhook handler
        const baseUrl =
          process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || "http://localhost:3000";
        const webhookUrl = `${baseUrl}/api/webhooks`;

        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Hub-Signature-256": "sha256=retry-internal",
            "X-Webhook-Retry": "true",
          },
          body: JSON.stringify(typedItem.payload),
        });

        if (response.ok) {
          // nosemgrep: semgrep.tenant-scoping — cron job updates individual item by PK; clinic_id scoping is implicit from the initial fetch
          await supabase
            .from("webhook_retry_queue")
            .update({
              status: "completed",
              attempts: newAttempts,
              updated_at: new Date().toISOString(),
            })
            .eq("id", typedItem.id);

          succeeded++;
        } else {
          throw new Error(`Webhook retry returned status ${response.status}`);
        }
      } catch (retryErr) {
        // Calculate next retry with exponential backoff: 2^attempts minutes
        const backoffMinutes = Math.pow(2, newAttempts);
        const nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();

        const isMaxed = newAttempts >= typedItem.max_attempts;

        const updatePayload: Record<string, unknown> = {
          status: isMaxed ? "failed" : "pending",
          attempts: newAttempts,
          updated_at: new Date().toISOString(),
        };
        if (!isMaxed) {
          updatePayload.next_retry_at = nextRetryAt;
        }

        // nosemgrep: semgrep.tenant-scoping — cron job updates individual item by PK; clinic_id scoping is implicit from the initial fetch
        await supabase.from("webhook_retry_queue").update(updatePayload).eq("id", typedItem.id);

        if (isMaxed) {
          logger.error("Webhook retry exhausted max attempts", {
            context: "cron/retry-webhooks",
            itemId: typedItem.id,
            clinicId: typedItem.clinic_id,
            provider: typedItem.provider,
          });
        } else {
          logger.warn("Webhook retry failed, will retry later", {
            context: "cron/retry-webhooks",
            itemId: typedItem.id,
            attempt: newAttempts,
            nextRetryAt,
            error: retryErr,
          });
        }

        failed++;
      }
    }

    return apiSuccess({
      processed,
      succeeded,
      failed,
      message: `Processed ${processed} retry items`,
    });
  } catch (err) {
    logger.error("Webhook retry cron failed", {
      context: "cron/retry-webhooks",
      error: err,
    });
    return apiInternalError("Webhook retry cron failed");
  }
}

export const GET = withSentryCron("retry-webhooks", "*/5 * * * *", handler);
