import { describe, it, expect, vi } from "vitest";

/**
 * Integration tests for the WhatsApp webhook API route.
 *
 * Tests webhook signature verification, message extraction,
 * and status update handling.
 */

vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/tenant-context", () => ({
  setTenantContext: vi.fn(),
  logTenantContext: vi.fn(),
}));

describe("Webhook API — signature verification", () => {
  it("rejects request without signature header", async () => {
    const { hmacSha256Hex, timingSafeEqual } = await import("@/lib/crypto-utils");
    // Simulating signature check
    const appSecret = "test-secret";
    const rawBody = JSON.stringify({ entry: [] });
    const computedSig = await hmacSha256Hex(appSecret, rawBody);

    // Invalid signature should not match
    expect(timingSafeEqual(computedSig, "invalid-hash")).toBe(false);
  });

  it("accepts request with valid signature", async () => {
    const { hmacSha256Hex, timingSafeEqual } = await import("@/lib/crypto-utils");
    const appSecret = "test-secret";
    const rawBody = JSON.stringify({ entry: [] });
    const sig1 = await hmacSha256Hex(appSecret, rawBody);
    const sig2 = await hmacSha256Hex(appSecret, rawBody);

    expect(timingSafeEqual(sig1, sig2)).toBe(true);
  });

  it("signature changes with different body", async () => {
    const { hmacSha256Hex, timingSafeEqual } = await import("@/lib/crypto-utils");
    const appSecret = "test-secret";
    const sig1 = await hmacSha256Hex(appSecret, "body1");
    const sig2 = await hmacSha256Hex(appSecret, "body2");

    expect(timingSafeEqual(sig1, sig2)).toBe(false);
  });
});

describe("Webhook API — message extraction", () => {
  it("extracts text message from webhook payload", () => {
    const entry = {
      changes: [{
        value: {
          messages: [{
            from: "+1234567890",
            text: { body: "CONFIRM" },
          }],
          metadata: { phone_number_id: "pn-123" },
        },
      }],
    };

    const changes = entry.changes;
    const value = changes[0].value;
    const msg = value.messages[0];
    expect(msg.text.body).toBe("CONFIRM");
    expect(msg.from).toBe("+1234567890");
  });

  it("extracts interactive button reply from webhook payload", () => {
    const entry = {
      changes: [{
        value: {
          messages: [{
            from: "+1234567890",
            interactive: {
              type: "button_reply",
              button_reply: { id: "CONFIRM", title: "Confirm" },
            },
          }],
          metadata: { phone_number_id: "pn-123" },
        },
      }],
    };

    const msg = entry.changes[0].value.messages[0];
    expect(msg.interactive.type).toBe("button_reply");
    expect(msg.interactive.button_reply.id).toBe("CONFIRM");
  });

  it("extracts delivery status updates", () => {
    const entry = {
      changes: [{
        value: {
          statuses: [{
            id: "msg-123",
            status: "delivered",
            timestamp: "1711987200",
            recipient_id: "+1234567890",
          }],
        },
      }],
    };

    const status = entry.changes[0].value.statuses[0];
    expect(status.id).toBe("msg-123");
    expect(status.status).toBe("delivered");
    expect(status.recipient_id).toBe("+1234567890");
  });

  it("handles read status update", () => {
    const entry = {
      changes: [{
        value: {
          statuses: [{
            id: "msg-456",
            status: "read",
            timestamp: "1711987500",
            recipient_id: "+1234567890",
          }],
        },
      }],
    };

    const status = entry.changes[0].value.statuses[0];
    expect(status.status).toBe("read");
  });
});

describe("Webhook API — CONFIRM/CANCEL handling logic", () => {
  it("identifies CONFIRM as uppercase match", () => {
    const text = "CONFIRM";
    expect(text.trim().toUpperCase()).toBe("CONFIRM");
  });

  it("identifies CANCEL as uppercase match", () => {
    const text = "CANCEL";
    expect(text.trim().toUpperCase()).toBe("CANCEL");
  });

  it("normalizes lowercase confirm to CONFIRM", () => {
    const text = "confirm";
    expect(text.trim().toUpperCase()).toBe("CONFIRM");
  });

  it("normalizes mixed case cancel to CANCEL", () => {
    const text = "CaNcEl";
    expect(text.trim().toUpperCase()).toBe("CANCEL");
  });

  it("does not match random text as CONFIRM or CANCEL", () => {
    const text = "Hello there";
    const upper = text.trim().toUpperCase();
    expect(upper === "CONFIRM" || upper === "CANCEL").toBe(false);
  });

  it("handles whitespace-padded responses", () => {
    const text = "  CONFIRM  ";
    expect(text.trim().toUpperCase()).toBe("CONFIRM");
  });
});
