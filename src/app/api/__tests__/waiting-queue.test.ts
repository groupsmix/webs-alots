/**
 * Tests for the waiting queue API.
 *
 * GET /api/waiting-queue — fetch live queue
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/waiting-queue/route";

// ── Mock setup ────────────────────────────────────────────────────────

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

const getTenant = vi.fn();
vi.mock("@/lib/tenant", () => ({
  getTenant: () => getTenant(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Helpers ────────────────────────────────────────────────────────────

const CLINIC = "11111111-1111-1111-1111-111111111111";

function withTenant(clinicId: string | null) {
  getTenant.mockReturnValue(
    clinicId
      ? { clinicId, clinicName: "Test", subdomain: "test", clinicType: "clinic", clinicTier: "pro" }
      : null,
  );
}

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

  it("rejects without clinic context (400)", async () => {
    withTenant(null);
    const res = await GET(req());
    expect(res.status).toBe(400);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("returns empty queue", async () => {
    withTenant(CLINIC);
    mockChainable.order.mockResolvedValueOnce({ data: [], error: null });

    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.queue).toEqual([]);
    expect(body.data.totalWaiting).toBe(0);
  });

  it("returns queue entries scoped to clinic", async () => {
    withTenant(CLINIC);
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
    withTenant(CLINIC);
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
