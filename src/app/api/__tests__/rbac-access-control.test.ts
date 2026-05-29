/**
 * RBAC role access control tests for top routes.
 *
 * Verifies that:
 *   - Patients cannot access admin/staff routes
 *   - Refunds are admin-only (clinic_admin, super_admin)
 *   - Impersonation is super_admin-only
 *   - Each role can only access its permitted routes
 *
 * Tests the actual withAuth / withAuthValidation wrappers by invoking
 * route handlers and checking HTTP status codes.
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
      data: { user: { id: "auth-user-1", email: "test@test.com" } },
      error: null,
    }),
  },
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
};

vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(async () => mockSupabase),
  createTenantClient: vi.fn(async () => mockSupabase),
  createAdminClient: vi.fn(() => mockSupabase),
  createUntypedAdminClient: vi.fn(() => mockSupabase),
}));

vi.mock("@/lib/tenant", () => ({
  requireTenant: vi.fn(async () => ({
    clinicId: "clinic-1",
    clinicName: "Test Clinic",
    subdomain: "test",
    clinicType: "doctor",
    clinicTier: "pro",
  })),
  requireTenantWithConfig: vi.fn(async () => ({
    tenant: {
      clinicId: "clinic-1",
      clinicName: "Test Clinic",
      subdomain: "test",
      clinicType: "doctor",
      clinicTier: "pro",
    },
    config: {
      timezone: "Africa/Casablanca",
      currency: "MAD",
      booking: { cancellationHours: 24 },
    },
  })),
  getTenant: vi.fn(async () => ({
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
  logSecurityEvent: vi.fn(),
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

vi.mock("@/lib/timezone", () => ({
  clinicDateTime: vi.fn(() => new Date(Date.now() + 48 * 60 * 60 * 1000)),
}));

vi.mock("@/lib/notifications", () => ({
  dispatchNotification: vi.fn(),
}));

vi.mock("next/headers", async () => {
  const actual = await vi.importActual("next/headers");
  return {
    ...actual,
    cookies: vi.fn(async () => ({
      get: vi.fn(() => undefined),
      set: vi.fn(),
      delete: vi.fn(),
    })),
    headers: vi.fn(async () => ({
      get: vi.fn((name: string) => {
        const map: Record<string, string> = {
          "x-tenant-clinic-id": "clinic-1",
          "x-tenant-clinic-name": "Test Clinic",
          "x-tenant-subdomain": "test",
          "x-tenant-clinic-type": "doctor",
          "x-tenant-clinic-tier": "pro",
        };
        return map[name] ?? null;
      }),
    })),
  };
});

// ── Helpers ──────────────────────────────────────────────────────────

function setProfile(role: string, clinicId = "clinic-1") {
  mockChainable.single.mockResolvedValueOnce({
    data: { id: "user-1", role, clinic_id: clinicId },
    error: null,
  });
}

function buildPostRequest(url: string, body: Record<string, unknown>): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Tests ────────────────────────────────────────────────────────────

describe("RBAC: Payment initiate — STAFF_ROLES only", () => {
  const staffRoles = ["super_admin", "clinic_admin", "receptionist", "doctor"];

  it("allows staff roles to access payment initiate", async () => {
    for (const role of staffRoles) {
      vi.clearAllMocks();
      setProfile(role);

      // Mock appointment lookup
      mockChainable.single.mockResolvedValueOnce({ data: { id: "appt-1" }, error: null });
      // No existing payment
      mockChainable.single.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });
      // Payment insert
      mockChainable.single.mockResolvedValueOnce({ data: { id: "pay-1" }, error: null });

      const { POST } = await import("@/app/api/booking/payment/initiate/route");
      const res = await POST(
        buildPostRequest("http://localhost/api/booking/payment/initiate", {
          appointmentId: "appt-1",
          patientId: "p-1",
          patientName: "Karim",
          amount: 500,
          paymentType: "full",
        }),
      );

      expect(res.status).not.toBe(403);
    }
  });

  it("blocks patient from payment initiate", async () => {
    vi.clearAllMocks();
    setProfile("patient");

    const { POST } = await import("@/app/api/booking/payment/initiate/route");
    const res = await POST(
      buildPostRequest("http://localhost/api/booking/payment/initiate", {
        appointmentId: "appt-1",
        patientId: "p-1",
        patientName: "Karim",
        amount: 500,
        paymentType: "full",
      }),
    );

    expect(res.status).toBe(403);
  });
});

describe("RBAC: Payment refund — ADMIN_ROLES only", () => {
  const adminRoles = ["super_admin", "clinic_admin"];
  const nonAdminRoles = ["receptionist", "doctor", "patient"];

  it("allows admin roles to access refund", async () => {
    for (const role of adminRoles) {
      vi.clearAllMocks();
      setProfile(role);

      // Payment lookup
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
        buildPostRequest("http://localhost/api/booking/payment/refund", {
          paymentId: "pay-1",
        }),
      );

      expect(res.status).not.toBe(403);
    }
  });

  it("blocks non-admin roles from refund", async () => {
    for (const role of nonAdminRoles) {
      vi.clearAllMocks();
      setProfile(role);

      const { POST } = await import("@/app/api/booking/payment/refund/route");
      const res = await POST(
        buildPostRequest("http://localhost/api/booking/payment/refund", {
          paymentId: "pay-1",
        }),
      );

      expect(res.status).toBe(403);
    }
  });
});

describe("RBAC: Impersonation — super_admin only", () => {
  const nonSuperAdminRoles = ["clinic_admin", "receptionist", "doctor", "patient"];

  it("blocks non-super_admin roles from impersonation POST", async () => {
    for (const role of nonSuperAdminRoles) {
      vi.clearAllMocks();
      setProfile(role);

      const { POST } = await import("@/app/api/impersonate/route");
      const res = await POST(
        buildPostRequest("http://localhost/api/impersonate", {
          clinicId: "clinic-target",
          password: "admin-pass",
          reason: "Investigating issue",
        }),
      );

      expect(res.status).toBe(403);
    }
  });

  it("allows super_admin to access impersonation POST (past auth check)", async () => {
    vi.clearAllMocks();
    setProfile("super_admin");

    const { POST } = await import("@/app/api/impersonate/route");
    const res = await POST(
      buildPostRequest("http://localhost/api/impersonate", {
        clinicId: "clinic-target",
        password: "admin-pass",
        reason: "Investigating issue",
      }),
    );

    // Should not get 403 — may get other errors due to mock limitations
    expect(res.status).not.toBe(403);
  });
});

describe("RBAC: Patient endpoints — patient only", () => {
  const nonPatientRoles = ["super_admin", "clinic_admin", "receptionist", "doctor"];

  it("blocks non-patient roles from delete-account", async () => {
    for (const role of nonPatientRoles) {
      vi.clearAllMocks();
      setProfile(role);

      const { POST } = await import("@/app/api/patient/delete-account/route");
      const res = await POST(
        new NextRequest("http://localhost/api/patient/delete-account", { method: "POST" }),
      );

      expect(res.status).toBe(403);
    }
  });

  it("allows patient to access delete-account (past auth check)", async () => {
    vi.clearAllMocks();
    setProfile("patient");

    mockChainable.maybeSingle.mockResolvedValueOnce({
      data: { id: "user-1", role: "patient", deletion_requested_at: null },
      error: null,
    });

    const { POST } = await import("@/app/api/patient/delete-account/route");
    const res = await POST(
      new NextRequest("http://localhost/api/patient/delete-account", { method: "POST" }),
    );

    expect(res.status).not.toBe(403);
  });

  it("blocks non-patient roles from export", async () => {
    for (const role of nonPatientRoles) {
      vi.clearAllMocks();
      setProfile(role);

      const { GET } = await import("@/app/api/patient/export/route");
      const res = await GET(new NextRequest("http://localhost/api/patient/export?format=json"));

      expect(res.status).toBe(403);
    }
  });

  it("blocks non-patient roles from restrict-processing", async () => {
    for (const role of nonPatientRoles) {
      vi.clearAllMocks();
      setProfile(role);

      const { POST } = await import("@/app/api/patient/restrict-processing/route");
      const res = await POST(
        buildPostRequest("http://localhost/api/patient/restrict-processing", {
          type: "restriction",
          reason: "I want to restrict processing of my data",
          processingActivities: ["marketing"],
        }),
      );

      expect(res.status).toBe(403);
    }
  });
});

describe("RBAC: Payment confirm — STAFF_ROLES only", () => {
  it("blocks patient from payment confirm", async () => {
    vi.clearAllMocks();
    setProfile("patient");

    const { POST } = await import("@/app/api/booking/payment/confirm/route");
    const res = await POST(
      buildPostRequest("http://localhost/api/booking/payment/confirm", {
        paymentId: "pay-1",
      }),
    );

    expect(res.status).toBe(403);
  });

  it("allows receptionist to confirm payment", async () => {
    vi.clearAllMocks();
    setProfile("receptionist");

    mockChainable.single.mockResolvedValueOnce({
      data: { id: "pay-1", status: "pending", appointment_id: "appt-1" },
      error: null,
    });

    const { POST } = await import("@/app/api/booking/payment/confirm/route");
    const res = await POST(
      buildPostRequest("http://localhost/api/booking/payment/confirm", {
        paymentId: "pay-1",
      }),
    );

    expect(res.status).not.toBe(403);
  });
});

describe("RBAC: Unauthenticated access denied across all routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });
  });

  it("returns 401 for payment initiate without auth", async () => {
    const { POST } = await import("@/app/api/booking/payment/initiate/route");
    const res = await POST(
      buildPostRequest("http://localhost/api/booking/payment/initiate", {
        appointmentId: "a",
        patientId: "p",
        patientName: "N",
        amount: 100,
        paymentType: "full",
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 for payment confirm without auth", async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const { POST } = await import("@/app/api/booking/payment/confirm/route");
    const res = await POST(
      buildPostRequest("http://localhost/api/booking/payment/confirm", { paymentId: "p" }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 for payment refund without auth", async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const { POST } = await import("@/app/api/booking/payment/refund/route");
    const res = await POST(
      buildPostRequest("http://localhost/api/booking/payment/refund", { paymentId: "p" }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 for delete-account without auth", async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const { POST } = await import("@/app/api/patient/delete-account/route");
    const res = await POST(
      new NextRequest("http://localhost/api/patient/delete-account", { method: "POST" }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 for export without auth", async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const { GET } = await import("@/app/api/patient/export/route");
    const res = await GET(new NextRequest("http://localhost/api/patient/export?format=json"));
    expect(res.status).toBe(401);
  });
});
