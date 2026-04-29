/**
 * Route handler tests for /api/checkin/* — S-02 cross-tenant rejection.
 *
 * The check-in routes are unauthenticated kiosk endpoints. They MUST
 * derive `clinicId` from the subdomain (via getTenant()) and reject any
 * request whose URL/body `clinicId` disagrees with the resolved tenant,
 * preventing cross-tenant enumeration / writes.
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (must be declared before route imports) ────────────────────

const mockChainable = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn(),
};

const mockSupabase = {
  from: vi.fn(() => mockChainable),
};

vi.mock("@/lib/supabase-server", () => ({
  createTenantClient: vi.fn(async () => mockSupabase),
}));

const getTenantMock = vi.fn();
vi.mock("@/lib/tenant", () => ({
  getTenant: () => getTenantMock(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const TENANT_CLINIC_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_CLINIC_ID = "22222222-2222-2222-2222-222222222222";

const TENANT = {
  clinicId: TENANT_CLINIC_ID,
  clinicName: "Test Clinic",
  subdomain: "test",
  clinicType: "doctor",
  clinicTier: "pro",
};

beforeEach(() => {
  vi.clearAllMocks();
  getTenantMock.mockResolvedValue(TENANT);
  // Default: kiosk lookup chain returns no rows
  mockChainable.single.mockResolvedValue({ data: null, error: null });
  // Default: order/in returns no appointments
  // (mockChainable returns itself so callers `.then` resolves to whatever
  //  we set on the last leaf; callers in the routes use the result of
  //  .order(...) directly, so we configure that per-test where needed.)
  mockChainable.order.mockResolvedValue({ data: [], error: null });
});

// ── /api/checkin/status ──────────────────────────────────────────────

describe("GET /api/checkin/status", () => {
  it("rejects when no tenant is resolved (root domain)", async () => {
    getTenantMock.mockResolvedValueOnce(null);

    const { GET } = await import("@/app/api/checkin/status/route");
    const request = new NextRequest(
      `http://localhost:3000/api/checkin/status?clinicId=${TENANT_CLINIC_ID}`,
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("TENANT_REQUIRED");
  });

  it("rejects when URL clinicId disagrees with subdomain tenant", async () => {
    const { GET } = await import("@/app/api/checkin/status/route");
    const request = new NextRequest(
      `http://localhost:3000/api/checkin/status?clinicId=${OTHER_CLINIC_ID}`,
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe("TENANT_MISMATCH");
  });

  it("uses subdomain-resolved clinicId when no query clinicId is supplied", async () => {
    mockChainable.single.mockResolvedValueOnce({
      data: { kiosk_mode_enabled: true },
      error: null,
    });

    const { GET } = await import("@/app/api/checkin/status/route");
    const request = new NextRequest("http://localhost:3000/api/checkin/status");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.enabled).toBe(true);
    // Confirm we never used a foreign clinic id when scoping the query.
    expect(mockChainable.eq).toHaveBeenCalledWith("id", TENANT_CLINIC_ID);
  });
});

// ── /api/checkin/lookup ──────────────────────────────────────────────

describe("GET /api/checkin/lookup", () => {
  it("rejects when no tenant is resolved", async () => {
    getTenantMock.mockResolvedValueOnce(null);

    const { GET } = await import("@/app/api/checkin/lookup/route");
    const request = new NextRequest(
      `http://localhost:3000/api/checkin/lookup?phone=%2B212600000000&clinicId=${TENANT_CLINIC_ID}`,
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("TENANT_REQUIRED");
  });

  it("rejects when URL clinicId disagrees with subdomain tenant", async () => {
    const { GET } = await import("@/app/api/checkin/lookup/route");
    const request = new NextRequest(
      `http://localhost:3000/api/checkin/lookup?phone=%2B212600000000&clinicId=${OTHER_CLINIC_ID}`,
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe("TENANT_MISMATCH");
  });

  it("returns 400 when phone is missing", async () => {
    const { GET } = await import("@/app/api/checkin/lookup/route");
    const request = new NextRequest("http://localhost:3000/api/checkin/lookup");
    const response = await GET(request);
    expect(response.status).toBe(400);
  });
});

// ── /api/checkin/confirm ─────────────────────────────────────────────

describe("POST /api/checkin/confirm", () => {
  function buildRequest(body: Record<string, unknown>): NextRequest {
    return new NextRequest("http://localhost:3000/api/checkin/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("rejects when no tenant is resolved", async () => {
    getTenantMock.mockResolvedValueOnce(null);

    const { POST } = await import("@/app/api/checkin/confirm/route");
    const response = await POST(
      buildRequest({ appointmentId: "appt-1", clinicId: TENANT_CLINIC_ID }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("TENANT_REQUIRED");
  });

  it("rejects when body clinicId disagrees with subdomain tenant", async () => {
    const { POST } = await import("@/app/api/checkin/confirm/route");
    const response = await POST(
      buildRequest({ appointmentId: "appt-1", clinicId: OTHER_CLINIC_ID }),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe("TENANT_MISMATCH");
  });

  it("scopes the appointment update by the subdomain-resolved clinicId", async () => {
    // appointment update returns no error
    const updateChain = {
      eq: vi.fn().mockReturnThis(),
    };
    // last .eq() must resolve the promise
    let updateCallCount = 0;
    updateChain.eq.mockImplementation(() => {
      updateCallCount++;
      return updateCallCount >= 2
        ? Promise.resolve({ error: null })
        : updateChain;
    });

    mockChainable.update.mockReturnValueOnce(updateChain);

    // checked-in queue lookup returns empty
    mockChainable.order.mockResolvedValueOnce({ data: [], error: null });

    const { POST } = await import("@/app/api/checkin/confirm/route");
    const response = await POST(
      buildRequest({ appointmentId: "appt-1", clinicId: TENANT_CLINIC_ID }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.checkedIn).toBe(true);
    // The update chain must have scoped by both id and the resolved clinic_id.
    expect(updateChain.eq).toHaveBeenCalledWith("id", "appt-1");
    expect(updateChain.eq).toHaveBeenCalledWith("clinic_id", TENANT_CLINIC_ID);
  });
});
