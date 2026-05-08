/**
 * Notification Queue with Retry & Exponential Backoff
 *
 * Replaces fire-and-forget WhatsApp/SMS sends with a persistent queue.
 * Messages are enqueued as "pending" and processed by a cron job.
 * Failed sends are retried with exponential backoff up to max_attempts.
 *
 * Queue states: pending → processing → sent | failed (terminal: dead-lettered
 * via next_attempt_at = far future when attempts >= max_attempts)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import type { Database } from "@/lib/types/database-extended";
import type { NotificationTrigger, NotificationChannel } from "./notifications";

// We use the extended Database interface to properly type the notification_queue table
type ExtendedClient = SupabaseClient<Database>;

// ── Types ──

export interface QueuedNotification {
  id: string;
  clinic_id: string;
  channel: NotificationChannel;
  recipient: string;
  template_id: string | null;
  payload: unknown;
  status: "pending" | "processing" | "sent" | "failed";
  attempts: number;
  max_attempts: number;
  next_attempt_at: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

interface EnqueueParams {
  clinicId: string;
  channel: NotificationChannel;
  recipient: string;
  body: string;
  trigger: NotificationTrigger;
  metadata?: Record<string, string>;
  maxAttempts?: number;
}

export interface ProcessResult {
  processed: number;
  sent: number;
  failed: number;
  deadLettered: number;
}

// ── Constants ──

/** Base delay in milliseconds for exponential backoff (30 seconds). */
const BASE_RETRY_DELAY_MS = 30_000;

/** Maximum number of items to process per cron invocation. */
const BATCH_SIZE = 50;

/** Far-future timestamp so dead-lettered items are never picked up again. */
const DEAD_LETTER_NEXT_ATTEMPT = "9999-12-31T23:59:59Z";

// ── Backoff Calculation ──

/**
 * Calculate the next retry timestamp using exponential backoff with jitter.
 * Delay = BASE * 2^attempt + random jitter (0–5s)
 *
 * Attempt 0: ~30s, Attempt 1: ~60s, Attempt 2: ~120s, Attempt 3: ~240s, Attempt 4: ~480s
 */
export function calculateNextRetry(attempt: number): Date {
  const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
  // F-A98-K-01: Use crypto.getRandomValues instead of Math.random() so
  // jitter actually fans out under thundering-herd conditions. V8's PRNG
  // can cluster when many isolates seed at the same wall-clock moment.
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const jitter = buf[0] % 5000;
  return new Date(Date.now() + delay + jitter);
}

// ── Enqueue ──

/**
 * Insert a notification into the persistent queue for later delivery.
 * Returns the queue entry ID, or null if the insert failed.
 */
export async function enqueueNotification(
  params: EnqueueParams,
): Promise<string | null> {
  try {
    const { createAdminClient } = await import("@/lib/supabase-server");
    const supabase = createAdminClient() as ExtendedClient;

    const { data, error } = await supabase
      .from("notification_queue")
      .insert({
        clinic_id: params.clinicId,
        channel: params.channel,
        recipient: params.recipient,
        payload: { body: params.body, trigger: params.trigger, metadata: params.metadata },
        status: "pending",
        attempts: 0,
        max_attempts: params.maxAttempts ?? 5,
        next_attempt_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      logger.error("Failed to enqueue notification", {
        context: "notification-queue",
        error,
        channel: params.channel,
        trigger: params.trigger,
      });
      return null;
    }

    return data?.id ?? null;
  } catch (err) {
    logger.error("Notification enqueue error", {
      context: "notification-queue",
      error: err,
    });
    return null;
  }
}

// ── Process Queue ──

/**
 * Process pending notifications from the queue.
 * Called by the cron handler on a regular schedule.
 *
 * 1. Fetch BATCH_SIZE items where status='pending' and next_retry_at <= now
 * 2. Mark them as 'processing' (claim)
 * 3. Attempt delivery via the appropriate channel
 * 4. On success: mark 'sent' with sent_at timestamp
 * 5. On failure: increment attempts, set next_retry_at with backoff
 *    - If attempts >= max_attempts: mark 'dead_letter'
 */
export async function processNotificationQueue(): Promise<ProcessResult> {
  const result: ProcessResult = { processed: 0, sent: 0, failed: 0, deadLettered: 0 };

  try {
    const { createAdminClient } = await import("@/lib/supabase-server");
    const supabase = createAdminClient() as ExtendedClient;

    // Fetch pending items ready for processing
    const { data: items, error: fetchError } = await supabase
      .from("notification_queue")
      .select("id, clinic_id, channel, recipient, payload, status, attempts, max_attempts, next_attempt_at, error_message, created_at")
      .in("status", ["pending", "failed"])
      .lte("next_attempt_at", new Date().toISOString())
      .order("next_attempt_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError || !items || items.length === 0) {
      if (fetchError) {
        logger.error("Failed to fetch notification queue", {
          context: "notification-queue",
          error: fetchError,
        });
      }
      return result;
    }

    // Claim items by marking them as 'processing'
    const itemIds = items.map((item) => item.id);
    await supabase
      .from("notification_queue")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .in("id", itemIds);

    // Process each item
    for (const item of items) {
      result.processed++;

      try {
        const payload = item.payload as { body: string, trigger?: string, metadata?: Record<string, string> };
        const sendResult = await deliverNotification(
          item.channel as NotificationChannel,
          item.recipient,
          payload.body,
        );

        if (sendResult.success) {
          // Mark as sent
          await supabase
            .from("notification_queue")
            .update({
              status: "sent",
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.id);
          result.sent++;
        } else {
          // Handle failure
          const newAttempts = (item.attempts ?? 0) + 1;
          const maxAttempts = item.max_attempts ?? 5;

          if (newAttempts >= maxAttempts) {
            // Move to dead letter — set next_attempt_at to far future so it's never picked up again
            await supabase
              .from("notification_queue")
              .update({
                status: "failed",
                attempts: newAttempts,
                next_attempt_at: DEAD_LETTER_NEXT_ATTEMPT,
                error_message: sendResult.error ?? "Unknown error",
                updated_at: new Date().toISOString(),
              })
              .eq("id", item.id);
            result.deadLettered++;

            logger.error("Notification exhausted retries", {
              context: "notification-queue",
              notificationId: item.id,
              channel: item.channel,
              recipient: item.recipient,
              attempts: newAttempts,
              lastError: sendResult.error,
            });
          } else {
            // Schedule retry with exponential backoff
            const nextRetry = calculateNextRetry(newAttempts);
            await supabase
              .from("notification_queue")
              .update({
                status: "failed",
                attempts: newAttempts,
                next_attempt_at: nextRetry.toISOString(),
                error_message: sendResult.error ?? "Unknown error",
                updated_at: new Date().toISOString(),
              })
              .eq("id", item.id);
            result.failed++;
          }
        }
      } catch (err) {
        // Unexpected error during delivery — treat as failure
        const newAttempts = (item.attempts ?? 0) + 1;
        const maxAttempts = item.max_attempts ?? 5;
        const errorMsg = err instanceof Error ? err.message : "Unknown error";

        if (newAttempts >= maxAttempts) result.deadLettered++;
        else result.failed++;

        await supabase
          .from("notification_queue")
          .update({
            status: "failed",
            attempts: newAttempts,
            next_attempt_at: newAttempts >= maxAttempts ? DEAD_LETTER_NEXT_ATTEMPT : calculateNextRetry(newAttempts).toISOString(),
            error_message: errorMsg,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);

        logger.error("Notification delivery threw unexpected error", {
          context: "notification-queue",
          notificationId: item.id,
          error: err,
        });
      }
    }

    logger.info("Notification queue processing complete", {
      context: "notification-queue",
      ...result,
    });
  } catch (err) {
    logger.error("Notification queue processor failed", {
      context: "notification-queue",
      error: err,
    });
  }

  return result;
}

// ── Channel Delivery ──

interface DeliveryResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Deliver a notification via the specified channel.
 * This is the actual send operation — called by the queue processor.
 */
async function deliverNotification(
  channel: NotificationChannel,
  recipient: string,
  body: string,
): Promise<DeliveryResult> {
  switch (channel) {
    case "whatsapp": {
      const { sendTextMessage } = await import("./whatsapp");
      const result = await sendTextMessage(recipient, body);
      return {
        success: result.success,
        messageId: result.messageId,
        error: result.error,
      };
    }
    case "sms": {
      const { sendSms } = await import("./sms");
      const result = await sendSms(recipient, body);
      return {
        success: result.success,
        messageId: result.messageId,
        error: result.error,
      };
    }
    case "email": {
      const { sendNotificationEmail } = await import("./email");
      const result = await sendNotificationEmail(recipient, "Notification", body);
      return {
        success: result.success,
        messageId: result.messageId,
        error: result.error,
      };
    }
    case "in_app":
      // In-app notifications are persisted to the DB at enqueue time and
      // read directly by the client — no external delivery is needed.
      return { success: true };
    default:
      return { success: false, error: `Unsupported channel: ${channel}` };
  }
}
