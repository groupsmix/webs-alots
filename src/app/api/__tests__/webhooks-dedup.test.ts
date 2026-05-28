/**
 * Tests for WhatsApp webhook idempotency guard (R-16).
 *
 * Verifies that duplicate WhatsApp message deliveries are skipped
 * using the processed_whatsapp_messages table, same insert-on-conflict
 * pattern as processed_stripe_events in billing/webhook/route.ts.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { hmacSha256Hex } from "@/lib/crypto-utils";

// ── Spy targets ───────────────────────────────────────────────────────

let dedupInsertSpy: ReturnType<typeof vi.fn>;

/**
 * Build a deeply-chainable Supabase mock that supports:
 *   .from(t).select(...).eq(...).eq(...).eq(...).order(...).limit(...).maybeSingle()
 *   .from(t).select(...).eq(...).single()
 *   .from(t).select(...).eq(...).in(...).order(...).limit(...).single()
 *   .from(t).update(...).eq(...).eq(...)
 *   .from(t).insert(...)
 */
function chainableMock(leafData: unknown = null) {
  const self: Record<string, ReturnType<typeof vi.fn>> = {};
  const terminalReturn = { data: leafData, error: null };
  self.select = vi.fn(() => self);
  self.eq = vi.fn(() => self);
  self.in = vi.fn(() => self);
  self.order = vi.fn(() => self);
  self.limit = vi.fn(() => self);
  self.single = vi.fn(() => terminalReturn);
  self.maybeSingle = vi.fn(() => terminalReturn);
  self.update = vi.fn(() => self);
  self.insert = vi.fn(() => ({ error: null }));
  return self;
}

function mockAdminClient() {
  dedupInsertSpy = vi.fn(() => ({ error: null }));
  return {
    from: vi.fn((table: string) => {
      if (table === "processed_whatsapp_messages") {
        return { insert: dedupInsertSpy };
      }
      // notification_log updates for status webhooks
      const chain = chainableMock();
      return chain;
    }),
  };
}

function mockAnonClient() {
  return {
    from: vi.fn((table: string) => {
      if (table === "clinics") {
        return chainableMock({ id: "clinic-uuid-1", name: "Test Clinic" });
      }
      // users, appointments, etc. — return null data (no patient found)
      return chainableMock(null);
    }),
  };
}

vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(() => mockAnonClient()),
  createAdminClient: vi.fn(() => mockAdminClient()),
}));

vi.mock("@/lib/tenant-context", () => ({
  setTenantContext: vi.fn(),
  logTenantContext: vi.fn(),
}));

vi.mock("@/lib/notifications", () => ({
  dispatchNotification: vi.fn(() => []),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────

const TEST_APP_SECRET = "test-meta-app-secret-dedup";

async function signBody(rawBody: string): Promise<string> {
  const hex = await hmacSha256Hex(TEST_APP_SECRET, rawBody);
  return `sha256=${hex}`;
}

function buildWebhookBodyWithMessage(messageId: string, from = "+212661000000") {
  return JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba-123",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                phone_number_id: "pn-clinic-1",
                display_phone_number: "+212522000000",
              },
              messages: [
                {
                  id: messageId,
                  from,
                  type: "text",
                  text: { body: "CONFIRM" },
                },
              ],
            },
          },
        ],
      },
    ],
  });
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("Webhook POST — WhatsApp message idempotency (R-16)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("META_APP_SECRET", TEST_APP_SECRET);
    vi.stubEnv("WHATSAPP_VERIFY_TOKEN", "test-verify-token");
  });

  it("inserts message_id into processed_whatsapp_messages on first delivery", async () => {
    const { POST } = await import("@/app/api/webhooks/route");
    const rawBody = buildWebhookBodyWithMessage("wamid.HBgLFirst001");
    const sig = await signBody(rawBody);
    const request = new Request("http://localhost/api/webhooks", {
      method: "POST",
      body: rawBody,
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": sig,
      },
    });

    const response = await POST(request as never);
    expect(response.status).toBe(200);

    expect(dedupInsertSpy).toHaveBeenCalledWith({
      message_id: "wamid.HBgLFirst001",
      clinic_id: "clinic-uuid-1",
    });
  });

  it("skips processing when message_id is a duplicate (23505 conflict)", async () => {
    dedupInsertSpy = vi.fn(() => ({
      error: { code: "23505", message: "duplicate key value violates unique constraint" },
    }));

    const { createAdminClient } = await import("@/lib/supabase-server");
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "processed_whatsapp_messages") {
          return { insert: dedupInsertSpy } as never;
        }
        return chainableMock() as never;
      }),
    } as never);

    const { POST } = await import("@/app/api/webhooks/route");
    const rawBody = buildWebhookBodyWithMessage("wamid.HBgLDuplicate001");
    const sig = await signBody(rawBody);
    const request = new Request("http://localhost/api/webhooks", {
      method: "POST",
      body: rawBody,
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": sig,
      },
    });

    const response = await POST(request as never);
    expect(response.status).toBe(200);

    expect(dedupInsertSpy).toHaveBeenCalledWith({
      message_id: "wamid.HBgLDuplicate001",
      clinic_id: "clinic-uuid-1",
    });

    const { logger } = await import("@/lib/logger");
    expect(logger.info).toHaveBeenCalledWith(
      "WhatsApp webhook replay detected — ignoring duplicate",
      expect.objectContaining({
        context: "webhooks/whatsapp",
        messageId: "wamid.HBgLDuplicate001",
      }),
    );
  });

  it("continues processing when dedup insert fails with non-conflict error", async () => {
    dedupInsertSpy = vi.fn(() => ({
      error: { code: "PGRST301", message: "connection pool exhausted" },
    }));

    const { createAdminClient } = await import("@/lib/supabase-server");
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "processed_whatsapp_messages") {
          return { insert: dedupInsertSpy } as never;
        }
        return chainableMock() as never;
      }),
    } as never);

    const { POST } = await import("@/app/api/webhooks/route");
    const rawBody = buildWebhookBodyWithMessage("wamid.HBgLTransient001");
    const sig = await signBody(rawBody);
    const request = new Request("http://localhost/api/webhooks", {
      method: "POST",
      body: rawBody,
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": sig,
      },
    });

    const response = await POST(request as never);
    expect(response.status).toBe(200);

    const { logger } = await import("@/lib/logger");
    expect(logger.warn).toHaveBeenCalledWith(
      "WhatsApp message dedup insert failed",
      expect.objectContaining({
        context: "webhooks/whatsapp",
        messageId: "wamid.HBgLTransient001",
      }),
    );
  });
});
