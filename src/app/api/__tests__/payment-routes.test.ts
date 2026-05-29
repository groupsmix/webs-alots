/**
 * Route handler tests for payment endpoints:
 *   POST /api/booking/payment/initiate
 *   POST /api/booking/payment/confirm
 *   POST /api/booking/payment/refund
 *
 * Mocks Supabase, tenant context, and auth to verify HTTP responses,
 * status codes, tenant scoping, and business logic.
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock setup ───────────────────────────────────────────────────────

const mockChainable = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  not: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn(),
  maybeSingle: vi.fn(),
};

const mockSupabase = {
  from: vi.fn(() => mockChainable),
  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: "auth-user-1", email: "staff@test.com" } },
      error: null,
    }),
  },
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
};

vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(async () => mockSupabase),
  createTenantClient: vi.fn(async () => mockSupabase),
}));

vi.mock("@/lib/tenant", () => ({
  requireTenant: vi.fn(async () => ({
    clinicId: "clinic-1",
    clinicName: "Test Clinic",
    subdomain: "test",
    clinicType: "doctor",
    clinicTier: "pro",
  })),
}));

vi.mock("@/lib/tenant-context", () => ({
  setTenantContext: vi.fn(),
  logTenantContext: vi.fn(),
}));

vi.mock("@/lib/audit-log", () => ({
  logAuditEvent: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/find-or-create-patient", () => ({
  findOrCreatePatient: vi.fn(async () => "patient-resolved-1"),
}));

vi.mock("@/lib/profile-header-hmac", () => ({
  verifyProfileHeader: vi.fn(async () => null),
  PROFILE_HEADER_NAMES: {
    id: "x-auth-profile-id",
    role: "x-auth-profile-role",
    clinic: "x-auth-profile-clinic",
    sig: "x-auth-profile-sig",
    iat: "x-auth-profile-iat",
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  perUserLimiter: { check: vi.fn(async () => ({ allowed: true })) },
}));

// ── Helpers ──────────────────────────────────────────────────────────

function buildRequest(url: string, body: Record<string, unknown>): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function setProfile(role: string, clinicId = "clinic-1") {
  // First call: profile lookup in withAuth
  mockChainable.single.mockResolvedValueOnce({
    data: { id: "user-1", role, clinic_id: clinicId },
    error: null,
  });
}

// ── Payment Initiate Tests ───────────────────────────────────────────

describe("POST /api/booking/payment/initiate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validBody = {
    appointmentId: "appt-1",
    patientId: "patient-1",
    patientName: "Karim Test",
    amount: 500,
    paymentType: "full",
  };

  it("returns 401 when not authenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const { POST } = await import("@/app/api/booking/payment/initiate/route");
    const res = await POST(
      buildRequest("http://localhost/api/booking/payment/initiate", validBody),
    );
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBeDefined();
  });

  it("returns 403 when patient role tries to access", async () => {
    setProfile("patient");

    const { POST } = await import("@/app/api/booking/payment/initiate/route");
    const res = await POST(
      buildRequest("http://localhost/api/booking/payment/initiate", validBody),
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBeDefined();
  });

  it("returns 422 for invalid body (missing appointmentId)", async () => {
    setProfile("clinic_admin");

    const { POST } = await import("@/app/api/booking/payment/initiate/route");
    const res = await POST(
      buildRequest("http://localhost/api/booking/payment/initiate", {
        patientId: "p-1",
        patientName: "Karim",
        amount: 500,
        paymentType: "full",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.ok).toBe(false);
  });

  it("returns 404 when appointment not found", async () => {
    setProfile("receptionist");

    // Appointment lookup returns nothing
    mockChainable.single.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });

    const { POST } = await import("@/app/api/booking/payment/initiate/route");
    const res = await POST(
      buildRequest("http://localhost/api/booking/payment/initiate", validBody),
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.ok).toBe(false);
  });

  it("returns 400 when a payment already exists for the appointment", async () => {
    setProfile("doctor");

    // Appointment found
    mockChainable.single.mockResolvedValueOnce({ data: { id: "appt-1" }, error: null });
    // Existing payment found
    mockChainable.single.mockResolvedValueOnce({ data: { id: "pay-existing" }, error: null });

    const { POST } = await import("@/app/api/booking/payment/initiate/route");
    const res = await POST(
      buildRequest("http://localhost/api/booking/payment/initiate", validBody),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("already exists");
  });

  it("creates payment successfully for staff role", async () => {
    setProfile("clinic_admin");

    // Appointment found
    mockChainable.single.mockResolvedValueOnce({ data: { id: "appt-1" }, error: null });
    // No existing payment
    mockChainable.single.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });
    // Insert payment success
    mockChainable.single.mockResolvedValueOnce({ data: { id: "pay-new-1" }, error: null });

    const { POST } = await import("@/app/api/booking/payment/initiate/route");
    const res = await POST(
      buildRequest("http://localhost/api/booking/payment/initiate", validBody),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.paymentId).toBe("pay-new-1");
    expect(body.data.status).toBe("initiated");
  });

  it("returns 409 on duplicate payment constraint violation", async () => {
    setProfile("receptionist");

    // Appointment found
    mockChainable.single.mockResolvedValueOnce({ data: { id: "appt-1" }, error: null });
    // No existing payment
    mockChainable.single.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });
    // Insert fails with unique constraint
    mockChainable.single.mockResolvedValueOnce({ data: null, error: { code: "23505" } });

    const { POST } = await import("@/app/api/booking/payment/initiate/route");
    const res = await POST(
      buildRequest("http://localhost/api/booking/payment/initiate", validBody),
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.ok).toBe(false);
  });

  it("scopes queries to the correct clinic_id", async () => {
    setProfile("clinic_admin");

    mockChainable.single.mockResolvedValueOnce({ data: { id: "appt-1" }, error: null });
    mockChainable.single.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });
    mockChainable.single.mockResolvedValueOnce({ data: { id: "pay-1" }, error: null });

    const { POST } = await import("@/app/api/booking/payment/initiate/route");
    await POST(buildRequest("http://localhost/api/booking/payment/initiate", validBody));

    // Verify clinic_id scoping on queries
    const eqCalls = mockChainable.eq.mock.calls;
    const clinicIdCalls = eqCalls.filter(
      (call: unknown[]) => call[0] === "clinic_id" && call[1] === "clinic-1",
    );
    expect(clinicIdCalls.length).toBeGreaterThanOrEqual(2);
  });
});

// ── Payment Confirm Tests ────────────────────────────────────────────

describe("POST /api/booking/payment/confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const { POST } = await import("@/app/api/booking/payment/confirm/route");
    const res = await POST(
      buildRequest("http://localhost/api/booking/payment/confirm", { paymentId: "pay-1" }),
    );

    expect(res.status).toBe(401);
  });

  it("returns 403 when patient tries to confirm", async () => {
    setProfile("patient");

    const { POST } = await import("@/app/api/booking/payment/confirm/route");
    const res = await POST(
      buildRequest("http://localhost/api/booking/payment/confirm", { paymentId: "pay-1" }),
    );

    expect(res.status).toBe(403);
  });

  it("returns 404 when payment not found", async () => {
    setProfile("clinic_admin");

    mockChainable.single.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });

    const { POST } = await import("@/app/api/booking/payment/confirm/route");
    const res = await POST(
      buildRequest("http://localhost/api/booking/payment/confirm", { paymentId: "pay-missing" }),
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.ok).toBe(false);
  });

  it("returns 400 when payment is not pending", async () => {
    setProfile("receptionist");

    mockChainable.single.mockResolvedValueOnce({
      data: { id: "pay-1", status: "completed", appointment_id: "appt-1" },
      error: null,
    });

    const { POST } = await import("@/app/api/booking/payment/confirm/route");
    const res = await POST(
      buildRequest("http://localhost/api/booking/payment/confirm", { paymentId: "pay-1" }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("not in pending state");
  });

  it("confirms payment and updates appointment status", async () => {
    setProfile("clinic_admin");

    // Payment found in pending state
    mockChainable.single.mockResolvedValueOnce({
      data: { id: "pay-1", status: "pending", appointment_id: "appt-1" },
      error: null,
    });

    const { POST } = await import("@/app/api/booking/payment/confirm/route");
    const res = await POST(
      buildRequest("http://localhost/api/booking/payment/confirm", { paymentId: "pay-1" }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.status).toBe("confirmed");

    // Verify update was called on payments and appointments
    expect(mockSupabase.from).toHaveBeenCalledWith("payments");
    expect(mockSupabase.from).toHaveBeenCalledWith("appointments");
  });
});

// ── Payment Refund Tests ─────────────────────────────────────────────

describe("POST /api/booking/payment/refund", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const { POST } = await import("@/app/api/booking/payment/refund/route");
    const res = await POST(
      buildRequest("http://localhost/api/booking/payment/refund", { paymentId: "pay-1" }),
    );

    expect(res.status).toBe(401);
  });

  it("returns 403 when non-admin role (doctor) tries to refund", async () => {
    setProfile("doctor");

    const { POST } = await import("@/app/api/booking/payment/refund/route");
    const res = await POST(
      buildRequest("http://localhost/api/booking/payment/refund", { paymentId: "pay-1" }),
    );

    expect(res.status).toBe(403);
  });

  it("returns 403 when receptionist tries to refund", async () => {
    setProfile("receptionist");

    const { POST } = await import("@/app/api/booking/payment/refund/route");
    const res = await POST(
      buildRequest("http://localhost/api/booking/payment/refund", { paymentId: "pay-1" }),
    );

    expect(res.status).toBe(403);
  });

  it("returns 403 when patient tries to refund", async () => {
    setProfile("patient");

    const { POST } = await import("@/app/api/booking/payment/refund/route");
    const res = await POST(
      buildRequest("http://localhost/api/booking/payment/refund", { paymentId: "pay-1" }),
    );

    expect(res.status).toBe(403);
  });

  it("returns 404 when payment not found", async () => {
    setProfile("clinic_admin");

    mockChainable.single.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });

    const { POST } = await import("@/app/api/booking/payment/refund/route");
    const res = await POST(
      buildRequest("http://localhost/api/booking/payment/refund", { paymentId: "pay-missing" }),
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.ok).toBe(false);
  });

  it("returns 400 when payment is not completed or partially_refunded", async () => {
    setProfile("super_admin");

    mockChainable.single.mockResolvedValueOnce({
      data: { id: "pay-1", status: "pending", amount: 500, refunded_amount: 0 },
      error: null,
    });

    const { POST } = await import("@/app/api/booking/payment/refund/route");
    const res = await POST(
      buildRequest("http://localhost/api/booking/payment/refund", { paymentId: "pay-1" }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Only completed");
  });

  it("returns 400 when refund amount exceeds remaining", async () => {
    setProfile("clinic_admin");

    mockChainable.single.mockResolvedValueOnce({
      data: { id: "pay-1", status: "completed", amount: 500, refunded_amount: 400 },
      error: null,
    });

    const { POST } = await import("@/app/api/booking/payment/refund/route");
    const res = await POST(
      buildRequest("http://localhost/api/booking/payment/refund", {
        paymentId: "pay-1",
        amount: 200,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("exceeds remaining");
  });

  it("processes full refund successfully for clinic_admin", async () => {
    setProfile("clinic_admin");

    mockChainable.single.mockResolvedValueOnce({
      data: { id: "pay-1", status: "completed", amount: 500, refunded_amount: 0 },
      error: null,
    });
    // Update returns updated row
    mockChainable.maybeSingle.mockResolvedValueOnce({
      data: { id: "pay-1" },
      error: null,
    });

    const { POST } = await import("@/app/api/booking/payment/refund/route");
    const res = await POST(
      buildRequest("http://localhost/api/booking/payment/refund", { paymentId: "pay-1" }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.status).toBe("refunded");
  });

  it("processes partial refund for super_admin", async () => {
    setProfile("super_admin");

    mockChainable.single.mockResolvedValueOnce({
      data: { id: "pay-1", status: "completed", amount: 500, refunded_amount: 0 },
      error: null,
    });
    mockChainable.maybeSingle.mockResolvedValueOnce({
      data: { id: "pay-1" },
      error: null,
    });

    const { POST } = await import("@/app/api/booking/payment/refund/route");
    const res = await POST(
      buildRequest("http://localhost/api/booking/payment/refund", {
        paymentId: "pay-1",
        amount: 200,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.status).toBe("refunded");
  });

  it("returns 409 on concurrent refund detection", async () => {
    setProfile("clinic_admin");

    mockChainable.single.mockResolvedValueOnce({
      data: { id: "pay-1", status: "completed", amount: 500, refunded_amount: 0 },
      error: null,
    });
    // CAS update finds zero rows
    mockChainable.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const { POST } = await import("@/app/api/booking/payment/refund/route");
    const res = await POST(
      buildRequest("http://localhost/api/booking/payment/refund", { paymentId: "pay-1" }),
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toContain("Concurrent refund");
  });
});
