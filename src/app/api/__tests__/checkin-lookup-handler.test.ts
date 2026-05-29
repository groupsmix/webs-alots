/**
 * Route handler tests for GET /api/checkin/lookup.
 *
 * This is a PUBLIC (unauthenticated) endpoint, so its tenant-scoping
 * guarantees are the only thing standing between a caller and another
 * clinic's patient data. These tests invoke the real handler and lock
 * down audit fix F-04:
 *
 *   - clinicId is ALWAYS derived from the subdomain (`getTenant`), never
 *     from a URL parameter.
 *   - A URL-supplied `clinicId` that disagrees with the subdomain is
 *     rejected with 403 (no cross-tenant enumeration on the root domain).
 *   - Every DB query is scoped to the subdomain clinic_id.
 *
 * They also pin the non-leaky "not found" behavior (empty list, not an
 * error that distinguishes "no such patient" from "no appointments").
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/checkin/lookup/route";

// ── Mock setup (must be before importing the handler) ────────────────

const mockChainable = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  order: vi.fn(),
  single: vi.fn(),
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

// ── Helpers ──────────────────────────────────────────────────────────

const CLINIC = "11111111-1111-1111-1111-111111111111";
const OTHER_CLINIC = "22222222-2222-2222-2222-222222222222";

function req(query: Record<string, string>): NextRequest {
  const url = new URL("http://test.localhost:3000/api/checkin/lookup");
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

function withTenant(clinicId: string | null) {
  getTenant.mockResolvedValue(
    clinicId ? { clinicId, clinicName: "Test", subdomain: "test" } : null,
  );
}

// ── Tests ────────────────────────────────────────────────────────────

describe("GET /api/checkin/lookup — tenant scoping (F-04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChainable.select.mockReturnThis();
    mockChainable.eq.mockReturnThis();
    mockChainable.in.mockReturnThis();
    mockChainable.limit.mockReturnThis();
  });

  it("rejects requests with no subdomain tenant (400, no DB access)", async () => {
    withTenant(null);
    const res = await GET(req({ phone: "+212600000000" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/clinic context required/i);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("requires a phone parameter (400)", async () => {
    withTenant(CLINIC);
    const res = await GET(req({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/missing phone/i);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("rejects a URL clinicId that disagrees with the subdomain (403)", async () => {
    withTenant(CLINIC);
    const res = await GET(req({ phone: "+212600000000", clinicId: OTHER_CLINIC }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/does not match subdomain/i);
    // The mismatch must be caught before any DB query runs.
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("scopes the patient lookup to the subdomain clinic_id", async () => {
    withTenant(CLINIC);
    mockChainable.single.mockResolvedValueOnce({
      data: { id: "patient-1", name: "A", phone: "x" },
    });
    mockChainable.order.mockResolvedValueOnce({ data: [] });

    const res = await GET(req({ phone: "+212600000000", clinicId: CLINIC }));
    expect(res.status).toBe(200);

    // Every query must be filtered by the subdomain clinic, never the URL value.
    const clinicScoped = mockChainable.eq.mock.calls.filter(
      ([col, val]) => col === "clinic_id" && val === CLINIC,
    );
    expect(clinicScoped.length).toBeGreaterThan(0);
    expect(mockChainable.eq.mock.calls.some(([, val]) => val === OTHER_CLINIC)).toBe(false);
  });

  it("returns an empty appointment list (not an error) when no patient matches", async () => {
    withTenant(CLINIC);
    // Primary lookup and normalized-phone fallback both miss.
    mockChainable.single
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: null });

    const res = await GET(req({ phone: "+212 600-000-000" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.appointments).toEqual([]);
  });

  it("maps today's appointments for a matched patient", async () => {
    withTenant(CLINIC);
    mockChainable.single.mockResolvedValueOnce({
      data: { id: "patient-1", name: "A", phone: "x" },
    });
    mockChainable.order.mockResolvedValueOnce({
      data: [
        {
          id: "appt-1",
          appointment_date: "2026-01-01",
          start_time: "09:00",
          status: "confirmed",
          doctors: { name: "Dr. Test" },
          services: { name: "Consultation" },
        },
      ],
    });

    const res = await GET(req({ phone: "+212600000000" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.appointments).toHaveLength(1);
    expect(body.data.appointments[0]).toMatchObject({
      id: "appt-1",
      doctorName: "Dr. Test",
      serviceName: "Consultation",
      status: "confirmed",
    });
  });
});
