/**
 * Route handler tests for POST /api/booking/cancel.
 *
 * Audit L9-03: These tests invoke the actual route handler function
 * (not just Zod schemas). They mock Supabase, tenant context, and auth
 * to verify HTTP responses, status codes, and business logic.
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock setup (must be before imports) ──────────────────────────────

const mockChainable = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
};

const mockSupabase = {
  from: vi.fn(() => mockChainable),
  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: "auth-user-1", email: "doc@test.com" } },
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
}));

vi.mock("@/lib/tenant-context", () => ({
  setTenantContext: vi.fn(),
  logTenantContext: vi.fn(),
}));

vi.mock("@/lib/audit-log", () => ({
  logAuditEvent: vi.fn(),
}));

vi.mock("@/lib/timezone", () => ({
  clinicDateTime: vi.fn(() => new Date(Date.now() + 48 * 60 * 60 * 1000)),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/notifications", () => ({
  dispatchNotification: vi.fn(),
}));

// ── Helpers ──────────────────────────────────────────────────────────

function buildCancelRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/booking/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Tests ────────────────────────────────────────────────────────────

describe("POST /api/booking/cancel — route handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: user profile lookup returns a staff user
    mockChainable.single.mockResolvedValue({
      data: { id: "user-1", role: "doctor", clinic_id: "clinic-1" },
      error: null,
    });
  });

  it("returns 422 for invalid JSON body", async () => {
    // Auth mock: getUser → user exists, profile → staff
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "auth-user-1", email: "doc@test.com" } },
      error: null,
    });

    const { POST } = await import("@/app/api/booking/cancel/route");

    const request = new NextRequest("http://localhost:3000/api/booking/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.ok).toBe(false);
  });

  it("returns 422 when appointmentId is missing", async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "auth-user-1", email: "doc@test.com" } },
      error: null,
    });

    const { POST } = await import("@/app/api/booking/cancel/route");
    const request = buildCancelRequest({ reason: "No longer needed" });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.ok).toBe(false);
  });

  it("returns 401 when user is not authenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const { POST } = await import("@/app/api/booking/cancel/route");
    const request = buildCancelRequest({
      appointmentId: "appt-1",
      reason: "Cannot make it",
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toMatch(/not authenticated/i);
  });

  it("returns 404 when appointment is not found", async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "auth-user-1", email: "doc@test.com" } },
      error: null,
    });

    // First .single() → profile lookup (staff), second → appointment not found
    mockChainable.single
      .mockResolvedValueOnce({
        data: { id: "user-1", role: "doctor", clinic_id: "clinic-1" },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: { message: "Not found" } });

    const { POST } = await import("@/app/api/booking/cancel/route");
    const request = buildCancelRequest({
      appointmentId: "nonexistent",
      reason: "Cancel",
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.ok).toBe(false);
  });

  it("returns 400 when appointment is already cancelled", async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "auth-user-1", email: "doc@test.com" } },
      error: null,
    });

    mockChainable.single
      .mockResolvedValueOnce({
        data: { id: "user-1", role: "doctor", clinic_id: "clinic-1" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: "appt-1",
          patient_id: "patient-1",
          doctor_id: "doc-1",
          service_id: "svc-1",
          appointment_date: "2026-04-15",
          start_time: "10:00",
          status: "cancelled",
        },
        error: null,
      });

    const { POST } = await import("@/app/api/booking/cancel/route");
    const request = buildCancelRequest({
      appointmentId: "appt-1",
      reason: "Cancel again",
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
  });

  it("returns 403 when patient tries to cancel another patient's appointment", async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "auth-patient-1", email: "patient@test.com" } },
      error: null,
    });

    // Profile: patient role
    mockChainable.single
      .mockResolvedValueOnce({
        data: { id: "patient-1", role: "patient", clinic_id: "clinic-1" },
        error: null,
      })
      // Appointment belongs to a different patient
      .mockResolvedValueOnce({
        data: {
          id: "appt-1",
          patient_id: "patient-OTHER",
          doctor_id: "doc-1",
          service_id: "svc-1",
          appointment_date: "2026-04-15",
          start_time: "10:00",
          status: "confirmed",
        },
        error: null,
      });

    const { POST } = await import("@/app/api/booking/cancel/route");
    const request = buildCancelRequest({
      appointmentId: "appt-1",
      reason: "Cancel",
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.ok).toBe(false);
  });
});
