/**
 * Tests for POST /api/feedback — in-app product feedback from any role.
 * Exercises validation, the happy path (role/clinic taken from the session,
 * never the body), and a DB failure, with a mocked Supabase client and a
 * pass-through auth wrapper.
 */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const CLINIC = "11111111-1111-1111-1111-111111111111";

const single = vi.fn();
const insert = vi.fn(() => ({ select: vi.fn(() => ({ single })) }));
const mockSupabase = {
  from: vi.fn(() => ({ insert })),
};

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/audit-log", () => ({ logAuditEvent: vi.fn() }));

type Handler = (...args: unknown[]) => unknown;
const auth = {
  supabase: mockSupabase,
  user: { id: "auth-1" },
  profile: { id: "user-1", role: "patient", clinic_id: CLINIC },
};
vi.mock("@/lib/with-auth", () => ({
  withAuthAnyRole: (handler: Handler) => (request: NextRequest) => handler(request, auth),
  withAuth: (handler: Handler) => (request: NextRequest) => handler(request, auth),
}));

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(
    new Request("http://demo.localhost:3000/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    single.mockResolvedValue({ data: { id: "fb-1" }, error: null });
  });

  it("rejects a message that is too short", async () => {
    const { POST } = await import("@/app/api/feedback/route");
    const res = await POST(makeRequest({ message: "hi" }));
    expect(res.status).toBe(422);
  });

  it("stores feedback using the session role/clinic, not the body", async () => {
    const { POST } = await import("@/app/api/feedback/route");
    const res = await POST(
      makeRequest({ message: "Great app, but calendar is slow", rating: 4, role: "super_admin" }),
    );
    expect(res.status).toBe(200);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        clinic_id: CLINIC,
        user_id: "user-1",
        role: "patient",
        rating: 4,
        message: "Great app, but calendar is slow",
        status: "new",
      }),
    );
  });

  it("returns 500 when the insert fails", async () => {
    single.mockResolvedValue({ data: null, error: { message: "boom" } });
    const { POST } = await import("@/app/api/feedback/route");
    const res = await POST(makeRequest({ message: "some feedback here" }));
    expect(res.status).toBe(500);
  });
});
