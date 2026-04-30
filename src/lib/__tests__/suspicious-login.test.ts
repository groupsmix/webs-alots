import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { recordLoginAndAlert } from "../suspicious-login";

// Mock email module
vi.mock("../email", () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock email templates
vi.mock("../email-templates", () => ({
  suspiciousLoginEmail: vi.fn().mockReturnValue({
    subject: "New sign-in",
    html: "<p>alert</p>",
  }),
}));

// Mock logger
vi.mock("../logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

function createMockSupabase(recentLogins: Array<{ ip_address: string; ua_fingerprint: string }> = []) {
  const selectMock = {
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: recentLogins }),
  };

  const insertMock = vi.fn().mockResolvedValue({ error: null });

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "login_events") {
        return {
          select: vi.fn().mockReturnValue(selectMock),
          insert: insertMock,
        };
      }
      return { select: vi.fn().mockReturnValue(selectMock), insert: insertMock };
    }),
    _insertMock: insertMock,
  };
}

describe("recordLoginAndAlert", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns isNewDevice=false when disabled", async () => {
    process.env.SUSPICIOUS_LOGIN_ALERTS_ENABLED = "false";
    const supabase = createMockSupabase();
    const result = await recordLoginAndAlert(supabase as never, {
      userId: "user-1",
      email: "test@example.com",
      ipAddress: "1.2.3.4",
      userAgent: "Mozilla/5.0",
    });
    expect(result.isNewDevice).toBe(false);
  });

  it("returns isNewDevice=false on first-ever login (no history)", async () => {
    delete process.env.SUSPICIOUS_LOGIN_ALERTS_ENABLED;
    const supabase = createMockSupabase([]);
    const result = await recordLoginAndAlert(supabase as never, {
      userId: "user-1",
      email: "test@example.com",
      ipAddress: "1.2.3.4",
      userAgent: "Mozilla/5.0",
    });
    expect(result.isNewDevice).toBe(false);
    // Should still insert the login event
    expect(supabase._insertMock).toHaveBeenCalled();
  });

  it("returns isNewDevice=false when IP+UA are known", async () => {
    const supabase = createMockSupabase([
      { ip_address: "1.2.3.4", ua_fingerprint: "Mozilla/5.0" },
    ]);
    const result = await recordLoginAndAlert(supabase as never, {
      userId: "user-1",
      email: "test@example.com",
      ipAddress: "1.2.3.4",
      userAgent: "Mozilla/5.0",
    });
    expect(result.isNewDevice).toBe(false);
  });

  it("returns isNewDevice=true and sends email when both IP and UA are new", async () => {
    const { sendEmail } = await import("../email");
    const supabase = createMockSupabase([
      { ip_address: "10.0.0.1", ua_fingerprint: "OldBrowser/1.0" },
    ]);
    const result = await recordLoginAndAlert(supabase as never, {
      userId: "user-1",
      email: "test@example.com",
      ipAddress: "1.2.3.4",
      userAgent: "NewBrowser/2.0",
    });
    expect(result.isNewDevice).toBe(true);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "test@example.com",
        subject: "New sign-in",
      }),
    );
  });

  it("returns isNewDevice=false when only IP is new but UA is known", async () => {
    const supabase = createMockSupabase([
      { ip_address: "10.0.0.1", ua_fingerprint: "Mozilla/5.0" },
    ]);
    const result = await recordLoginAndAlert(supabase as never, {
      userId: "user-1",
      email: "test@example.com",
      ipAddress: "1.2.3.4",
      userAgent: "Mozilla/5.0",
    });
    expect(result.isNewDevice).toBe(false);
  });

  it("catches errors and returns isNewDevice=false", async () => {
    const supabase = {
      from: vi.fn().mockImplementation(() => {
        throw new Error("DB error");
      }),
    };
    const result = await recordLoginAndAlert(supabase as never, {
      userId: "user-1",
      email: "test@example.com",
      ipAddress: "1.2.3.4",
      userAgent: "Mozilla/5.0",
    });
    expect(result.isNewDevice).toBe(false);
  });
});
