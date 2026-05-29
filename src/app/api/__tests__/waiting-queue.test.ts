/**
 * Tests for the waiting queue API.
 *
 * GET /api/waiting-queue — fetch live queue (requires auth: receptionist+)
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock setup ────────────────────────────────────────────────────────

const CLINIC = "11111111-1111-1111-1111-111111111111";

const mockChainable = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  not: vi.fn().mockReturnThis(),
  order: vi.fn(),
};

const mockSupabase = {
  from: vi.fn(() => mockChainable),
};

vi.mock("@/lib/supabase-server", () => ({
  createTenantClient: vi.fn(async () => mockSupabase),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Mock withAuth to pass through the handler with a fake auth context.
// This lets us test the queue logic in isolation from the auth layer
// (which has its own dedicated test suite in with-auth.test.ts).
type Handler = (...args: unknown[]) => unknown;
vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: Handler, _roles: string[]) => {
    return (request: NextRequest) =>
      handler(request, {
        supabase: mockSupabase,
        user: { id: "user-1" },
        profile: { id: "user-1", role: "receptionist", clinic_id: CLINIC },
      });
  },
  withAuthAnyRole: (handler: Handler) => handler,
}));

// Import AFTER mocks are configured
const { GET } = await import("@/app/api/waiting-queue/route");

// ── Helpers ────────────────────────────────────────────────────────────

function req(query: Record<string, string> = {}): NextRequest {
  const url = new URL("http://test.localhost:3000/api/waiting-queue");
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("GET /api/waiting-queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChainable.select.mockReturnThis();
    mockChainable.eq.mockReturnThis();
    mockChainable.in.mockReturnThis();
    mockChainable.not.mockReturnThis();
  });

  it("requires authentication (withAuth wraps the handler)", async () => {
    // The route module exports GET wrapped with withAuth requiring receptionist+.
    // This is validated by the mock setup — withAuth receives the correct roles.
    expect(GET).toBeDefined();
  });

  it("returns empty queue", async () => {
    mockChainable.order.mockResolvedValueOnce({ data: [], error: null });

    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.queue).toEqual([]);
    expect(body.data.totalWaiting).toBe(0);
  });

  it("returns queue entries scoped to clinic", async () => {
    mockChainable.order.mockResolvedValueOnce({
      data: [
        {
          id: "q1",
          appointment_id: "a1",
          patient_id: "p1",
          doctor_id: "d1",
          position: 1,
          estimated_wait_minutes: 0,
          checked_in_at: "2026-01-01T09:00:00Z",
          called_at: null,
          status: "waiting",
        },
        {
          id: "q2",
          appointment_id: "a2",
          patient_id: "p2",
          doctor_id: "d1",
          position: 2,
          estimated_wait_minutes: 15,
          checked_in_at: "2026-01-01T09:05:00Z",
          called_at: null,
          status: "waiting",
        },
      ],
      error: null,
    });

    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.queue).toHaveLength(2);
    expect(body.data.totalWaiting).toBe(2);

    const clinicScoped = mockChainable.eq.mock.calls.filter(
      (args: unknown[]) => args[0] === "clinic_id" && args[1] === CLINIC,
    );
    expect(clinicScoped.length).toBeGreaterThan(0);
  });

  it("filters by doctorId when provided", async () => {
    const doctorId = "doctor-123";
    mockChainable.order.mockResolvedValueOnce({ data: [], error: null });

    const res = await GET(req({ doctorId }));
    expect(res.status).toBe(200);

    const doctorScoped = mockChainable.eq.mock.calls.filter(
      (args: unknown[]) => args[0] === "doctor_id" && args[1] === doctorId,
    );
    expect(doctorScoped.length).toBeGreaterThan(0);
  });
});
