import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pushToNotificationQueue, processQueueBatch } from "../cf-notification-queue";
import type { NotificationQueueMessage } from "../cf-notification-queue";

vi.mock("../logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const makeMessage = (
  overrides: Partial<NotificationQueueMessage> = {},
): NotificationQueueMessage => ({
  queueRowId: "row-001",
  clinicId: "clinic-abc",
  channel: "whatsapp",
  recipient: "+212600000000",
  body: "Your appointment is confirmed.",
  trigger: "booking_confirmation",
  enqueuedAt: new Date().toISOString(),
  ...overrides,
});

// ── pushToNotificationQueue ────────────────────────────────────────────────

describe("pushToNotificationQueue", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns false and logs debug when NOTIFICATION_QUEUE binding is unavailable", async () => {
    vi.doMock("@opennextjs/cloudflare", () => ({
      getCloudflareContext: () => ({ env: {} }),
    }));

    const { logger } = await import("../logger");
    const result = await pushToNotificationQueue(makeMessage());

    expect(result).toBe(false);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining("NOTIFICATION_QUEUE binding unavailable"),
      expect.any(Object),
    );
  });

  it("returns true and logs info when queue send succeeds", async () => {
    const mockSend = vi.fn().mockResolvedValue(undefined);
    vi.doMock("@opennextjs/cloudflare", () => ({
      getCloudflareContext: () => ({
        env: { NOTIFICATION_QUEUE: { send: mockSend } },
      }),
    }));

    const { logger } = await import("../logger");
    const msg = makeMessage({ queueRowId: "row-ok" });
    const result = await pushToNotificationQueue(msg);

    expect(result).toBe(true);
    expect(mockSend).toHaveBeenCalledWith(msg);
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Notification pushed to CF Queue"),
      expect.objectContaining({ queueRowId: "row-ok" }),
    );
  });

  it("returns false and logs warn when queue send throws", async () => {
    vi.doMock("@opennextjs/cloudflare", () => ({
      getCloudflareContext: () => ({
        env: {
          NOTIFICATION_QUEUE: {
            send: vi.fn().mockRejectedValue(new Error("CF Queue unavailable")),
          },
        },
      }),
    }));

    const { logger } = await import("../logger");
    const result = await pushToNotificationQueue(makeMessage());

    expect(result).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Failed to push notification to CF Queue"),
      expect.any(Object),
    );
  });

  it("returns false when getCloudflareContext itself throws", async () => {
    vi.doMock("@opennextjs/cloudflare", () => ({
      getCloudflareContext: () => {
        throw new Error("not in worker context");
      },
    }));

    const result = await pushToNotificationQueue(makeMessage());
    expect(result).toBe(false);
  });
});

// ── processQueueBatch ──────────────────────────────────────────────────────

describe("processQueueBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ackAll and returns sent count on successful processing", async () => {
    vi.doMock("../notification-queue", () => ({
      processNotificationQueue: vi.fn().mockResolvedValue({
        processed: 3,
        sent: 3,
        failed: 0,
        deadLettered: 0,
      }),
    }));

    const ackAll = vi.fn();
    const retryAll = vi.fn();
    const batch = {
      messages: [
        { body: makeMessage({ queueRowId: "r1" }), ack: vi.fn(), retry: vi.fn() },
        { body: makeMessage({ queueRowId: "r2" }), ack: vi.fn(), retry: vi.fn() },
        { body: makeMessage({ queueRowId: "r3" }), ack: vi.fn(), retry: vi.fn() },
      ],
      ackAll,
      retryAll,
    };

    const result = await processQueueBatch(batch);

    expect(ackAll).toHaveBeenCalledOnce();
    expect(retryAll).not.toHaveBeenCalled();
    expect(result.sent).toBe(3);
    expect(result.processed).toBe(3);
  });

  it("retryAll and sets failed count when processNotificationQueue throws", async () => {
    vi.doMock("../notification-queue", () => ({
      processNotificationQueue: vi.fn().mockRejectedValue(new Error("DB unavailable")),
    }));

    const ackAll = vi.fn();
    const retryAll = vi.fn();
    const batch = {
      messages: [
        { body: makeMessage(), ack: vi.fn(), retry: vi.fn() },
        { body: makeMessage(), ack: vi.fn(), retry: vi.fn() },
      ],
      ackAll,
      retryAll,
    };

    const result = await processQueueBatch(batch);

    expect(retryAll).toHaveBeenCalledOnce();
    expect(ackAll).not.toHaveBeenCalled();
    expect(result.failed).toBe(2);
  });

  it("reports processed count from batch message length regardless of DB result", async () => {
    vi.doMock("../notification-queue", () => ({
      processNotificationQueue: vi.fn().mockResolvedValue({
        processed: 1,
        sent: 1,
        failed: 0,
        deadLettered: 0,
      }),
    }));

    const batch = {
      messages: Array.from({ length: 5 }, (_, i) => ({
        body: makeMessage({ queueRowId: `r${i}` }),
        ack: vi.fn(),
        retry: vi.fn(),
      })),
      ackAll: vi.fn(),
      retryAll: vi.fn(),
    };

    const result = await processQueueBatch(batch);
    expect(result.processed).toBe(5);
  });
});

// ── enqueueNotification → CF Queue integration ────────────────────────────

describe("enqueueNotification wires to CF Queue after DB insert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.doMock("../notification-queue", async (importOriginal) => importOriginal());
  });

  it("calls pushToNotificationQueue with the newly created row ID", async () => {
    const pushMock = vi.fn().mockResolvedValue(true);

    vi.doMock("../cf-notification-queue", () => ({
      pushToNotificationQueue: pushMock,
    }));

    vi.doMock("@/lib/supabase-server", () => ({
      createAdminClient: vi.fn(() => ({
        from: vi.fn(() => ({
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: { id: "new-row-777" },
                error: null,
              }),
            })),
          })),
        })),
      })),
    }));

    const { enqueueNotification } = await import("../notification-queue");
    const id = await enqueueNotification({
      clinicId: "clinic-x",
      channel: "whatsapp",
      recipient: "+212600000001",
      body: "Test message",
      trigger: "booking_confirmation",
    });

    expect(id).toBe("new-row-777");
    // allow the fire-and-forget promise to resolve
    await new Promise((r) => setTimeout(r, 0));
    expect(pushMock).toHaveBeenCalledWith(
      expect.objectContaining({ queueRowId: "new-row-777", clinicId: "clinic-x" }),
    );
  });

  it("still returns row ID when CF Queue push fails (cron fallback path)", async () => {
    vi.doMock("../cf-notification-queue", () => ({
      pushToNotificationQueue: vi.fn().mockRejectedValue(new Error("CF down")),
    }));

    vi.doMock("@/lib/supabase-server", () => ({
      createAdminClient: vi.fn(() => ({
        from: vi.fn(() => ({
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: { id: "new-row-888" },
                error: null,
              }),
            })),
          })),
        })),
      })),
    }));

    const { enqueueNotification } = await import("../notification-queue");
    const id = await enqueueNotification({
      clinicId: "clinic-y",
      channel: "sms",
      recipient: "+212600000002",
      body: "SMS test",
      trigger: "reminder_24h",
    });

    expect(id).toBe("new-row-888");
  });
});
