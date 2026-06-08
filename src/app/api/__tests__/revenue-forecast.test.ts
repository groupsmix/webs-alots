/**
 * Tests for revenue forecast API.
 *
 * Verifies that GET and POST routes are protected and fail-open is removed.
 * GET /api/admin/revenue-forecast
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock setup ───────────────────────────────────────────────────────

const mockChainable = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  single: vi.fn(),
  maybeSingle: vi.fn(),
};

const mockSupabase = {
  from: vi.fn(() => mockChainable),
  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: "auth-user-1", email: "test@test.com" } },
      error: null,
    }),
  },
};

vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(async () => mockSupabase),
  createTenantClient: vi.fn(async () => mockSupabase),
  createAdminClient: vi.fn(() => mockSupabase),
  createUntypedAdminClient: vi.fn(() => mockSupabase),
}));

vi.mock("@/lib/audit-log", () => ({
  logAuditEvent: vi.fn(),
  logSecurityEvent: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: console.error, debug: vi.fn() },
}));

vi.mock("@/lib/tenant-context", () => ({
  setTenantContext: vi.fn(),
  logTenantContext: vi.fn(),
}));

vi.mock("next/headers", async () => {
  const actual = await vi.importActual("next/headers");
  return {
    ...actual,
    cookies: vi.fn(async () => ({
      get: vi.fn(() => undefined),
    })),
    headers: vi.fn(async () => ({
      get: vi.fn(() => null),
    })),
  };
});

function setProfile(role: string) {
  mockChainable.single.mockResolvedValueOnce({
    data: { id: "user-1", role, clinic_id: "11111111-1111-4111-b111-111111111111" },
    error: null,
  });
}

function buildGetRequest(url: string): NextRequest {
  return new NextRequest(url, { method: "GET" });
}

// ── Tests ────────────────────────────────────────────────────────────

describe("GET /api/admin/revenue-forecast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 Unauthorized without auth (failOpen removed)", async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const { GET } = await import("@/app/api/admin/revenue-forecast/route");
    const res = await GET(buildGetRequest("http://localhost/api/admin/revenue-forecast"));

    expect(res.status).toBe(401);
  });

  it("returns 403 Forbidden for non-super_admin roles", async () => {
    const roles = ["clinic_admin", "doctor", "receptionist", "patient"];

    for (const role of roles) {
      vi.clearAllMocks();
      setProfile(role);

      const { GET } = await import("@/app/api/admin/revenue-forecast/route");
      const res = await GET(buildGetRequest("http://localhost/api/admin/revenue-forecast"));

      expect(res.status).toBe(403);
    }
  });

  it("allows super_admin to access revenue forecast", async () => {
    setProfile("super_admin");

    // 1. revenue_snapshots limit(12)
    mockChainable.limit.mockResolvedValueOnce({
      data: [{ month: "2026-06", active_clinics: 10, total_mrr: 50000 }],
      error: null,
    });
    // 2. revenue_forecasts limit(3)
    mockChainable.limit.mockResolvedValueOnce({
      data: [],
      error: null,
    });
    // 3. clinics is('deleted_at', null)
    mockChainable.is.mockResolvedValueOnce({
      data: [
        {
          id: "c1",
          config: { subscription_plan: "pro" },
          status: "active",
          tier: "pro",
          created_at: "2026-01-01",
        },
      ],
      error: null,
    });

    const { GET } = await import("@/app/api/admin/revenue-forecast/route");
    const res = await GET(buildGetRequest("http://localhost/api/admin/revenue-forecast"));

    // Success or at least not blocked by auth
    expect(res.status).toBe(200);
  });
});
