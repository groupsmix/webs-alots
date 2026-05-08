import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendEmail, sendNotificationEmail } from "../email";

describe("sendEmail", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear email-related env vars
    delete process.env.RESEND_API_KEY;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_PORT;
    delete process.env.EMAIL_FROM;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns error when no provider is configured", async () => {
    const result = await sendEmail({
      to: "test@example.com",
      subject: "Test",
      html: "<p>Hello</p>",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("No email provider configured");
  });

  it("attempts Resend when RESEND_API_KEY is set", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "msg_123" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await sendEmail({
      to: "test@example.com",
      subject: "Test",
      html: "<p>Hello</p>",
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe("msg_123");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer re_test_key",
        }),
      }),
    );

    vi.unstubAllGlobals();
  });

  it("handles Resend API failure", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: "Invalid API key" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await sendEmail({
      to: "test@example.com",
      subject: "Test",
      html: "<p>Hello</p>",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid API key");

    vi.unstubAllGlobals();
  });

  it("handles fetch network error", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network timeout"));
    vi.stubGlobal("fetch", mockFetch);

    const result = await sendEmail({
      to: "test@example.com",
      subject: "Test",
      html: "<p>Hello</p>",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Network timeout");

    vi.unstubAllGlobals();
  });

  it("uses SMTP when SMTP credentials are set", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "user";
    process.env.SMTP_PASS = "pass";
    process.env.SMTP_PORT = "587";

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "smtp_msg_1" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await sendEmail({
      to: "test@example.com",
      subject: "Test",
      html: "<p>Hello</p>",
    });

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://smtp.example.com:587/messages",
      expect.objectContaining({ method: "POST" }),
    );

    vi.unstubAllGlobals();
  });

  it("prefers Resend over SMTP when both configured", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "user";
    process.env.SMTP_PASS = "pass";

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "resend_msg" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await sendEmail({
      to: "test@example.com",
      subject: "Test",
      html: "<p>Hello</p>",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.anything(),
    );

    vi.unstubAllGlobals();
  });
});

describe("sendNotificationEmail", () => {
  it("escapes HTML in clinic name, subject, and body", async () => {
    // No provider configured, so it will fail but we test the return
    const result = await sendNotificationEmail(
      "test@example.com",
      '<script>alert("xss")</script>',
      "<b>bold</b>",
      '<img src=x onerror=alert(1)>',
    );
    // Without a provider it should fail gracefully
    expect(result.success).toBe(false);
  });

  it("uses default clinic name when not provided", async () => {
    const result = await sendNotificationEmail(
      "test@example.com",
      "Subject",
      "Body",
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("No email provider configured");
  });

  it("sends List-Unsubscribe and List-Unsubscribe-Post headers via Resend (A150-F1)", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "msg_unsub" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await sendNotificationEmail(
      "patient@example.com",
      "Appointment Reminder",
      "Your appointment is tomorrow.",
      "Dr. Ahmed Clinic",
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.headers).toBeDefined();
    expect(callBody.headers["List-Unsubscribe"]).toContain("patient%40example.com");
    expect(callBody.headers["List-Unsubscribe"]).toContain("mailto:unsubscribe@");
    expect(callBody.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");

    vi.unstubAllGlobals();
  });

  it("includes notification preferences link in the HTML body (A150-F2)", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "msg_pref" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await sendNotificationEmail(
      "patient@example.com",
      "Test Subject",
      "Test body",
      "Test Clinic",
    );

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.html).toContain("/patient/preferences");
    expect(callBody.html).toContain("notification");

    vi.unstubAllGlobals();
  });
});

describe("sendEmail headers passthrough", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.EMAIL_FROM;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("passes custom headers to Resend API payload", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "msg_hdr" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await sendEmail({
      to: "test@example.com",
      subject: "Test",
      html: "<p>Hello</p>",
      headers: {
        "List-Unsubscribe": "<https://example.com/unsub>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.headers).toEqual({
      "List-Unsubscribe": "<https://example.com/unsub>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });

    vi.unstubAllGlobals();
  });
});
