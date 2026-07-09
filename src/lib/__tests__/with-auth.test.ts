import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createClient } from "@/lib/supabase-server";
import { TenantContextPermissionError } from "@/lib/tenant-context";
import { withAuth, withAuthAnyRole, type AuthContext } from "../with-auth";

vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(),
}));

const getTenantMock = vi.fn().mockResolvedValue(null);
vi.mock("@/lib/tenant", () => ({
  getTenant: (...args: unknown[]) => getTenantMock(...args),
  TENANT_HEADERS: {
    clinicId: "x-tenant-clinic-id",
    clinicName: "x-tenant-clinic-name",
    subdomain: "x-tenant-subdomain",
    clinicType: "x-tenant-clinic-type",
    clinicTier: "x-tenant-clinic-tier",
  },
}));

// Default mock keeps tenant-context a no-op so the existing happy-path tests
// (which use synthetic non-UUID clinic IDs like "clinic-1") don't trip the
// new fail-closed 503 behavior. Individual tests that need to exercise the
// fail-closed path override `setTenantContext` per-call.
const setTenantContextMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/tenant-context", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/tenant-context")>();
  return {
    setTenantContext: (...args: unknown[]) => setTenantContextMock(...args),
    logTenantContext: vi.fn(),
    // Re-export the real error class so withAuth's `instanceof` check resolves
    // against the same type the production code throws.
    TenantContextPermissionError: actual.TenantContextPermissionError,
  };
});

// Per-user rate limiter is backed by the shared distributed limiter. Mock it
// so tests can drive the allow/deny decision deterministically and assert the
// user-scoped key. Defaults to "allowed" so unrelated tests are unaffected.
const perUserLimiterCheck = vi.fn().mockResolvedValue(true);
vi.mock("@/lib/rate-limit", () => ({
  perUserLimiter: { check: (...args: unknown[]) => perUserLimiterCheck(...args) },
}));

function createMockRequest(initialHeaders?: Record<string, string>): {
  headers: Map<string, string>;
  method: string;
  nextUrl: { pathname: string };
} {
  const headers = new Map<string, string>();
  if (initialHeaders) {
    for (const [k, v] of Object.entries(initialHeaders)) {
      headers.set(k, v);
    }
  }
  // Map.get returns undefined for missing keys, but Headers.get returns null.
  // withAuth expects null, so wrap in a small adapter that mimics Headers.get.
  const headersAdapter = {
    get(key: string): string | null {
      const value = headers.get(key);
      return value === undefined ? null : value;
    },
  };
  return {
    headers: headersAdapter as unknown as Map<string, string>,
    method: "GET",
    nextUrl: { pathname: "/api/test" },
  };
}

function createMockSupabase(user: { id: string } | null, profile: Record<string, unknown> | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: profile,
          }),
        }),
      }),
    }),
  };
}

describe("withAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    const mockSupabase = createMockSupabase(null, null);
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const handler = vi.fn();
    const wrappedHandler = withAuth(handler, ["clinic_admin"]);

    const response = await wrappedHandler(createMockRequest() as never);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Not authenticated");
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 404 when user profile is not found", async () => {
    const mockSupabase = createMockSupabase({ id: "user-1" }, null);
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const handler = vi.fn();
    const wrappedHandler = withAuth(handler, ["clinic_admin"]);

    const response = await wrappedHandler(createMockRequest() as never);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("User profile not found");
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 403 when user role is not allowed", async () => {
    const mockSupabase = createMockSupabase(
      { id: "user-1" },
      { id: "profile-1", role: "patient", clinic_id: "clinic-1" },
    );
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const handler = vi.fn();
    const wrappedHandler = withAuth(handler, ["clinic_admin", "super_admin"]);

    const response = await wrappedHandler(createMockRequest() as never);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("Forbidden");
    expect(handler).not.toHaveBeenCalled();
  });

  it("calls handler with auth context when role is allowed", async () => {
    const mockUser = { id: "user-1" };
    const mockProfile = { id: "profile-1", role: "clinic_admin", clinic_id: "clinic-1" };
    const mockSupabase = createMockSupabase(mockUser, mockProfile);
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const handler = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const wrappedHandler = withAuth(handler, ["clinic_admin"]);

    await wrappedHandler(createMockRequest() as never);

    expect(handler).toHaveBeenCalledTimes(1);
    const authArg = handler.mock.calls[0][1] as AuthContext;
    expect(authArg.user).toBe(mockUser);
    expect(authArg.profile.id).toBe("profile-1");
    expect(authArg.profile.role).toBe("clinic_admin");
    expect(authArg.profile.clinic_id).toBe("clinic-1");
  });

  it("allows any authenticated user via withAuthAnyRole", async () => {
    const mockUser = { id: "user-1" };
    const mockProfile = { id: "profile-1", role: "patient", clinic_id: null };
    const mockSupabase = createMockSupabase(mockUser, mockProfile);
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const handler = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const wrappedHandler = withAuthAnyRole(handler);

    await wrappedHandler(createMockRequest() as never);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when an unexpected error occurs", async () => {
    vi.mocked(createClient).mockRejectedValue(new Error("DB down"));

    const handler = vi.fn();
    const wrappedHandler = withAuth(handler, ["clinic_admin"]);

    const response = await wrappedHandler(createMockRequest() as never);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Authentication failed");
  });

  it("handles null clinic_id in profile", async () => {
    const mockUser = { id: "user-1" };
    const mockProfile = { id: "profile-1", role: "super_admin", clinic_id: null };
    const mockSupabase = createMockSupabase(mockUser, mockProfile);
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const handler = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const wrappedHandler = withAuth(handler, ["super_admin"]);

    await wrappedHandler(createMockRequest() as never);

    const authArg = handler.mock.calls[0][1] as AuthContext;
    expect(authArg.profile.clinic_id).toBeNull();
  });

  describe("R-01: forged x-auth-profile-* headers without configured HMAC key", () => {
    const ORIGINAL_PROFILE_KEY = process.env.PROFILE_HEADER_HMAC_KEY;
    const ORIGINAL_CRON = process.env.CRON_SECRET;

    beforeEach(() => {
      delete process.env.PROFILE_HEADER_HMAC_KEY;
      delete process.env.CRON_SECRET;
    });

    afterEach(() => {
      if (ORIGINAL_PROFILE_KEY === undefined) {
        delete process.env.PROFILE_HEADER_HMAC_KEY;
      } else {
        process.env.PROFILE_HEADER_HMAC_KEY = ORIGINAL_PROFILE_KEY;
      }
      if (ORIGINAL_CRON === undefined) {
        delete process.env.CRON_SECRET;
      } else {
        process.env.CRON_SECRET = ORIGINAL_CRON;
      }
    });

    it("falls back to the DB lookup and ignores forged profile headers", async () => {
      // Real user authenticates as a low-privilege patient.
      const realUser = { id: "auth-user-1" };
      const realProfile = { id: "real-profile", role: "patient", clinic_id: "clinic-real" };
      const mockSupabase = createMockSupabase(realUser, realProfile);
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

      // Attacker injects forged super_admin profile headers. With no
      // HMAC key configured, withAuth must NOT trust them and must fetch
      // the real profile from the database instead.
      const request = createMockRequest({
        "x-auth-profile-id": "attacker-profile-id",
        "x-auth-profile-role": "super_admin",
        "x-auth-profile-clinic": "victim-clinic",
        "x-auth-profile-sig": "deadbeef".repeat(8),
      });

      const handler = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      const wrappedHandler = withAuth(handler, ["patient"]);

      await wrappedHandler(request as never);

      expect(handler).toHaveBeenCalledTimes(1);
      const authArg = handler.mock.calls[0][1] as AuthContext;
      // The attacker-supplied super_admin claims are discarded; the
      // real DB-backed patient profile wins.
      expect(authArg.profile.id).toBe("real-profile");
      expect(authArg.profile.role).toBe("patient");
      expect(authArg.profile.clinic_id).toBe("clinic-real");
    });

    it("rejects the forged super_admin role at the role-check gate", async () => {
      // Same forged headers, but the route only allows super_admin.
      // The DB-backed profile is `patient`, so withAuth must respond 403.
      const realUser = { id: "auth-user-1" };
      const realProfile = { id: "real-profile", role: "patient", clinic_id: "clinic-real" };
      const mockSupabase = createMockSupabase(realUser, realProfile);
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

      const request = createMockRequest({
        "x-auth-profile-id": "attacker-profile-id",
        "x-auth-profile-role": "super_admin",
        "x-auth-profile-clinic": "victim-clinic",
        "x-auth-profile-sig": "deadbeef".repeat(8),
      });

      const handler = vi.fn();
      const wrappedHandler = withAuth(handler, ["super_admin"]);

      const response = await wrappedHandler(request as never);
      expect(response.status).toBe(403);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // Fail-closed tenant context: a `setTenantContext` failure on a tenant-
  // scoped route MUST abort with 503 by default. Continuing would leave the
  // request relying on weaker fallback isolation checks (`get_user_clinic_id`
  // alone), which is unsafe in a multi-tenant RLS model.
  describe("setTenantContext failure handling", () => {
    beforeEach(() => {
      setTenantContextMock.mockReset();
      setTenantContextMock.mockResolvedValue(undefined);
    });

    it("returns 503 from withAuth when setTenantContext throws (fail-closed default)", async () => {
      const mockSupabase = createMockSupabase(
        { id: "user-1" },
        { id: "profile-1", role: "clinic_admin", clinic_id: "clinic-1" },
      );
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never);
      setTenantContextMock.mockRejectedValueOnce(new Error("RPC unavailable"));

      const handler = vi.fn();
      const wrappedHandler = withAuth(handler, ["clinic_admin"]);

      const response = await wrappedHandler(createMockRequest() as never);
      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body.error).toBe("Tenant context unavailable");
      expect(handler).not.toHaveBeenCalled();
    });

    it("does NOT 503 when setTenantContext is permission-denied — RLS still enforces isolation", async () => {
      // Regression guard: set_tenant_context is service_role-only, so the
      // authenticated user client can never set the app.current_clinic_id GUC.
      // That permission-denied is EXPECTED and must not fail the request
      // closed — isolation is enforced by RLS (get_user_clinic_id + the
      // x-clinic-id tenant client). The handler must still run.
      const mockSupabase = createMockSupabase(
        { id: "user-1" },
        { id: "profile-1", role: "clinic_admin", clinic_id: "clinic-1" },
      );
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never);
      setTenantContextMock.mockRejectedValueOnce(
        new TenantContextPermissionError(
          "Tenant context error: failed to set app.current_clinic_id: permission denied for function set_tenant_context",
        ),
      );

      const handler = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      const wrappedHandler = withAuth(handler, ["clinic_admin"]);

      const response = await wrappedHandler(createMockRequest() as never);

      expect(handler).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });

    it("returns 503 from withAuthAnyRole when setTenantContext throws (fail-closed default)", async () => {
      const mockSupabase = createMockSupabase(
        { id: "user-1" },
        { id: "profile-1", role: "patient", clinic_id: "clinic-1" },
      );
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never);
      setTenantContextMock.mockRejectedValueOnce(new Error("RPC unavailable"));

      const handler = vi.fn();
      const wrappedHandler = withAuthAnyRole(handler);

      const response = await wrappedHandler(createMockRequest() as never);
      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body.error).toBe("Tenant context unavailable");
      expect(handler).not.toHaveBeenCalled();
    });

    it("does NOT 503 from withAuthAnyRole when setTenantContext is permission-denied", async () => {
      const mockSupabase = createMockSupabase(
        { id: "user-1" },
        { id: "profile-1", role: "patient", clinic_id: "clinic-1" },
      );
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never);
      setTenantContextMock.mockRejectedValueOnce(
        new TenantContextPermissionError(
          "Tenant context error: failed to set app.current_clinic_id: permission denied for function set_tenant_context",
        ),
      );

      const handler = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      const wrappedHandler = withAuthAnyRole(handler);

      const response = await wrappedHandler(createMockRequest() as never);

      expect(handler).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });

    it("invokes the handler when failOpen=true even if setTenantContext throws", async () => {
      const mockUser = { id: "user-1" };
      const mockProfile = { id: "profile-1", role: "clinic_admin", clinic_id: "clinic-1" };
      const mockSupabase = createMockSupabase(mockUser, mockProfile);
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never);
      setTenantContextMock.mockRejectedValueOnce(new Error("RPC unavailable"));

      const handler = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      const wrappedHandler = withAuth(handler, ["clinic_admin"], { failOpen: true });

      const response = await wrappedHandler(createMockRequest() as never);

      expect(response.status).toBe(200);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("does not call setTenantContext when profile.clinic_id is null (super_admin)", async () => {
      const mockSupabase = createMockSupabase(
        { id: "user-1" },
        { id: "profile-1", role: "super_admin", clinic_id: null },
      );
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

      const handler = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      const wrappedHandler = withAuth(handler, ["super_admin"]);

      const response = await wrappedHandler(createMockRequest() as never);

      expect(response.status).toBe(200);
      expect(setTenantContextMock).not.toHaveBeenCalled();
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  // AUDIT-24 / S0-07-03: Per-user rate limiting is enforced via the shared
  // distributed limiter, keyed by user id so the cap is authoritative across
  // the Workers fleet rather than per-isolate.
  describe("per-user rate limiting", () => {
    beforeEach(() => {
      perUserLimiterCheck.mockReset();
      perUserLimiterCheck.mockResolvedValue(true);
    });

    it("checks the limiter with a user-scoped key and allows the request", async () => {
      const mockSupabase = createMockSupabase(
        { id: "user-1" },
        { id: "profile-1", role: "clinic_admin", clinic_id: "clinic-1" },
      );
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

      const handler = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      const wrappedHandler = withAuth(handler, ["clinic_admin"]);

      await wrappedHandler(createMockRequest() as never);

      expect(perUserLimiterCheck).toHaveBeenCalledWith("user:profile-1");
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("returns 429 when the per-user limiter denies the request", async () => {
      const mockSupabase = createMockSupabase(
        { id: "user-1" },
        { id: "profile-1", role: "clinic_admin", clinic_id: "clinic-1" },
      );
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never);
      perUserLimiterCheck.mockResolvedValue(false);

      const handler = vi.fn();
      const wrappedHandler = withAuth(handler, ["clinic_admin"]);

      const response = await wrappedHandler(createMockRequest() as never);
      const body = await response.json();

      expect(response.status).toBe(429);
      expect(body.code).toBe("USER_RATE_LIMIT");
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("withAuthAnyRole tenant mismatch", () => {
    beforeEach(() => {
      getTenantMock.mockReset();
      getTenantMock.mockResolvedValue(null);
      setTenantContextMock.mockReset();
      setTenantContextMock.mockResolvedValue(undefined);
      perUserLimiterCheck.mockReset();
      perUserLimiterCheck.mockResolvedValue(true);
    });

    it("returns 403 when profile.clinic_id does not match subdomain tenant", async () => {
      const mockSupabase = createMockSupabase(
        { id: "user-1" },
        { id: "profile-1", role: "receptionist", clinic_id: "clinic-A" },
      );
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never);
      getTenantMock.mockResolvedValue({ clinicId: "clinic-B", subdomain: "other" });

      const handler = vi.fn();
      const wrappedHandler = withAuthAnyRole(handler);

      const response = await wrappedHandler(createMockRequest() as never);
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.error).toContain("tenant mismatch");
      expect(handler).not.toHaveBeenCalled();
    });

    it("allows request when profile.clinic_id matches subdomain tenant", async () => {
      const mockSupabase = createMockSupabase(
        { id: "user-1" },
        { id: "profile-1", role: "doctor", clinic_id: "clinic-X" },
      );
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never);
      getTenantMock.mockResolvedValue({ clinicId: "clinic-X", subdomain: "myClinic" });

      const handler = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      const wrappedHandler = withAuthAnyRole(handler);

      const response = await wrappedHandler(createMockRequest() as never);

      expect(response.status).toBe(200);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("continues when getTenant throws (graceful degradation)", async () => {
      const mockSupabase = createMockSupabase(
        { id: "user-1" },
        { id: "profile-1", role: "receptionist", clinic_id: "clinic-1" },
      );
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never);
      getTenantMock.mockRejectedValue(new Error("Headers unavailable"));

      const handler = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      const wrappedHandler = withAuthAnyRole(handler);

      const response = await wrappedHandler(createMockRequest() as never);

      expect(response.status).toBe(200);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("sets Cache-Control: private, no-store on successful response", async () => {
      const mockSupabase = createMockSupabase(
        { id: "user-1" },
        { id: "profile-1", role: "patient", clinic_id: null },
      );
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

      const handler = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      const wrappedHandler = withAuthAnyRole(handler);

      const response = await wrappedHandler(createMockRequest() as never);

      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    });
  });
});
