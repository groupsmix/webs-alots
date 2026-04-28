import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createClient } from "@/lib/supabase-server";
import { withAuth, withAuthAnyRole, type AuthContext } from "../with-auth";

vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(),
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

    const handler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
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

    const handler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
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

    const handler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
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

      const handler = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
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
});
