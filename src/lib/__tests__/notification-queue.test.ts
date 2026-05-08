import { describe, it, expect, vi, beforeEach } from "vitest";

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

vi.mock("@/lib/whatsapp", () => ({
  sendTextMessage: vi.fn(() => ({
    success: true,
    messageId: "wa-msg-001",
  })),
}));

vi.mock("@/lib/sms", () => ({
  sendSms: vi.fn(() => ({
    success: true,
    messageId: "sms-msg-001",
  })),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("notification-queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
