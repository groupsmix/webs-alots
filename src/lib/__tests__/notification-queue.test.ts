import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAdminClient } from "@/lib/supabase-server";
import { pushToNotificationQueue } from "../cf-notification-queue";
import { getProcessingEnforcement } from "../gdpr-enforcement";
import { sendTextMessage } from "../whatsapp";
import { hasWhatsAppConsent } from "../whatsapp/whatsapp-consent";

// Mock Supabase admin client before importing the module
vi.mock("@/lib/supabase-server", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { id: "queue-entry-123" },
            error: null,
          })),
        })),
      })),
      select: vi.fn(() => ({
        in: vi.fn(() => ({
          lte: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                data: [],
                error: null,
              })),
            })),
          })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({ error: null })),
        in: vi.fn(() => ({ error: null })),
      })),
    })),
  })),
}));

vi.mock("../whatsapp", () => ({
  sendTextMessage: vi.fn(() => ({
    success: true,
    messageId: "wa-msg-001",
  })),
}));

vi.mock("../sms", () => ({
  sendSms: vi.fn(() => ({
    success: true,
    messageId: "sms-msg-001",
  })),
}));

vi.mock("../cf-notification-queue", () => ({
  pushToNotificationQueue: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("../gdpr-enforcement", () => ({
  getProcessingEnforcement: vi.fn(() =>
    Promise.resolve({
      restricted: false,
      objectedActivities: [],
      objectsTo: () => false,
    }),
  ),
}));

vi.mock("../whatsapp/whatsapp-consent", () => ({
  hasWhatsAppConsent: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("../tenant-metering", () => ({
  recordUsage: vi.fn(() => Promise.resolve()),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

function makeQueueItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "queue-item-1",
    clinic_id: "clinic-001",
    channel: "whatsapp",
    recipient: "+212600000000",
    body: "Your appointment is confirmed.",
    trigger_type: "booking_confirmation",
    metadata: null,
    status: "pending",
    attempts: 0,
    max_attempts: 5,
    next_retry_at: new Date().toISOString(),
    last_error: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function createQueueClient(items: Record<string, unknown>[]) {
  const limit = vi.fn().mockResolvedValue({ data: items, error: null });
  const order = vi.fn().mockReturnValue({ limit });
  const lte = vi.fn().mockReturnValue({ order });
  const inFilter = vi.fn().mockReturnValue({ lte });
  const select = vi.fn().mockReturnValue({ in: inFilter });
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const updateIn = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn().mockReturnValue({ eq: updateEq, in: updateIn });
  const insertSingle = vi.fn().mockResolvedValue({ data: { id: "queue-entry-123" }, error: null });
  const insertSelect = vi.fn().mockReturnValue({ single: insertSingle });
  const insert = vi.fn().mockReturnValue({ select: insertSelect });
  const from = vi.fn().mockReturnValue({ select, update, insert });

  return {
    client: { from },
    spies: {
      from,
      select,
      inFilter,
      lte,
      order,
      limit,
      update,
      updateEq,
      updateIn,
      insert,
      insertSelect,
      insertSingle,
    },
  };
}

describe("notification-queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getProcessingEnforcement).mockResolvedValue({
      restricted: false,
      objectedActivities: [],
      objectsTo: () => false,
    });
    vi.mocked(hasWhatsAppConsent).mockResolvedValue(true);
    vi.mocked(sendTextMessage).mockResolvedValue({
      success: true,
      messageId: "wa-msg-001",
      provider: "meta",
    });
  });

  describe("calculateNextRetry", () => {
    it("calculates exponential backoff delays", async () => {
      const { calculateNextRetry } = await import("../notification-queue");

      const retry0 = calculateNextRetry(0);
      const retry1 = calculateNextRetry(1);
      const retry2 = calculateNextRetry(2);
      const retry3 = calculateNextRetry(3);

      const now = Date.now();

      // Each retry should be further in the future than the previous
      expect(new Date(retry0).getTime()).toBeGreaterThan(now);
      expect(new Date(retry1).getTime()).toBeGreaterThan(new Date(retry0).getTime());
      expect(new Date(retry2).getTime()).toBeGreaterThan(new Date(retry1).getTime());
      expect(new Date(retry3).getTime()).toBeGreaterThan(new Date(retry2).getTime());
    });

    it("uses the formula BASE_DELAY * 2^attempt", async () => {
      const { calculateNextRetry } = await import("../notification-queue");

      const BASE_DELAY = 30_000; // 30 seconds
      const now = Date.now();

      // Attempt 0: ~30s delay
      const retry0Time = new Date(calculateNextRetry(0)).getTime();
      expect(retry0Time - now).toBeGreaterThanOrEqual(BASE_DELAY * 0.9);
      expect(retry0Time - now).toBeLessThan(BASE_DELAY * 2); // account for jitter

      // Attempt 2: ~120s delay (30 * 4)
      const retry2Time = new Date(calculateNextRetry(2)).getTime();
      expect(retry2Time - now).toBeGreaterThanOrEqual(BASE_DELAY * 4 * 0.9);
    });
  });

  describe("enqueueNotification", () => {
    it("returns queue entry ID on success", async () => {
      const { enqueueNotification } = await import("../notification-queue");

      const id = await enqueueNotification({
        clinicId: "clinic-001",
        channel: "whatsapp",
        recipient: "+212600000000",
        body: "Your appointment is confirmed",
        trigger: "booking_confirmation",
      });

      expect(id).toBe("queue-entry-123");
    });

    it("accepts optional metadata", async () => {
      const { enqueueNotification } = await import("../notification-queue");

      const id = await enqueueNotification({
        clinicId: "clinic-001",
        channel: "sms",
        recipient: "+212600000000",
        body: "Reminder: appointment tomorrow at 10am",
        trigger: "reminder_24h",
        metadata: { appointment_id: "apt-001", patient_name: "Test Patient" },
      });

      expect(id).toBe("queue-entry-123");
    });

    it("does not push in-app notifications to the external Cloudflare queue", async () => {
      const { enqueueNotification } = await import("../notification-queue");

      const id = await enqueueNotification({
        clinicId: "clinic-001",
        channel: "in_app",
        recipient: "user-123",
        body: "Internal notification",
        trigger: "booking_confirmation",
      });

      expect(id).toBe("queue-entry-123");
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(pushToNotificationQueue).not.toHaveBeenCalled();
    });
  });

  describe("processNotificationQueue", () => {
    it("returns zero counts when queue is empty", async () => {
      const { processNotificationQueue } = await import("../notification-queue");

      const result = await processNotificationQueue();

      expect(result).toEqual({
        processed: 0,
        sent: 0,
        failed: 0,
        deadLettered: 0,
      });
    });

    it("claims pending rows and marks successful deliveries as sent", async () => {
      const queue = createQueueClient([makeQueueItem({ id: "queue-success-1" })]);
      vi.mocked(createAdminClient).mockReturnValue(queue.client as never);

      const { processNotificationQueue } = await import("../notification-queue");
      const result = await processNotificationQueue();

      expect(result).toEqual({
        processed: 1,
        sent: 1,
        failed: 0,
        deadLettered: 0,
      });
      expect(queue.spies.update.mock.calls[0][0]).toMatchObject({ status: "processing" });
      expect(queue.spies.updateIn).toHaveBeenCalledWith("id", ["queue-success-1"]);
      expect(queue.spies.update.mock.calls[1][0]).toMatchObject({ status: "sent" });
      expect(queue.spies.updateEq).toHaveBeenCalledWith("id", "queue-success-1");
      expect(sendTextMessage).toHaveBeenCalledWith(
        "+212600000000",
        "Your appointment is confirmed.",
      );
    });

    it("skips external delivery when GDPR enforcement blocks notification processing", async () => {
      const queue = createQueueClient([
        makeQueueItem({
          id: "queue-restricted-1",
          metadata: { recipient_id: "patient-123" },
        }),
      ]);
      vi.mocked(createAdminClient).mockReturnValue(queue.client as never);
      vi.mocked(getProcessingEnforcement).mockResolvedValue({
        restricted: true,
        objectedActivities: ["whatsapp_reminders"],
        objectsTo: () => true,
      });

      const { processNotificationQueue } = await import("../notification-queue");
      const result = await processNotificationQueue();

      expect(result).toEqual({
        processed: 1,
        sent: 1,
        failed: 0,
        deadLettered: 0,
      });
      expect(sendTextMessage).not.toHaveBeenCalled();
      expect(queue.spies.update.mock.calls[1][0]).toMatchObject({ status: "sent" });
      expect(queue.spies.updateEq).toHaveBeenCalledWith("id", "queue-restricted-1");
    });

    it("skips WhatsApp messages that require explicit consent when consent is not granted", async () => {
      const queue = createQueueClient([
        makeQueueItem({
          id: "queue-no-consent-1",
          trigger_type: "nps_survey",
          metadata: { recipient_id: "patient-123" },
        }),
      ]);
      vi.mocked(createAdminClient).mockReturnValue(queue.client as never);
      vi.mocked(hasWhatsAppConsent).mockResolvedValue(false);

      const { processNotificationQueue } = await import("../notification-queue");
      const result = await processNotificationQueue();

      expect(result).toEqual({
        processed: 1,
        sent: 1,
        failed: 0,
        deadLettered: 0,
      });
      expect(sendTextMessage).not.toHaveBeenCalled();
      expect(queue.spies.update.mock.calls[1][0]).toMatchObject({ status: "sent" });
    });

    it("moves exhausted deliveries to dead-letter state and reports to Sentry", async () => {
      const queue = createQueueClient([
        makeQueueItem({
          id: "queue-dead-1",
          attempts: 4,
          max_attempts: 5,
        }),
      ]);
      vi.mocked(createAdminClient).mockReturnValue(queue.client as never);
      vi.mocked(sendTextMessage).mockResolvedValue({
        success: false,
        error: "Meta API unavailable",
        provider: "meta",
      });

      const { processNotificationQueue } = await import("../notification-queue");
      const result = await processNotificationQueue();
      const Sentry = await import("@sentry/nextjs");

      expect(result).toEqual({
        processed: 1,
        sent: 0,
        failed: 0,
        deadLettered: 1,
      });
      expect(queue.spies.update.mock.calls[1][0]).toMatchObject({
        status: "dead_letter",
        attempts: 5,
        next_retry_at: "9999-12-31T23:59:59Z",
        last_error: "Meta API unavailable",
      });
      expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    });
  });

  describe("calculateNextRetry - edge cases", () => {
    it("returns a Date object", async () => {
      const { calculateNextRetry } = await import("../notification-queue");

      const result = calculateNextRetry(0);
      expect(result).toBeInstanceOf(Date);
    });

    it("handles high attempt numbers without overflow", async () => {
      const { calculateNextRetry } = await import("../notification-queue");

      // Attempt 10 should still produce a valid date
      const result = calculateNextRetry(10);
      expect(result.getTime()).toBeGreaterThan(Date.now());
      expect(isNaN(result.getTime())).toBe(false);
    });
  });
});
