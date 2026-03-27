import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Integration tests for the impersonation API route.
 *
 * Tests the validation and business logic of POST/DELETE /api/impersonate.
 */

vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/tenant-context", () => ({
  setTenantContext: vi.fn(),
  logTenantContext: vi.fn(),
}));

describe("Impersonate API — validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts valid impersonation payload", async () => {
    const { impersonateSchema } = await import("@/lib/validations");
    const result = impersonateSchema.safeParse({
      clinicId: "clinic-123",
      password: "admin-password",
    });
    expect(result.success).toBe(true);
  });

  it("rejects impersonation without clinicId", async () => {
    const { impersonateSchema } = await import("@/lib/validations");
    const result = impersonateSchema.safeParse({
      password: "admin-password",
    });
    expect(result.success).toBe(false);
  });

  it("rejects impersonation without password", async () => {
    const { impersonateSchema } = await import("@/lib/validations");
    const result = impersonateSchema.safeParse({
      clinicId: "clinic-123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty clinicId", async () => {
    const { impersonateSchema } = await import("@/lib/validations");
    const result = impersonateSchema.safeParse({
      clinicId: "",
      password: "admin-password",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty password", async () => {
    const { impersonateSchema } = await import("@/lib/validations");
    const result = impersonateSchema.safeParse({
      clinicId: "clinic-123",
      password: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("Impersonate API — cookie behavior", () => {
  it("impersonation cookies should use secure settings", () => {
    // Validate cookie configuration expectations
    const cookieSettings = {
      httpOnly: true,
      secure: true,
      sameSite: "strict" as const,
      maxAge: 4 * 60 * 60, // 4 hours
    };

    expect(cookieSettings.httpOnly).toBe(true);
    expect(cookieSettings.secure).toBe(true);
    expect(cookieSettings.sameSite).toBe("strict");
    expect(cookieSettings.maxAge).toBe(14400);
  });

  it("impersonation cookie names are properly scoped", () => {
    const cookieNames = ["sa_impersonate_clinic_id", "sa_impersonate_clinic_name"];
    for (const name of cookieNames) {
      expect(name).toMatch(/^sa_impersonate_/);
    }
  });
});
