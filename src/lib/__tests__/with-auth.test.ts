import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClient } from "@/lib/supabase-server";
import { withAuth, type AuthContext } from "../with-auth";

vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(),
}));

function createMockRequest(): { headers: Map<string, string>; method: string; nextUrl: { pathname: string } } {
  return {
    headers: new Map(),
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

  it("skips role check when allowedRoles is null", async () => {
    const mockUser = { id: "user-1" };
    const mockProfile = { id: "profile-1", role: "patient", clinic_id: null };
    const mockSupabase = createMockSupabase(mockUser, mockProfile);
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const handler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const wrappedHandler = withAuth(handler, null);

    await wrappedHandler(createMockRequest() as never);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when an unexpected error occurs", async () => {
    vi.mocked(createClient).mockRejectedValue(new Error("DB down"));

    const handler = vi.fn();
    const wrappedHandler = withAuth(handler, null);

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
});
