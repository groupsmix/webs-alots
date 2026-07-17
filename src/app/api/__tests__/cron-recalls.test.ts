import { describe, it, expect, beforeEach, afterEach } from "vitest";

/**
 * Integration-style tests for the recall cron wiring: authentication,
 * notification template registration, preference mapping, and WhatsApp
 * consent gating for the "recall" trigger.
 */

describe("Cron recalls — authentication", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.CRON_SECRET;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("rejects requests without the cron secret", async () => {
    const { verifyCronSecret } = await import("@/lib/cron-auth");
    process.env.CRON_SECRET = "test-secret-that-is-at-least-32chars";
    const mockReq = { headers: { get: () => null } };
    const result = verifyCronSecret(mockReq as never);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });
});

describe("Cron recalls — notification integration", () => {
  it("registers an enabled recall template on the whatsapp channel", async () => {
    const { defaultNotificationTemplates } = await import("@/lib/notifications");
    const tpl = defaultNotificationTemplates.find((t) => t.trigger === "recall" && t.enabled);
    expect(tpl).toBeDefined();
    expect(tpl!.channels).toContain("whatsapp");
  });

  it("maps the recall trigger to the marketing/opt-in preference", async () => {
    const { isTriggerEnabled } = await import("@/lib/notification-preferences");
    const base = {
      whatsapp_enabled: true,
      email_enabled: true,
      in_app_enabled: true,
      appointment_reminders: true,
      booking_confirmations: true,
      payment_receipts: true,
      prescription_updates: true,
      marketing_updates: false,
    };
    expect(isTriggerEnabled(base, "recall")).toBe(false);
    expect(isTriggerEnabled({ ...base, marketing_updates: true }, "recall")).toBe(true);
  });
});
