/**
 * Cloudflare Queues — Notification producer + consumer
 *
 * PERF: Replaces the 15-minute cron-poll pattern with a push-based queue.
 * Notifications are delivered within seconds of being enqueued instead of
 * waiting up to 15 minutes for the next cron tick.
 *
 * Architecture:
 *   1. At the event trigger site, call `pushToNotificationQueue()` with the
 *      notification payload. This enqueues the message via the CF Queues
 *      binding (NOTIFICATION_QUEUE) declared in wrangler.toml.
 *
 *   2. The Worker's `queue` handler (see worker-cron-handler.ts) is invoked
 *      automatically by Cloudflare when the batch is ready. It calls
 *      `processQueueBatch()` which dispatches each message via the existing
 *      send-notification path (WhatsApp → Email → in-app fallback).
 *
 *   3. If processing fails, CF Queues retries automatically up to max_retries
 *      (3, configured in wrangler.toml). After max_retries, the message is
 *      forwarded to notification-queue-dlq for manual inspection.
 *
 *   4. The 15-minute cron (`/api/cron/notifications`) remains as a safety net
 *      for messages that somehow bypass the queue path (e.g. during a CF
 *      Queues outage window). It processes any rows still in `pending` state.
 *
 * Provisioning (one-time, before deploying):
 *   wrangler queues create notification-queue
 *   wrangler queues create notification-queue-dlq
 *   wrangler queues create notification-queue-staging
 *   wrangler queues create notification-queue-staging-dlq
 */

import { logger } from "@/lib/logger";

// ── Message shape ──────────────────────────────────────────────────────────

export interface NotificationQueueMessage {
  /** Unique ID from the notification_queue DB row — used for idempotency */
  queueRowId: string;
  clinicId: string;
  channel: "whatsapp" | "sms" | "email" | "push";
  recipient: string;
  body: string;
  trigger: string;
  metadata?: Record<string, string>;
  enqueuedAt: string;
}

// ── Producer ───────────────────────────────────────────────────────────────

/**
 * Push a notification message to the Cloudflare Queue.
 * Falls back gracefully if the NOTIFICATION_QUEUE binding is not available
 * (e.g. in local development or before the queue is provisioned) — the
 * cron-poll fallback still delivers the message within 15 minutes.
 *
 * The CF Queue binding is accessed via `getCloudflareContext().env` as
 * required by @opennextjs/cloudflare v1.17+.
 */
export async function pushToNotificationQueue(message: NotificationQueueMessage): Promise<boolean> {
  try {
    // @opennextjs/cloudflare exposes Worker bindings through getCloudflareContext()
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = getCloudflareContext();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const queue = (ctx?.env as Record<string, any>)?.NOTIFICATION_QUEUE as
      | { send: (body: unknown) => Promise<void> }
      | undefined;

    if (!queue) {
      // Binding not available — cron fallback will deliver within 15 minutes
      logger.debug("NOTIFICATION_QUEUE binding unavailable — relying on cron fallback", {
        context: "cf-notification-queue",
        queueRowId: message.queueRowId,
      });
      return false;
    }

    await queue.send(message);

    logger.info("Notification pushed to CF Queue", {
      context: "cf-notification-queue",
      queueRowId: message.queueRowId,
      channel: message.channel,
      clinicId: message.clinicId,
    });

    return true;
  } catch (err) {
    // Non-fatal: log and allow cron fallback to handle delivery
    logger.warn("Failed to push notification to CF Queue — cron fallback will handle", {
      context: "cf-notification-queue",
      queueRowId: message.queueRowId,
      error: err,
    });
    return false;
  }
}

// ── Consumer (called from Worker queue handler) ────────────────────────────

export interface QueueBatchResult {
  processed: number;
  sent: number;
  failed: number;
}

/**
 * Process a batch of notification messages from the Cloudflare Queue.
 * Called from the Worker's `queue` export handler (worker-cron-handler.ts).
 *
 * The notification_queue DB table is the single source of truth. Rather than
 * re-implementing per-message dispatch logic here, we delegate to the existing
 * `processNotificationQueue()` which atomically claims, delivers, and marks
 * rows as sent/failed. Idempotency is guaranteed at the DB level — a row
 * already marked "sent" by a concurrent invocation is simply skipped.
 *
 * If the batch-level dispatch throws, we call batch.retryAll() so CF Queues
 * will re-deliver. After max_retries the messages move to the DLQ.
 */
export async function processQueueBatch(
  batch: MessageBatch<NotificationQueueMessage>,
): Promise<QueueBatchResult> {
  const result: QueueBatchResult = {
    processed: batch.messages.length,
    sent: 0,
    failed: 0,
  };

  try {
    // Delegate to the existing queue processor — it creates its own admin
    // client and handles all DB state transitions (pending → processing → sent/failed).
    const { processNotificationQueue } = await import("@/lib/notification-queue");
    const queueResult = await processNotificationQueue();

    result.sent = queueResult.sent;
    result.failed = queueResult.failed;

    // Ack the entire batch — idempotency is at the DB layer
    batch.ackAll();
  } catch (err) {
    logger.error("CF Queue batch processing failed — retrying", {
      context: "cf-notification-queue:consumer",
      batchSize: batch.messages.length,
      error: err,
    });
    result.failed = batch.messages.length;
    batch.retryAll();
  }

  logger.info("CF Queue batch processed", {
    context: "cf-notification-queue:consumer",
    ...result,
  });

  return result;
}

// ── MessageBatch type (Cloudflare Workers runtime type) ────────────────────
// Defined locally to avoid importing the full @cloudflare/workers-types package
// which is a devDependency and not available at runtime.

interface Message<T> {
  readonly body: T;
  ack(): void;
  retry(): void;
}

interface MessageBatch<T> {
  readonly messages: Message<T>[];
  ackAll(): void;
  retryAll(): void;
}
