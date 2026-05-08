import { headers } from "next/headers";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { loginLimiter, accountLockoutLimiter } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase-server";
import {
  signInWithPassword,
  signOut,
  getUserProfile,
  requireAuth,
  requireRole,
} from "../auth";

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  loginLimiter: { check: vi.fn().mockResolvedValue(true) },
  accountLockoutLimiter: { check: vi.fn().mockResolvedValue(true) },
  otpSendLimiter: { check: vi.fn().mockResolvedValue(true) },
  passwordResetLimiter: { check: vi.fn().mockResolvedValue(true) },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

function createMockHeaders(values: Record<string, string> = {}) {
  return {
    get: vi.fn((name: string) => values[name] ?? null),
  };
}

function createMockSupabase({
  signInError,
  signOutError,
  user,
  profile,
}: {
  signInError?: { message: string } | null;
  signOutError?: Error | null;
  user?: { id: string } | null;
  profile?: Record<string, unknown> | null;
} = {}) {
  const supabase = {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({
        error: signInError ?? null,
      }),
      signOut: signOutError
        ? vi.fn().mockRejectedValue(signOutError)
        : vi.fn().mockResolvedValue({ error: null }),
      getUser: vi.fn().mockResolvedValue({
        data: { user: user ?? null },
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: profile ?? null,
          }),
        }),
      }),
    }),
  };
  return supabase;
}

describe("signInWithPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(headers).mockResolvedValue(createMockHeaders({ "cf-connecting-ip": "1.2.3.4" }) as never);
  });

  it("returns error when IP rate limit is exceeded", async () => {
    vi.mocked(loginLimiter.check).mockResolvedValue(false);

    const result = await signInWithPassword("test@example.com", "password");

    expect(result.error).toBe("auth.rateLimitLogin");
  });

  it("returns error when account lockout is triggered", async () => {
    vi.mocked(loginLimiter.check).mockResolvedValue(true);
    vi.mocked(accountLockoutLimiter.check).mockResolvedValue(false);

    const result = await signInWithPassword("test@example.com", "password");

    expect(result.error).toBe("auth.accountLocked");
  });

  it("returns error when Supabase auth fails", async () => {
    vi.mocked(loginLimiter.check).mockResolvedValue(true);
    vi.mocked(accountLockoutLimiter.check).mockResolvedValue(true);

    const mockSupabase = createMockSupabase({ signInError: { message: "Invalid credentials" } });
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const result = await signInWithPassword("test@example.com", "password");

    expect(result.error).toBe("Invalid credentials");
  });

  it("normalizes email to lowercase before sign-in", async () => {
    vi.mocked(loginLimiter.check).mockResolvedValue(true);
    vi.mocked(accountLockoutLimiter.check).mockResolvedValue(true);

    const mockSupabase = createMockSupabase({ signInError: { message: "fail" } });
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    await signInWithPassword("  Test@Example.COM  ", "password");

    expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "password",
    });
  });
});

describe("signOut", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to / after successful sign-out", async () => {
    const mockSupabase = createMockSupabase();
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    await expect(signOut()).rejects.toThrow("REDIRECT:/");
    expect(mockSupabase.auth.signOut).toHaveBeenCalled();
  });

  it("redirects to / even when sign-out fails", async () => {
    const mockSupabase = createMockSupabase({ signOutError: new Error("Network error") });
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    // Should still redirect despite the error
    await expect(signOut()).rejects.toThrow("REDIRECT:/");
  });
});

describe("getUserProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when not authenticated", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const result = await getUserProfile();
    expect(result).toBeNull();
  });

  it("returns profile when authenticated", async () => {
    const mockProfile = {
      id: "user-1",
      auth_id: "auth-1",
      clinic_id: "clinic-1",
      role: "patient",
      name: "Test User",
      phone: null,
      email: "test@example.com",
      avatar_url: null,
      is_active: true,
      metadata: {},
    };
    const mockSupabase = createMockSupabase({ user: { id: "auth-1" }, profile: mockProfile });
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const result = await getUserProfile();
    expect(result).toEqual(mockProfile);
  });

  it("selects only needed columns, not select(*)", async () => {
    const mockSupabase = createMockSupabase({ user: { id: "auth-1" }, profile: null });
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    await getUserProfile();

    // Verify that .from("users").select(...) was called with specific columns
    expect(mockSupabase.from).toHaveBeenCalledWith("users");
    const selectCall = mockSupabase.from("users").select;
    expect(selectCall).toHaveBeenCalledWith(
      "id, auth_id, clinic_id, role, name, phone, email, avatar_url, is_active, metadata",
    );
  });
});

describe("requireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to /login when not authenticated", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    await expect(requireAuth()).rejects.toThrow("REDIRECT:/login");
  });
});

describe("requireRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to role dashboard when user has wrong role", async () => {
    const mockProfile = {
      id: "user-1",
      auth_id: "auth-1",
      clinic_id: "clinic-1",
      role: "patient",
      name: "Test",
      phone: null,
      email: null,
      avatar_url: null,
      is_active: true,
      metadata: {},
    };
    const mockSupabase = createMockSupabase({ user: { id: "auth-1" }, profile: mockProfile });
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    await expect(requireRole("clinic_admin", "super_admin")).rejects.toThrow(
      "REDIRECT:/patient/dashboard",
    );
  });
});
