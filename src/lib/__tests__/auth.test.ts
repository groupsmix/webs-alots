import { headers } from "next/headers";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  loginLimiter,
  accountLockoutLimiter,
  otpSendLimiter,
  passwordResetLimiter,
} from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase-server";
import {
  signInWithPassword,
  signOut,
  getUserProfile,
  requireAuth,
  requireRole,
  signInWithOTP,
  verifyOTP,
  signInWithEmailOTP,
  verifyEmailOTP,
  registerPatient,
  resetPassword,
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

vi.mock("@/lib/audit-log", () => ({
  logAuthEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/seed-guard", () => ({
  isSeedUserBlocked: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/lib/profile-header-hmac", () => ({
  verifyProfileHeader: vi.fn().mockResolvedValue(null),
  PROFILE_HEADER_NAMES: {
    id: "x-profile-id",
    role: "x-profile-role",
    clinic: "x-profile-clinic",
    sig: "x-profile-signature",
    iat: "x-profile-iat",
  },
}));

function createMockHeaders(values: Record<string, string> = {}) {
  return {
    get: vi.fn((name: string) => values[name] ?? null),
  };
}

function createMockSupabase({
  signInError,
  signInData,
  signOutError,
  user,
  profile,
  otpError,
  verifyOtpError,
  resetError,
  mfaLevel,
}: {
  signInError?: { message: string } | null;
  signInData?: { user: { id: string } } | null;
  signOutError?: Error | null;
  user?: { id: string } | null;
  profile?: Record<string, unknown> | null;
  otpError?: { message: string } | null;
  verifyOtpError?: { message: string } | null;
  resetError?: { message: string } | null;
  mfaLevel?: { currentLevel: string; nextLevel: string } | null;
} = {}) {
  const supabase = {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({
        data: signInData ?? (signInError ? null : { user: user ?? null }),
        error: signInError ?? null,
      }),
      signOut: signOutError
        ? vi.fn().mockRejectedValue(signOutError)
        : vi.fn().mockResolvedValue({ error: null }),
      getUser: vi.fn().mockResolvedValue({
        data: { user: user ?? null },
      }),
      signInWithOtp: vi.fn().mockResolvedValue({
        error: otpError ?? null,
      }),
      verifyOtp: vi.fn().mockResolvedValue({
        error: verifyOtpError ?? null,
      }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({
        error: resetError ?? null,
      }),
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
          data: mfaLevel ?? { currentLevel: "aal1", nextLevel: "aal1" },
        }),
      },
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
    vi.mocked(headers).mockResolvedValue(
      createMockHeaders({ "cf-connecting-ip": "1.2.3.4" }) as never,
    );
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

  it("returns mfa_required when MFA is needed", async () => {
    vi.mocked(loginLimiter.check).mockResolvedValue(true);
    vi.mocked(accountLockoutLimiter.check).mockResolvedValue(true);

    const mockSupabase = createMockSupabase({
      signInData: { user: { id: "user-1" } },
      user: { id: "user-1" },
      mfaLevel: { currentLevel: "aal1", nextLevel: "aal2" },
    });
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const result = await signInWithPassword("test@example.com", "password");

    expect(result.error).toBe("mfa_required");
  });

  it("blocks seed user login in production", async () => {
    vi.mocked(loginLimiter.check).mockResolvedValue(true);
    vi.mocked(accountLockoutLimiter.check).mockResolvedValue(true);

    const { isSeedUserBlocked } = await import("@/lib/seed-guard");
    vi.mocked(isSeedUserBlocked).mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    const mockSupabase = createMockSupabase({
      signInData: { user: { id: "a0000000-0000-0000-0000-000000000001" } },
      user: { id: "a0000000-0000-0000-0000-000000000001" },
    });
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const result = await signInWithPassword("seed@example.com", "password");

    expect(result.error).toBe("auth.invalidCredentials");
    expect(mockSupabase.auth.signOut).toHaveBeenCalled();
  });

  it("blocks recreated seed accounts by email before password auth runs", async () => {
    vi.mocked(loginLimiter.check).mockResolvedValue(true);
    vi.mocked(accountLockoutLimiter.check).mockResolvedValue(true);

    const { isSeedUserBlocked } = await import("@/lib/seed-guard");
    vi.mocked(isSeedUserBlocked).mockResolvedValueOnce(true);

    const result = await signInWithPassword("seed@example.com", "password");

    expect(result.error).toBe("auth.invalidCredentials");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("redirects to role dashboard on successful login", async () => {
    vi.mocked(loginLimiter.check).mockResolvedValue(true);
    vi.mocked(accountLockoutLimiter.check).mockResolvedValue(true);

    const { isSeedUserBlocked } = await import("@/lib/seed-guard");
    vi.mocked(isSeedUserBlocked).mockResolvedValue(false);

    const mockProfile = {
      id: "user-1",
      auth_id: "auth-1",
      clinic_id: "clinic-1",
      role: "clinic_admin",
      name: "Admin",
      phone: null,
      email: "admin@test.com",
      avatar_url: null,
      is_active: true,
      metadata: {},
    };

    const mockSupabase = createMockSupabase({
      signInData: { user: { id: "auth-1" } },
      user: { id: "auth-1" },
      profile: mockProfile,
    });
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const result = await signInWithPassword("admin@test.com", "pass");
    expect(result.error).toBeNull();
    expect(result.redirectTo).toBe("/admin/dashboard");
  });

  it("redirects to patient dashboard when no profile found", async () => {
    vi.mocked(loginLimiter.check).mockResolvedValue(true);
    vi.mocked(accountLockoutLimiter.check).mockResolvedValue(true);

    const { isSeedUserBlocked } = await import("@/lib/seed-guard");
    vi.mocked(isSeedUserBlocked).mockResolvedValue(false);

    const mockSupabase = createMockSupabase({
      signInData: { user: { id: "auth-1" } },
      user: null,
      profile: null,
    });
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const result = await signInWithPassword("new@test.com", "pass");
    expect(result.error).toBeNull();
    expect(result.redirectTo).toBe("/patient/dashboard");
  });

  it("uses cf-connecting-ip for rate limiting, not x-forwarded-for", async () => {
    vi.mocked(headers).mockResolvedValue(
      createMockHeaders({
        "cf-connecting-ip": "10.0.0.1",
        "x-forwarded-for": "spoofed.ip",
      }) as never,
    );
    vi.mocked(loginLimiter.check).mockResolvedValue(false);

    await signInWithPassword("test@test.com", "pass");

    expect(loginLimiter.check).toHaveBeenCalledWith("login:ip:10.0.0.1");
  });

  it("falls back to 'unknown' IP when cf-connecting-ip is absent", async () => {
    vi.mocked(headers).mockResolvedValue(createMockHeaders({}) as never);
    vi.mocked(loginLimiter.check).mockResolvedValue(false);

    await signInWithPassword("test@test.com", "pass");

    expect(loginLimiter.check).toHaveBeenCalledWith("login:ip:unknown");
  });
});

describe("signInWithOTP", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(headers).mockResolvedValue(createMockHeaders() as never);
  });

  it("returns error when phone auth is disabled", async () => {
    const original = process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED;
    delete process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED;

    const result = await signInWithOTP("+212600000000");

    expect(result.error).toBe("auth.phoneDisabled");
    process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED = original;
  });

  it("returns error when OTP rate limit is hit", async () => {
    const original = process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED;
    process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED = "true";
    vi.mocked(otpSendLimiter.check).mockResolvedValue(false);

    const result = await signInWithOTP("+212600000000");

    expect(result.error).toBe("auth.rateLimitOtp");
    process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED = original;
  });

  it("returns error from Supabase on OTP failure", async () => {
    const original = process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED;
    process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED = "true";
    vi.mocked(otpSendLimiter.check).mockResolvedValue(true);

    const mockSupabase = createMockSupabase({ otpError: { message: "Phone not valid" } });
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const result = await signInWithOTP("+212600000000");

    expect(result.error).toBe("Phone not valid");
    process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED = original;
  });

  it("returns null error on OTP success", async () => {
    const original = process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED;
    process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED = "true";
    vi.mocked(otpSendLimiter.check).mockResolvedValue(true);

    const mockSupabase = createMockSupabase();
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const result = await signInWithOTP("+212600000000");

    expect(result.error).toBeNull();
    process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED = original;
  });
});

describe("verifyOTP", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(headers).mockResolvedValue(createMockHeaders() as never);
  });

  it("returns error when phone auth is disabled", async () => {
    const original = process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED;
    delete process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED;

    const result = await verifyOTP("+212600000000", "123456");

    expect(result.error).toBe("auth.phoneDisabled");
    process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED = original;
  });

  it("returns Supabase error on invalid OTP", async () => {
    const original = process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED;
    process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED = "true";

    const mockSupabase = createMockSupabase({ verifyOtpError: { message: "Invalid OTP" } });
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const result = await verifyOTP("+212600000000", "000000");

    expect(result.error).toBe("Invalid OTP");
    process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED = original;
  });

  it("redirects to role dashboard on successful verify", async () => {
    const original = process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED;
    process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED = "true";

    const mockProfile = {
      id: "u-1",
      auth_id: "a-1",
      clinic_id: "c-1",
      role: "doctor",
      name: "Dr Test",
      phone: "+212600000000",
      email: null,
      avatar_url: null,
      is_active: true,
      metadata: {},
    };
    const mockSupabase = createMockSupabase({
      user: { id: "a-1" },
      profile: mockProfile,
    });
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const result = await verifyOTP("+212600000000", "123456");
    expect(result.error).toBeNull();
    expect(result.redirectTo).toBe("/doctor/dashboard");
    process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED = original;
  });
});

describe("signInWithEmailOTP", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(headers).mockResolvedValue(
      createMockHeaders({ "cf-connecting-ip": "10.20.30.40" }) as never,
    );
  });

  it("rejects invalid email before touching Supabase", async () => {
    const result = await signInWithEmailOTP("not-an-email");

    expect(result.error).toBe("auth.invalidEmail");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rate-limits by IP first", async () => {
    vi.mocked(otpSendLimiter.check).mockResolvedValueOnce(false);

    const result = await signInWithEmailOTP("test@example.com");

    expect(result.error).toBe("auth.rateLimitOtp");
    expect(otpSendLimiter.check).toHaveBeenCalledWith("otp:email:ip:10.20.30.40");
  });

  it("rate-limits by normalized email", async () => {
    vi.mocked(otpSendLimiter.check).mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const result = await signInWithEmailOTP("  Test@Example.COM  ");

    expect(result.error).toBe("auth.rateLimitOtp");
    expect(otpSendLimiter.check).toHaveBeenNthCalledWith(2, "otp:email:test@example.com");
  });

  it("blocks seed users before sending the OTP", async () => {
    vi.mocked(otpSendLimiter.check).mockResolvedValue(true);
    const { isSeedUserBlocked } = await import("@/lib/seed-guard");
    vi.mocked(isSeedUserBlocked).mockResolvedValueOnce(true);

    const result = await signInWithEmailOTP("seed@example.com");

    expect(result.error).toBe("auth.invalidCredentials");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("returns a generic send error when Supabase rejects the email OTP", async () => {
    vi.mocked(otpSendLimiter.check).mockResolvedValue(true);
    const mockSupabase = createMockSupabase({ otpError: { message: "SMTP down" } });
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const result = await signInWithEmailOTP("test@example.com");

    expect(result.error).toBe("auth.emailOtpSendError");
  });

  it("normalizes email and returns null on success", async () => {
    vi.mocked(otpSendLimiter.check).mockResolvedValue(true);
    const mockSupabase = createMockSupabase();
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const result = await signInWithEmailOTP("  Test@Example.COM  ");

    expect(result.error).toBeNull();
    expect(mockSupabase.auth.signInWithOtp).toHaveBeenCalledWith({ email: "test@example.com" });
  });
});

describe("verifyEmailOTP", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(headers).mockResolvedValue(createMockHeaders() as never);
  });

  it("rejects invalid email or token before calling Supabase", async () => {
    const result = await verifyEmailOTP("not-an-email", "123");

    expect(result.error).toBe("auth.invalidOtp");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("returns invalidOtp when Supabase rejects the token", async () => {
    const mockSupabase = createMockSupabase({ verifyOtpError: { message: "bad token" } });
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const result = await verifyEmailOTP("test@example.com", "123456");

    expect(result.error).toBe("auth.invalidOtp");
  });

  it("normalizes email and redirects to the role dashboard on success", async () => {
    const mockProfile = {
      id: "user-1",
      auth_id: "auth-1",
      clinic_id: "clinic-1",
      role: "clinic_admin",
      name: "Admin",
      phone: null,
      email: "test@example.com",
      avatar_url: null,
      is_active: true,
      metadata: {},
    };
    const mockSupabase = createMockSupabase({ user: { id: "auth-1" }, profile: mockProfile });
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const result = await verifyEmailOTP("  Test@Example.COM  ", "123456");

    expect(result.error).toBeNull();
    expect(result.redirectTo).toBe("/admin/dashboard");
    expect(mockSupabase.auth.verifyOtp).toHaveBeenCalledWith({
      email: "test@example.com",
      token: "123456",
      type: "email",
    });
  });
});

describe("registerPatient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(headers).mockResolvedValue(createMockHeaders() as never);
  });

  it("returns error when phone auth is disabled", async () => {
    const original = process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED;
    delete process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED;

    const result = await registerPatient({ phone: "+212600000000", name: "Patient" });

    expect(result.error).toBe("auth.phoneDisabled");
    process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED = original;
  });

  it("returns error when OTP rate limit is hit", async () => {
    const original = process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED;
    process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED = "true";
    vi.mocked(otpSendLimiter.check).mockResolvedValue(false);

    const result = await registerPatient({ phone: "+212600000000", name: "Patient" });

    expect(result.error).toBe("auth.rateLimitOtp");
    process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED = original;
  });

  it("passes patient metadata in OTP options", async () => {
    const original = process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED;
    process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED = "true";
    vi.mocked(otpSendLimiter.check).mockResolvedValue(true);

    const mockSupabase = createMockSupabase();
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    await registerPatient({
      phone: "+212600000000",
      name: "Test Patient",
      email: "p@test.com",
      age: 30,
      gender: "male",
      insurance: "CNSS",
    });

    expect(mockSupabase.auth.signInWithOtp).toHaveBeenCalledWith({
      phone: "+212600000000",
      options: {
        data: {
          name: "Test Patient",
          phone: "+212600000000",
          email: "p@test.com",
          age: 30,
          gender: "male",
          insurance: "CNSS",
        },
      },
    });
    process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED = original;
  });
});

describe("resetPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(headers).mockResolvedValue(
      createMockHeaders({ "cf-connecting-ip": "10.0.0.1" }) as never,
    );
  });

  it("returns error when rate limit is exceeded", async () => {
    vi.mocked(passwordResetLimiter.check).mockResolvedValue(false);

    const result = await resetPassword("test@test.com", "https://app.com/reset");

    expect(result.error).toBe("auth.rateLimitGeneric");
  });

  it("returns null error even when email does not exist (prevents enumeration)", async () => {
    vi.mocked(passwordResetLimiter.check).mockResolvedValue(true);

    const mockSupabase = createMockSupabase({
      resetError: { message: "User not found" },
    });
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const result = await resetPassword("nonexistent@test.com", "https://app.com/reset");

    expect(result.error).toBeNull();
  });

  it("normalizes email and passes redirectTo", async () => {
    vi.mocked(passwordResetLimiter.check).mockResolvedValue(true);

    const mockSupabase = createMockSupabase();
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    await resetPassword("  Test@Example.COM  ", "https://app.com/reset");

    expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith("test@example.com", {
      redirectTo: "https://app.com/reset",
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

  it("uses verified profile headers to skip the auth.getUser fallback when the row lookup succeeds", async () => {
    const { verifyProfileHeader } = await import("@/lib/profile-header-hmac");
    const mockProfile = {
      id: "user-1",
      auth_id: "auth-1",
      clinic_id: "clinic-1",
      role: "patient",
      name: "Header User",
      phone: null,
      email: "header@example.com",
      avatar_url: null,
      is_active: true,
      metadata: {},
    };
    const mockSupabase = createMockSupabase({ user: { id: "auth-1" }, profile: mockProfile });
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);
    vi.mocked(headers).mockResolvedValue(
      createMockHeaders({
        "x-profile-id": "user-1",
        "x-profile-role": "patient",
        "x-profile-clinic": "clinic-1",
        "x-profile-signature": "sig",
        "x-profile-iat": "1700000000",
      }) as never,
    );
    vi.mocked(verifyProfileHeader).mockResolvedValue({
      id: "user-1",
      role: "patient",
      clinic_id: "clinic-1",
    });

    const result = await getUserProfile();

    expect(result).toEqual(mockProfile);
    expect(verifyProfileHeader).toHaveBeenCalled();
    expect(mockSupabase.auth.getUser).not.toHaveBeenCalled();
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

  it("returns profile when authenticated", async () => {
    const mockProfile = {
      id: "user-1",
      auth_id: "auth-1",
      clinic_id: "clinic-1",
      role: "patient" as const,
      name: "Test",
      phone: null,
      email: "test@test.com",
      avatar_url: null,
      is_active: true,
      metadata: {},
    };
    const mockSupabase = createMockSupabase({ user: { id: "auth-1" }, profile: mockProfile });
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const result = await requireAuth();
    expect(result).toEqual(mockProfile);
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

  it("returns profile when user has allowed role", async () => {
    const mockProfile = {
      id: "user-1",
      auth_id: "auth-1",
      clinic_id: "clinic-1",
      role: "doctor" as const,
      name: "Dr Test",
      phone: null,
      email: null,
      avatar_url: null,
      is_active: true,
      metadata: {},
    };
    const mockSupabase = createMockSupabase({ user: { id: "auth-1" }, profile: mockProfile });
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const result = await requireRole("doctor", "clinic_admin");
    expect(result).toEqual(mockProfile);
  });
});
