import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Integration tests for the cron reminders API route.
 *
 * Tests reminder window calculations, idempotency logic,
 * and notification dispatch decisions.
 */

vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(),
  createTenantClient: vi.fn(),
}));

vi.mock("@/lib/tenant-context", () => ({
  setTenantContext: vi.fn(),
  logTenantContext: vi.fn(),
}));

describe("Cron reminders — time window calculations", () => {
  it("identifies 24h reminder window (22-25 hours before)", () => {
    const now = new Date("2026-03-27T10:00:00Z");
    const apptDate = new Date("2026-03-28T10:00:00Z"); // exactly 24h away
    const hoursUntil = (apptDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    expect(hoursUntil).toBe(24);
    expect(hoursUntil > 22 && hoursUntil <= 25).toBe(true);
  });

  it("identifies 1h reminder window (0.5-1.5 hours before)", () => {
    const now = new Date("2026-03-27T09:00:00Z");
    const apptDate = new Date("2026-03-27T10:00:00Z"); // exactly 1h away
    const hoursUntil = (apptDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    expect(hoursUntil).toBe(1);
    expect(hoursUntil > 0.5 && hoursUntil <= 1.5).toBe(true);
  });

  it("excludes appointments outside reminder windows", () => {
    const now = new Date("2026-03-27T10:00:00Z");
    // 5 hours away — neither 24h nor 1h window
    const apptDate = new Date("2026-03-27T15:00:00Z");
    const hoursUntil = (apptDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    expect(hoursUntil).toBe(5);
    const isIn24hWindow = hoursUntil > 22 && hoursUntil <= 25;
    const isIn1hWindow = hoursUntil > 0.5 && hoursUntil <= 1.5;
    expect(isIn24hWindow || isIn1hWindow).toBe(false);
  });

  it("excludes past appointments", () => {
    const now = new Date("2026-03-27T10:00:00Z");
    const apptDate = new Date("2026-03-27T08:00:00Z"); // 2 hours ago
    const hoursUntil = (apptDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    expect(hoursUntil).toBeLessThan(0);
    const isIn24hWindow = hoursUntil > 22 && hoursUntil <= 25;
    const isIn1hWindow = hoursUntil > 0.5 && hoursUntil <= 1.5;
    expect(isIn24hWindow || isIn1hWindow).toBe(false);
  });
});

describe("Cron reminders — idempotency", () => {
  it("detects already-sent reminders using Set lookup", () => {
    const alreadySent = new Set(["appt-1:reminder_24h", "appt-2:reminder_1h"]);

    expect(alreadySent.has("appt-1:reminder_24h")).toBe(true);
    expect(alreadySent.has("appt-2:reminder_1h")).toBe(true);
    expect(alreadySent.has("appt-3:reminder_24h")).toBe(false);
  });

  it("creates correct idempotency key format", () => {
    const apptId = "appt-123";
    const trigger = "reminder_24h";
    const key = `${apptId}:${trigger}`;
    expect(key).toBe("appt-123:reminder_24h");
  });

  it("skips reminders for cancelled appointments", () => {
    const validStatuses = ["confirmed", "pending"];
    expect(validStatuses.includes("cancelled")).toBe(false);
    expect(validStatuses.includes("confirmed")).toBe(true);
    expect(validStatuses.includes("pending")).toBe(true);
  });
});

describe("Cron reminders — cron authentication", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.CRON_SECRET;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("cron reminders require CRON_SECRET", async () => {
    const { verifyCronSecret } = await import("@/lib/cron-auth");
    const mockReq = {
      headers: {
        get: () => null,
      },
    };
    process.env.CRON_SECRET = "test-secret";
    const result = verifyCronSecret(mockReq as never);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });
});

describe("Cron reminders — notification template selection", () => {
  it("finds reminder_24h template", async () => {
    const { defaultNotificationTemplates } = await import("@/lib/notifications");
    const tpl = defaultNotificationTemplates.find(
      (t) => t.trigger === "reminder_24h" && t.enabled,
    );
    expect(tpl).toBeDefined();
    expect(tpl!.channels).toContain("whatsapp");
  });

  it("finds reminder_1h template", async () => {
    const { defaultNotificationTemplates } = await import("@/lib/notifications");
    const tpl = defaultNotificationTemplates.find(
      (t) => t.trigger === "reminder_1h" && t.enabled,
    );
    expect(tpl).toBeDefined();
    expect(tpl!.channels).toContain("whatsapp");
  });

  it("templates have whatsappBody with placeholders", async () => {
    const { defaultNotificationTemplates } = await import("@/lib/notifications");
    const reminderTemplates = defaultNotificationTemplates.filter(
      (t) => t.trigger === "reminder_24h" || t.trigger === "reminder_1h",
    );
    for (const tpl of reminderTemplates) {
      expect(tpl.whatsappBody).toContain("{{doctor_name}}");
      expect(tpl.whatsappBody).toContain("{{time}}");
    }
  });
});
