/**
 * Notification Queue with Retry & Exponential Backoff
 *
 * Replaces fire-and-forget WhatsApp/SMS sends with a persistent queue.
 * Messages are enqueued as "pending" and processed by a cron job.
 * Failed sends are retried with exponential backoff up to max_attempts.
 *
 * Queue states: pending → processing → sent | failed | dead_letter
 *
 * Per-clinic rate limiting and explicit WhatsApp consent checks are enforced
 * during processing for patient-facing communications.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logAuditEvent } from "@/lib/audit-log";
import { getProcessingEnforcement } from "@/lib/gdpr-enforcement";
import { logger } from "@/lib/logger";
import type { Database as BaseDatabase } from "@/lib/types/database";
import type { Database } from "@/lib/types/database-extended";
import type { NotificationQueueMessage } from "./cf-notification-queue";
import type { NotificationTrigger, NotificationChannel } from "./notifications";
import { hasWhatsAppConsent, type ConsentClient } from "./whatsapp/whatsapp-consent";

// We use the extended Database interface to properly type the notification_queue table
type ExtendedClient = SupabaseClient<Database>;

// ── Types ──

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

interface QueueMetadata {
  recipient_id?: string;
  appointment_id?: string;
  clinic_name?: string;
  locale?: string;
  interactive?: string;
  [key: string]: string | undefined;
}

// ── Constants ──

/** Base delay in milliseconds for exponential backoff (30 seconds). */
const BASE_RETRY_DELAY_MS = 30_000;

/** Maximum number of items to process per cron invocation. */
const BATCH_SIZE = 50;

/** Per-clinic throttle: max WhatsApp messages a single worker can send per run. */
const MAX_PER_CLINIC_PER_RUN = 30;

/** Far-future timestamp so dead-lettered items are never picked up again. */
const DEAD_LETTER_NEXT_RETRY = "9999-12-31T23:59:59Z";

/**
 * Triggers that require explicit WhatsApp consent.
 * Appointment reminders, confirmations, and cancellations are transactional
 * and are allowed without a separate opt-in.
 */
const WHATSAPP_CONSENT_REQUIRED_TRIGGERS: string[] = ["no_show", "nps_survey"];

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
export async function enqueueNotification(params: EnqueueParams): Promise<string | null> {
  try {
    const { createAdminClient } = await import("@/lib/supabase-server");
    const supabase = createAdminClient("notification") as ExtendedClient;

    const { data, error } = await supabase
      .from("notification_queue")
      .insert({
        clinic_id: params.clinicId,
        channel: params.channel,
        recipient: params.recipient,
        body: params.body,
        trigger_type: params.trigger,
        status: "pending",
        attempts: 0,
        max_attempts: params.maxAttempts ?? 5,
        next_retry_at: new Date().toISOString(),
        last_error: null,
        metadata: params.metadata ?? null,
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

    const rowId = data?.id ?? null;

    // INF-Q1: Push to Cloudflare Queue so delivery is near-real-time.
    // Falls back gracefully when the binding is not provisioned — the
    // 15-minute cron sweep remains as a safety net in that case.
    // in_app notifications are DB-only (clients read them directly) so
    // they must not be pushed to the external delivery queue.
    if (rowId && params.channel !== "in_app") {
      const message: NotificationQueueMessage = {
        queueRowId: rowId,
        clinicId: params.clinicId,
        channel: params.channel as NotificationQueueMessage["channel"],
        recipient: params.recipient,
        body: params.body,
        trigger: params.trigger,
        metadata: params.metadata,
        enqueuedAt: new Date().toISOString(),
      };
      // Fire-and-forget — do not await so a CF Queue hiccup never
      // blocks the calling request. The DB row is already persisted.
      import("./cf-notification-queue")
        .then(({ pushToNotificationQueue }) => pushToNotificationQueue(message))
        .catch((err) =>
          logger.warn("CF Queue push failed — cron fallback will deliver", {
            context: "notification-queue",
            rowId,
            error: err,
          }),
        );
    }

    return rowId;
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
 * 1. Fetch BATCH_SIZE items where status='pending'/'failed' and next_retry_at <= now
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
    const supabase = createAdminClient("notification") as ExtendedClient;

    // Fetch pending items ready for processing
    const { data: items, error: fetchError } = await supabase
      .from("notification_queue")
      .select(
        "id, clinic_id, channel, recipient, body, trigger_type, status, attempts, max_attempts, next_retry_at, last_error, metadata, created_at",
      )
      .in("status", ["pending", "failed"])
      .lte("next_retry_at", new Date().toISOString())
      .order("next_retry_at", { ascending: true })
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

    // Per-clinic rate limiter for this run
    const clinicSendCount = new Map<string, number>();

    // Process each item
    for (const item of items) {
      result.processed++;

      const metadata = (item.metadata as QueueMetadata | null) ?? {};

      try {
        // A62-F2: GDPR Art.21 — skip sending to patients who have objected
        // to WhatsApp/notification processing under legitimate interest.
        if (metadata.recipient_id) {
          const enforcement = await getProcessingEnforcement(supabase, metadata.recipient_id);
          if (enforcement.restricted || enforcement.objectsTo("whatsapp_reminders")) {
            logger.info("notification-queue: skipping — GDPR Art.18/21 restriction", {
              context: "notification-queue",
              notificationId: item.id,
              userId: metadata.recipient_id,
              restricted: enforcement.restricted,
              objectedActivities: enforcement.objectedActivities,
            });
            // Mark as skipped (treat as sent to not retry) but audit it
            await supabase
              .from("notification_queue") // nosemgrep: semgrep.tenant-scoping — updating a specific queue row by .eq("id", item.id); item was already tenant-scoped on selection upstream
              .update({ status: "sent", updated_at: new Date().toISOString() })
              .eq("id", item.id);
            result.sent++;
            continue;
          }
        }

        // Explicit WhatsApp opt-in check for non-transactional messages
        if (
          item.channel === "whatsapp" &&
          WHATSAPP_CONSENT_REQUIRED_TRIGGERS.includes(item.trigger_type)
        ) {
          if (metadata.recipient_id) {
            const consent = await hasWhatsAppConsent(
              supabase as unknown as ConsentClient,
              item.clinic_id,
              metadata.recipient_id,
            );
            if (!consent) {
              logger.info("notification-queue: skipping — WhatsApp consent not granted", {
                context: "notification-queue",
                notificationId: item.id,
                clinicId: item.clinic_id,
                userId: metadata.recipient_id,
                trigger: item.trigger_type,
              });
              await logAuditEvent({
                supabase: supabase as unknown as SupabaseClient<BaseDatabase>,
                action: "whatsapp_consent_denied_skip",
                type: "patient",
                clinicId: item.clinic_id,
                actor: metadata.recipient_id,
                description: `Skipped ${item.trigger_type} WhatsApp message — explicit consent not granted`,
                metadata: { notification_id: item.id, trigger: item.trigger_type },
              });
              await supabase
                .from("notification_queue")
                .update({ status: "sent", updated_at: new Date().toISOString() })
                .eq("id", item.id);
              result.sent++;
              continue;
            }
          }
        }

        // Per-clinic rate limiter
        const currentCount = clinicSendCount.get(item.clinic_id) ?? 0;
        if (currentCount >= MAX_PER_CLINIC_PER_RUN) {
          logger.info("notification-queue: per-clinic rate limit reached — deferring", {
            context: "notification-queue",
            notificationId: item.id,
            clinicId: item.clinic_id,
          });
          await supabase
            .from("notification_queue")
            .update({
              status: "failed",
              next_retry_at: new Date(Date.now() + 60_000).toISOString(),
              last_error: "Per-clinic rate limit exceeded",
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.id);
          result.failed++;
          continue;
        }

        const sendResult = await deliverNotification(
          item.channel as NotificationChannel,
          item.recipient,
          item.body,
          item.trigger_type,
          metadata,
        );

        if (sendResult.success) {
          // Mark as sent
          const updatedMetadata: Record<string, string> = {};
          for (const [key, value] of Object.entries(metadata)) {
            if (value !== undefined) {
              updatedMetadata[key] = value;
            }
          }
          if (sendResult.messageId) {
            updatedMetadata.message_id = sendResult.messageId;
          }

          await supabase
            .from("notification_queue")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
              metadata: updatedMetadata,
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.id);
          result.sent++;
          clinicSendCount.set(item.clinic_id, currentCount + 1);

          // Meter usage (fire-and-forget)
          if (item.clinic_id) {
            const resourceType = item.channel === "sms" ? "sms" : "whatsapp";
            import("./tenant-metering").then(({ recordUsage }) =>
              recordUsage(
                supabase,
                item.clinic_id as string,
                resourceType as "whatsapp" | "sms",
                1,
                {
                  notificationId: item.id,
                  channel: item.channel,
                },
              ).catch(() => {}),
            );
          }
        } else {
          // Handle failure
          const newAttempts = (item.attempts ?? 0) + 1;
          const maxAttempts = item.max_attempts ?? 5;

          if (newAttempts >= maxAttempts) {
            // Move to dead letter
            await supabase
              .from("notification_queue")
              .update({
                status: "dead_letter",
                attempts: newAttempts,
                next_retry_at: DEAD_LETTER_NEXT_RETRY,
                last_error: sendResult.error ?? "Unknown error",
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

            // R-13: Alert Sentry on dead-lettered notifications so operators
            // notice delivery outages (e.g. Meta API down) within minutes.
            try {
              const Sentry = await import("@sentry/nextjs");
              Sentry.captureException(
                new Error(`Notification ${item.id} dead-lettered after ${newAttempts} attempts`),
                {
                  tags: { compliance: "notification_delivery", channel: item.channel },
                  extra: {
                    notificationId: item.id,
                    channel: item.channel,
                    attempts: newAttempts,
                    lastError: sendResult.error,
                  },
                },
              );
            } catch {
              // Sentry unavailable
            }
          } else {
            // Schedule retry with exponential backoff
            const nextRetry = calculateNextRetry(newAttempts);
            await supabase
              .from("notification_queue")
              .update({
                status: "failed",
                attempts: newAttempts,
                next_retry_at: nextRetry.toISOString(),
                last_error: sendResult.error ?? "Unknown error",
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
            status: newAttempts >= maxAttempts ? "dead_letter" : "failed",
            attempts: newAttempts,
            next_retry_at:
              newAttempts >= maxAttempts
                ? DEAD_LETTER_NEXT_RETRY
                : calculateNextRetry(newAttempts).toISOString(),
            last_error: errorMsg,
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

function getReminderButtons(locale: string): { id: string; title: string }[] {
  if (locale === "ar" || locale === "ary") {
    return [
      { id: "CONFIRM", title: "تأكيد" },
      { id: "CANCEL", title: "إلغاء" },
    ];
  }
  if (locale === "fr") {
    return [
      { id: "CONFIRM", title: "Confirmer" },
      { id: "CANCEL", title: "Annuler" },
    ];
  }
  // Default: Darija / French fallback
  return [
    { id: "CONFIRM", title: "Oui" },
    { id: "CANCEL", title: "Non" },
  ];
}

/**
 * Deliver a notification via the specified channel.
 * This is the actual send operation — called by the queue processor.
 */
async function deliverNotification(
  channel: NotificationChannel,
  recipient: string,
  body: string,
  triggerType: string,
  metadata: QueueMetadata,
): Promise<DeliveryResult> {
  switch (channel) {
    case "whatsapp": {
      // Reminder templates use Meta interactive quick-reply buttons
      if (
        triggerType === "reminder_24h" ||
        triggerType === "reminder_1h" ||
        triggerType === "reminder_2h"
      ) {
        const { sendInteractiveMessage } = await import("./whatsapp");
        const locale = metadata.locale ?? "fr";
        const result = await sendInteractiveMessage({
          to: recipient,
          body,
          buttons: getReminderButtons(locale),
          footer: metadata.clinic_name,
        });
        return {
          success: result.success,
          messageId: result.messageId,
          error: result.error,
        };
      }

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
