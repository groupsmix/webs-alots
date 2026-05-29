/**
 * Tests for src/lib/whatsapp.ts
 *
 * Covers:
 *   - sendTextMessage: Meta and Twilio providers
 *   - sendInteractiveMessage: Meta interactive buttons, Twilio text fallback
 *   - Configuration detection (isConfigured)
 *   - Error handling for API failures
 *   - Not-configured fallback behavior
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Env setup ────────────────────────────────────────────────────────

const originalEnv = { ...process.env };

function setMetaEnv() {
  process.env.WHATSAPP_PROVIDER = "meta";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "phone-123";
  process.env.WHATSAPP_ACCESS_TOKEN = "meta-token-abc";
}

function setTwilioEnv() {
  process.env.WHATSAPP_PROVIDER = "twilio";
  process.env.TWILIO_ACCOUNT_SID = "AC-test-sid";
  process.env.TWILIO_AUTH_TOKEN = "twilio-auth-token";
  process.env.TWILIO_WHATSAPP_FROM = "+14155238886";
}

function clearWhatsAppEnv() {
  delete process.env.WHATSAPP_PROVIDER;
  delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  delete process.env.WHATSAPP_ACCESS_TOKEN;
  delete process.env.TWILIO_ACCOUNT_SID;
  delete process.env.TWILIO_AUTH_TOKEN;
  delete process.env.TWILIO_WHATSAPP_FROM;
}

// ── Tests ────────────────────────────────────────────────────────────

describe("WhatsApp — sendTextMessage", () => {
  beforeEach(() => {
    vi.resetModules();
    clearWhatsAppEnv();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  it("returns not-configured when env vars are missing", async () => {
    const { sendTextMessage } = await import("@/lib/whatsapp");

    const result = await sendTextMessage("+212600000000", "Hello");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Not configured");
  });

  it("sends text message via Meta API successfully", async () => {
    setMetaEnv();

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ messages: [{ id: "wamid.abc123" }] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { sendTextMessage } = await import("@/lib/whatsapp");
    const result = await sendTextMessage("+212600000000", "Bonjour!");

    expect(result.success).toBe(true);
    expect(result.messageId).toBe("wamid.abc123");
    expect(result.provider).toBe("meta");

    // Verify fetch was called with correct Meta API URL and payload
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("graph.facebook.com");
    expect(url).toContain("phone-123");
    expect(opts.method).toBe("POST");

    const body = JSON.parse(opts.body);
    expect(body.messaging_product).toBe("whatsapp");
    expect(body.to).toBe("+212600000000");
    expect(body.text.body).toBe("Bonjour!");
  });

  it("handles Meta API error response", async () => {
    setMetaEnv();

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: { message: "Invalid phone number format" },
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { sendTextMessage } = await import("@/lib/whatsapp");
    const result = await sendTextMessage("invalid-number", "Hello");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid phone number");
    expect(result.provider).toBe("meta");
  });

  it("sends text message via Twilio API successfully", async () => {
    setTwilioEnv();

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sid: "SM-twilio-msg-id" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { sendTextMessage } = await import("@/lib/whatsapp");
    const result = await sendTextMessage("+212600000000", "Salam!");

    expect(result.success).toBe(true);
    expect(result.messageId).toBe("SM-twilio-msg-id");
    expect(result.provider).toBe("twilio");

    // Verify Twilio API call
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("api.twilio.com");
    expect(url).toContain("AC-test-sid");
    expect(opts.method).toBe("POST");
    expect(opts.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
  });

  it("handles Twilio API error response", async () => {
    setTwilioEnv();

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: "Account suspended" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { sendTextMessage } = await import("@/lib/whatsapp");
    const result = await sendTextMessage("+212600000000", "Hello");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Account suspended");
    expect(result.provider).toBe("twilio");
  });

  it("defaults to meta provider when WHATSAPP_PROVIDER not set", async () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = "phone-123";
    process.env.WHATSAPP_ACCESS_TOKEN = "meta-token-abc";

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ messages: [{ id: "wamid.default" }] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { sendTextMessage } = await import("@/lib/whatsapp");
    const result = await sendTextMessage("+212600000000", "Test");

    expect(result.success).toBe(true);
    expect(result.provider).toBe("meta");
  });
});

describe("WhatsApp — sendInteractiveMessage", () => {
  beforeEach(() => {
    vi.resetModules();
    clearWhatsAppEnv();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  const interactivePayload = {
    to: "+212600000000",
    body: "Choose an option:",
    buttons: [
      { id: "confirm", title: "Confirm" },
      { id: "cancel", title: "Cancel" },
    ],
    header: "Appointment",
    footer: "Reply within 24h",
  };

  it("returns not-configured when env vars are missing", async () => {
    const { sendInteractiveMessage } = await import("@/lib/whatsapp");
    const result = await sendInteractiveMessage(interactivePayload);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Not configured");
  });

  it("sends interactive message via Meta API with buttons", async () => {
    setMetaEnv();

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ messages: [{ id: "wamid.interactive-1" }] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { sendInteractiveMessage } = await import("@/lib/whatsapp");
    const result = await sendInteractiveMessage(interactivePayload);

    expect(result.success).toBe(true);
    expect(result.messageId).toBe("wamid.interactive-1");
    expect(result.provider).toBe("meta");

    // Verify interactive payload structure
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.type).toBe("interactive");
    expect(body.interactive.type).toBe("button");
    expect(body.interactive.body.text).toBe("Choose an option:");
    expect(body.interactive.header.text).toBe("Appointment");
    expect(body.interactive.footer.text).toBe("Reply within 24h");
    expect(body.interactive.action.buttons).toHaveLength(2);
    expect(body.interactive.action.buttons[0].reply.id).toBe("confirm");
  });

  it("falls back to plain text with button labels for Twilio provider", async () => {
    setTwilioEnv();

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sid: "SM-interactive-fallback" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { sendInteractiveMessage } = await import("@/lib/whatsapp");
    const result = await sendInteractiveMessage(interactivePayload);

    expect(result.success).toBe(true);
    expect(result.provider).toBe("twilio");

    // Twilio sends URL-encoded form data (+ for spaces, %XX for specials)
    const rawBody = mockFetch.mock.calls[0][1].body as string;
    const params = new URLSearchParams(rawBody);
    const bodyText = params.get("Body") ?? "";
    expect(bodyText).toContain("Choose an option:");
    expect(bodyText).toContain("Confirm");
    expect(bodyText).toContain("Cancel");
  });

  it("sends interactive message without optional header/footer", async () => {
    setMetaEnv();

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ messages: [{ id: "wamid.no-header" }] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { sendInteractiveMessage } = await import("@/lib/whatsapp");
    const result = await sendInteractiveMessage({
      to: "+212600000000",
      body: "Pick one:",
      buttons: [{ id: "yes", title: "Yes" }],
    });

    expect(result.success).toBe(true);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.interactive.header).toBeUndefined();
    expect(body.interactive.footer).toBeUndefined();
  });

  it("handles Meta API error for interactive messages", async () => {
    setMetaEnv();

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: { message: "Template not approved" },
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { sendInteractiveMessage } = await import("@/lib/whatsapp");
    const result = await sendInteractiveMessage(interactivePayload);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Template not approved");
  });
});

describe("WhatsApp — Meta API request structure", () => {
  beforeEach(() => {
    vi.resetModules();
    clearWhatsAppEnv();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  it("sets correct Authorization header with Bearer token", async () => {
    setMetaEnv();

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ messages: [{ id: "wamid.auth-test" }] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { sendTextMessage } = await import("@/lib/whatsapp");
    await sendTextMessage("+212600000000", "Test auth");

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe("Bearer meta-token-abc");
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("includes AbortSignal timeout in request", async () => {
    setMetaEnv();

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ messages: [{ id: "wamid.timeout-test" }] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { sendTextMessage } = await import("@/lib/whatsapp");
    await sendTextMessage("+212600000000", "Test");

    const opts = mockFetch.mock.calls[0][1];
    expect(opts.signal).toBeDefined();
  });
});
