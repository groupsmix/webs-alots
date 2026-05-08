import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/audit-log", () => ({
  logAuthEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe("MFA Step-Up (requireMfa)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should verify MFA code successfully for enrolled user", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123", email: "admin@test.com" } },
        }),
        mfa: {
          listFactors: vi.fn().mockResolvedValue({
            data: {
              totp: [
                { id: "factor-123", friendly_name: "Authenticator", status: "verified" },
              ],
            },
            error: null,
          }),
          challenge: vi.fn().mockResolvedValue({
            data: { id: "challenge-123" },
            error: null,
          }),
          verify: vi.fn().mockResolvedValue({
            error: null,
          }),
        },
      },
    };

    const { createClient } = await import("@/lib/supabase-server");
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const { requireMfa } = await import("@/lib/mfa");
    const result = await requireMfa("123456", "impersonate");

    expect(result.verified).toBe(true);
    expect(result.error).toBeNull();
    expect(mockSupabase.auth.mfa.challenge).toHaveBeenCalledWith({ factorId: "factor-123" });
    expect(mockSupabase.auth.mfa.verify).toHaveBeenCalledWith({
      factorId: "factor-123",
      challengeId: "challenge-123",
      code: "123456",
    });
  });

  it("should reject invalid MFA code", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123", email: "admin@test.com" } },
        }),
        mfa: {
          listFactors: vi.fn().mockResolvedValue({
            data: {
              totp: [
                { id: "factor-123", friendly_name: "Authenticator", status: "verified" },
              ],
            },
            error: null,
          }),
          challenge: vi.fn().mockResolvedValue({
            data: { id: "challenge-123" },
            error: null,
          }),
          verify: vi.fn().mockResolvedValue({
            error: { message: "Invalid code" },
          }),
        },
      },
    };

    const { createClient } = await import("@/lib/supabase-server");
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const { requireMfa } = await import("@/lib/mfa");
    const result = await requireMfa("000000", "impersonate");

    expect(result.verified).toBe(false);
    expect(result.error).toBe("mfa.invalidCode");
  });

  it("should reject when user has no MFA enrolled", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123", email: "admin@test.com" } },
        }),
        mfa: {
          listFactors: vi.fn().mockResolvedValue({
            data: {
              totp: [],
            },
            error: null,
          }),
        },
      },
    };

    const { createClient } = await import("@/lib/supabase-server");
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const { requireMfa } = await import("@/lib/mfa");
    const result = await requireMfa("123456", "impersonate");

    expect(result.verified).toBe(false);
    expect(result.error).toBe("mfa.notEnrolled");
  });

  it("should reject when MFA challenge fails", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123", email: "admin@test.com" } },
        }),
        mfa: {
          listFactors: vi.fn().mockResolvedValue({
            data: {
              totp: [
                { id: "factor-123", friendly_name: "Authenticator", status: "verified" },
              ],
            },
            error: null,
          }),
          challenge: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "Challenge failed" },
          }),
        },
      },
    };

    const { createClient } = await import("@/lib/supabase-server");
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const { requireMfa } = await import("@/lib/mfa");
    const result = await requireMfa("123456", "impersonate");

    expect(result.verified).toBe(false);
    expect(result.error).toBe("mfa.verifyError");
  });

  it("should log audit events for MFA verification", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123", email: "admin@test.com" } },
        }),
        mfa: {
          listFactors: vi.fn().mockResolvedValue({
            data: {
              totp: [
                { id: "factor-123", friendly_name: "Authenticator", status: "verified" },
              ],
            },
            error: null,
          }),
          challenge: vi.fn().mockResolvedValue({
            data: { id: "challenge-123" },
            error: null,
          }),
          verify: vi.fn().mockResolvedValue({
            error: null,
          }),
        },
      },
    };

    const { createClient } = await import("@/lib/supabase-server");
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const { logAuthEvent } = await import("@/lib/audit-log");

    const { requireMfa } = await import("@/lib/mfa");
    await requireMfa("123456", "impersonate");

    // Should log challenge issued and verification success
    expect(logAuthEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "mfa.challenge_issued",
        actor: "admin@test.com",
        description: "MFA challenge issued for impersonate",
      })
    );

    expect(logAuthEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "mfa.verification_success",
        actor: "admin@test.com",
        description: "MFA verification successful for impersonate",
      })
    );
  });
});
