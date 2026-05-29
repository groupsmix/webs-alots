/**
 * Route handler tests for GDPR compliance endpoints:
 *   POST /api/patient/delete-account   — Request account deletion
 *   DELETE /api/patient/delete-account  — Cancel pending deletion
 *   GET /api/patient/export             — Export personal data
 *   POST /api/patient/restrict-processing — Restrict/object processing
 *
 * Tests auth checks, tenant scoping, role restrictions, and response shapes.
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock setup ───────────────────────────────────────────────────────

function createChainable() {
  const c: Record<string, ReturnType<typeof vi.fn>> = {};
  c.select = vi.fn(() => c);
  c.insert = vi.fn(() => c);
  c.update = vi.fn(() => c);
  c.eq = vi.fn(() => c);
  c.order = vi.fn(() => c);
  c.limit = vi.fn(() => c);
  c.single = vi.fn();
  c.maybeSingle = vi.fn();
  return c;
}

let mockChainable = createChainable();

const mockSupabase = {
  from: vi.fn(() => mockChainable),
  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: "auth-user-1", email: "patient@test.com" } },
      error: null,
    }),
  },
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
};

function resetMocks() {
  mockChainable = createChainable();
  mockSupabase.from.mockImplementation(() => mockChainable);
  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user: { id: "auth-user-1", email: "patient@test.com" } },
    error: null,
  });
  mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
}

vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(async () => mockSupabase),
  createTenantClient: vi.fn(async () => mockSupabase),
}));

vi.mock("@/lib/tenant-context", () => ({
  setTenantContext: vi.fn(),
  logTenantContext: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
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

function setProfile(
  role: string,
  clinicId: string | null = "clinic-1",
  opts?: { id?: string; deletion_requested_at?: string | null },
) {
  mockChainable.single.mockResolvedValueOnce({
    data: { id: opts?.id ?? "user-1", role, clinic_id: clinicId },
    error: null,
  });
}

function setUnauthenticated() {
  mockSupabase.auth.getUser.mockResolvedValueOnce({
    data: { user: null },
    error: null,
  });
}

// ── Delete Account Tests ─────────────────────────────────────────────

describe("POST /api/patient/delete-account", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("returns 401 when not authenticated", async () => {
    setUnauthenticated();

    const { POST } = await import("@/app/api/patient/delete-account/route");
    const res = await POST(
      new NextRequest("http://localhost/api/patient/delete-account", { method: "POST" }),
    );

    expect(res.status).toBe(401);
  });

  it("returns 403 when non-patient role (doctor) tries to delete", async () => {
    setProfile("doctor");

    const { POST } = await import("@/app/api/patient/delete-account/route");
    const res = await POST(
      new NextRequest("http://localhost/api/patient/delete-account", { method: "POST" }),
    );

    expect(res.status).toBe(403);
  });

  it("returns 403 when profile has no clinic_id", async () => {
    setProfile("patient", null);

    const { POST } = await import("@/app/api/patient/delete-account/route");
    const res = await POST(
      new NextRequest("http://localhost/api/patient/delete-account", { method: "POST" }),
    );

    expect(res.status).toBe(403);
  });

  it("returns success with deletion info when patient requests deletion", async () => {
    setProfile("patient");

    // User lookup returns patient with no pending deletion
    mockChainable.maybeSingle.mockResolvedValueOnce({
      data: { id: "user-1", role: "patient", deletion_requested_at: null },
      error: null,
    });

    const { POST } = await import("@/app/api/patient/delete-account/route");
    const res = await POST(
      new NextRequest("http://localhost/api/patient/delete-account", { method: "POST" }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.deletionRequestedAt).toBeDefined();
    expect(body.data.permanentDeletionAt).toBeDefined();
  });

  it("returns existing deletion info if already requested", async () => {
    setProfile("patient");

    const existingDate = "2026-05-01T00:00:00.000Z";
    mockChainable.maybeSingle.mockResolvedValueOnce({
      data: { id: "user-1", role: "patient", deletion_requested_at: existingDate },
      error: null,
    });

    const { POST } = await import("@/app/api/patient/delete-account/route");
    const res = await POST(
      new NextRequest("http://localhost/api/patient/delete-account", { method: "POST" }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.message).toContain("already requested");
  });

  it("returns 403 when non-patient role requests self-deletion", async () => {
    setProfile("patient");

    mockChainable.maybeSingle.mockResolvedValueOnce({
      data: { id: "user-1", role: "clinic_admin", deletion_requested_at: null },
      error: null,
    });

    const { POST } = await import("@/app/api/patient/delete-account/route");
    const res = await POST(
      new NextRequest("http://localhost/api/patient/delete-account", { method: "POST" }),
    );

    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/patient/delete-account", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("returns 401 when not authenticated", async () => {
    setUnauthenticated();

    const { DELETE: handler } = await import("@/app/api/patient/delete-account/route");
    const res = await handler(
      new NextRequest("http://localhost/api/patient/delete-account", { method: "DELETE" }),
    );

    expect(res.status).toBe(401);
  });

  it("cancels pending deletion successfully", async () => {
    setProfile("patient");

    mockChainable.maybeSingle.mockResolvedValueOnce({
      data: { id: "user-1", deletion_requested_at: "2026-05-01T00:00:00.000Z" },
      error: null,
    });

    const { DELETE: handler } = await import("@/app/api/patient/delete-account/route");
    const res = await handler(
      new NextRequest("http://localhost/api/patient/delete-account", { method: "DELETE" }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.message).toContain("cancelled");
  });

  it("handles case when no pending deletion exists", async () => {
    setProfile("patient");

    mockChainable.maybeSingle.mockResolvedValueOnce({
      data: { id: "user-1", deletion_requested_at: null },
      error: null,
    });

    const { DELETE: handler } = await import("@/app/api/patient/delete-account/route");
    const res = await handler(
      new NextRequest("http://localhost/api/patient/delete-account", { method: "DELETE" }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.message).toContain("No pending deletion");
  });
});

// ── Export Tests ──────────────────────────────────────────────────────

describe("GET /api/patient/export", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("returns 401 when not authenticated", async () => {
    setUnauthenticated();

    const { GET } = await import("@/app/api/patient/export/route");
    const res = await GET(new NextRequest("http://localhost/api/patient/export?format=json"));

    expect(res.status).toBe(401);
  });

  it("returns 403 when non-patient role tries to export", async () => {
    setProfile("clinic_admin");

    const { GET } = await import("@/app/api/patient/export/route");
    const res = await GET(new NextRequest("http://localhost/api/patient/export?format=json"));

    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid format parameter", async () => {
    setProfile("patient");

    // Profile lookup for export
    mockChainable.maybeSingle.mockResolvedValueOnce({
      data: {
        id: "user-1",
        name: "Karim",
        email: "k@test.com",
        phone: "+212600000000",
        role: "patient",
        created_at: "2025-01-01",
      },
      error: null,
    });

    const { GET } = await import("@/app/api/patient/export/route");
    const res = await GET(new NextRequest("http://localhost/api/patient/export?format=xml"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
  });

  it("exports data in JSON format", async () => {
    setProfile("patient");

    // Profile lookup
    mockChainable.maybeSingle.mockResolvedValueOnce({
      data: {
        id: "user-1",
        name: "Karim",
        email: "k@test.com",
        phone: "+212600000000",
        role: "patient",
        created_at: "2025-01-01",
      },
      error: null,
    });

    // Mock Promise.all sub-queries (appointments, prescriptions, payments, documents)
    // The chainable mock returns data for all 4 parallel queries
    mockChainable.limit.mockResolvedValueOnce({
      data: [{ id: "appt-1", slot_start: "2025-06-01", status: "confirmed" }],
    });
    mockChainable.limit.mockResolvedValueOnce({ data: [] });
    mockChainable.limit.mockResolvedValueOnce({
      data: [{ id: "pay-1", amount: 500, method: "card", status: "completed" }],
    });
    mockChainable.limit.mockResolvedValueOnce({ data: [] });

    const { GET } = await import("@/app/api/patient/export/route");
    const res = await GET(new NextRequest("http://localhost/api/patient/export?format=json"));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("content-disposition")).toContain("attachment");

    const body = JSON.parse(await res.text());
    expect(body.personalInfo.name).toBe("Karim");
    expect(body.exportDate).toBeDefined();
  });

  it("exports data in CSV format", async () => {
    setProfile("patient");

    mockChainable.maybeSingle.mockResolvedValueOnce({
      data: {
        id: "user-1",
        name: "Karim",
        email: "k@test.com",
        phone: "+212600000000",
        role: "patient",
        created_at: "2025-01-01",
      },
      error: null,
    });

    mockChainable.limit.mockResolvedValueOnce({
      data: [{ id: "appt-1", slot_start: "2025-06-01", status: "confirmed", notes: null }],
    });
    mockChainable.limit.mockResolvedValueOnce({ data: [] });
    mockChainable.limit.mockResolvedValueOnce({ data: [] });
    mockChainable.limit.mockResolvedValueOnce({ data: [] });

    const { GET } = await import("@/app/api/patient/export/route");
    const res = await GET(new NextRequest("http://localhost/api/patient/export?format=csv"));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");

    const csv = await res.text();
    expect(csv).toContain("type,id,date,status,details,amount");
  });

  it("returns 404 when patient profile not found", async () => {
    setProfile("patient");

    // maybeSingle returns null for the profile lookup
    mockChainable.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const { GET } = await import("@/app/api/patient/export/route");
    const res = await GET(new NextRequest("http://localhost/api/patient/export?format=json"));
    const body = await res.json();

    // The route returns 404 with { ok: false } when profile is not found
    expect(res.status).toBe(404);
    expect(body.ok).toBe(false);
  });

  it("defaults to json format when no format parameter provided", async () => {
    setProfile("patient");

    mockChainable.maybeSingle.mockResolvedValueOnce({
      data: {
        id: "user-1",
        name: "Karim",
        email: "k@test.com",
        phone: "+212600000000",
        role: "patient",
        created_at: "2025-01-01",
      },
      error: null,
    });

    mockChainable.limit.mockResolvedValueOnce({ data: [] });
    mockChainable.limit.mockResolvedValueOnce({ data: [] });
    mockChainable.limit.mockResolvedValueOnce({ data: [] });
    mockChainable.limit.mockResolvedValueOnce({ data: [] });

    const { GET } = await import("@/app/api/patient/export/route");
    const res = await GET(new NextRequest("http://localhost/api/patient/export"));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
  });
});

// ── Restrict Processing Tests ────────────────────────────────────────

describe("POST /api/patient/restrict-processing", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("returns 401 when not authenticated", async () => {
    setUnauthenticated();

    const { POST } = await import("@/app/api/patient/restrict-processing/route");
    const res = await POST(
      new NextRequest("http://localhost/api/patient/restrict-processing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "restriction",
          reason: "I want to restrict processing of my data",
          processingActivities: ["marketing"],
        }),
      }),
    );

    expect(res.status).toBe(401);
  });

  it("returns 403 when non-patient role tries to submit", async () => {
    setProfile("doctor");

    const { POST } = await import("@/app/api/patient/restrict-processing/route");
    const res = await POST(
      new NextRequest("http://localhost/api/patient/restrict-processing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "restriction",
          reason: "I want to restrict processing of my data",
          processingActivities: ["marketing"],
        }),
      }),
    );

    expect(res.status).toBe(403);
  });

  it("returns 422 for invalid body (missing type)", async () => {
    setProfile("patient");

    const { POST } = await import("@/app/api/patient/restrict-processing/route");
    const res = await POST(
      new NextRequest("http://localhost/api/patient/restrict-processing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: "I want to restrict processing of my data",
          processingActivities: ["marketing"],
        }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.ok).toBe(false);
  });

  it("returns 422 when reason is too short", async () => {
    setProfile("patient");

    const { POST } = await import("@/app/api/patient/restrict-processing/route");
    const res = await POST(
      new NextRequest("http://localhost/api/patient/restrict-processing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "restriction",
          reason: "short",
          processingActivities: ["marketing"],
        }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.ok).toBe(false);
  });

  it("returns 422 when processingActivities is empty", async () => {
    setProfile("patient");

    const { POST } = await import("@/app/api/patient/restrict-processing/route");
    const res = await POST(
      new NextRequest("http://localhost/api/patient/restrict-processing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "objection",
          reason: "I object to data processing for marketing",
          processingActivities: [],
        }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.ok).toBe(false);
  });

  it("submits restriction request successfully", async () => {
    setProfile("patient");

    const { POST } = await import("@/app/api/patient/restrict-processing/route");
    const res = await POST(
      new NextRequest("http://localhost/api/patient/restrict-processing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "restriction",
          reason: "I want to restrict processing of my personal data",
          processingActivities: ["marketing", "analytics"],
        }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.type).toBe("restriction");
    expect(body.data.processingActivities).toEqual(["marketing", "analytics"]);
    expect(body.data.submittedAt).toBeDefined();

    // Verify audit log was written
    expect(mockSupabase.from).toHaveBeenCalledWith("activity_logs");
  });

  it("submits objection request successfully", async () => {
    setProfile("patient");

    const { POST } = await import("@/app/api/patient/restrict-processing/route");
    const res = await POST(
      new NextRequest("http://localhost/api/patient/restrict-processing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "objection",
          reason: "I object to processing of my data for third parties",
          processingActivities: ["third_party_sharing"],
        }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.type).toBe("objection");
  });

  it("returns 400 for invalid JSON body", async () => {
    setProfile("patient");

    const { POST } = await import("@/app/api/patient/restrict-processing/route");
    const res = await POST(
      new NextRequest("http://localhost/api/patient/restrict-processing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-valid-json",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
  });
});
