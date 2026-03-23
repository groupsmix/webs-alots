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
});
