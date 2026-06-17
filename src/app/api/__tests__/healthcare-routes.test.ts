/**
 * Integration tests for healthcare API routes:
 * Admissions, Staff Invitations, Insurance Claims.
 *
 * Tests the actual route handlers with mocked Supabase client.
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock setup ───────────────────────────────────────────────────────

function createChainable(terminalResult?: unknown) {
  const defaultResult = terminalResult ?? { data: [], error: null, count: 0 };
  const c: Record<string, ReturnType<typeof vi.fn>> = {};
  const self = () => c;
  c.select = vi.fn(self);
  c.insert = vi.fn(self);
  c.update = vi.fn(self);
  c.eq = vi.fn(self);
  c.not = vi.fn(self);
  c.in = vi.fn(self);
  c.limit = vi.fn(self);
  c.order = vi.fn(self);
  // range returns a chainable + thenable (like the real Supabase PostgREST builder)
  c.range = vi.fn(() => {
    const thenableChain = {
      ...c,
      then: (resolve: (v: unknown) => void) => Promise.resolve(defaultResult).then(resolve),
    };
    return thenableChain;
  });
  c.single = vi.fn().mockResolvedValue(terminalResult ?? { data: null, error: null });
  c.maybeSingle = vi.fn().mockResolvedValue(terminalResult ?? { data: null, error: null });
  // Make the chain itself thenable for `await query` patterns
  Object.defineProperty(c, "then", {
    value: (resolve: (v: unknown) => void) => Promise.resolve(defaultResult).then(resolve),
    enumerable: false,
  });
  return c;
}

let profileChain: ReturnType<typeof createChainable>;
let queryChain: ReturnType<typeof createChainable>;
let fromCallCount = 0;

const mockSupabase = {
  from: vi.fn(() => {
    fromCallCount++;
    // First from() call is the profile lookup from withAuth
    if (fromCallCount === 1) return profileChain;
    return queryChain;
  }),
  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: "auth-user-1", email: "test@clinique.ma" } },
      error: null,
    }),
  },
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
};

vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(async () => mockSupabase),
  createTenantClient: vi.fn(async () => mockSupabase),
  createAdminClient: vi.fn(() => mockSupabase),
}));

vi.mock("@/lib/tenant", () => ({
  requireTenant: vi.fn(async () => ({
    clinicId: "clinic-1",
    clinicName: "Clinique Test",
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

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(async () => ({ ok: true })),
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
          "x-tenant-clinic-name": "Clinique Test",
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
  profileChain = createChainable();
  profileChain.single.mockResolvedValue({
    data: { id: "user-1", role, clinic_id: clinicId },
    error: null,
  });
}

function setQueryResult(result: unknown) {
  queryChain = createChainable(result);
}

function buildGet(url: string): NextRequest {
  return new NextRequest(url, { method: "GET" });
}

function buildPost(url: string, body: Record<string, unknown>): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function buildPatch(url: string, body: Record<string, unknown>): NextRequest {
  return new NextRequest(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const UUID1 = "550e8400-e29b-41d4-a716-446655440000";
const UUID2 = "550e8400-e29b-41d4-a716-446655440001";
// ── Staff Invitations Tests ──────────────────────────────────────────

describe("GET /api/staff-invitations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromCallCount = 0;
  });

  it("returns invitation list for admin", async () => {
    setProfile("clinic_admin");
    setQueryResult({
      data: [{ id: "inv-1", email: "dr@clinique.ma", status: "pending" }],
      error: null,
      count: 1,
    });

    const { GET } = await import("@/app/api/staff-invitations/route");
    const res = await GET(buildGet("http://localhost/api/staff-invitations"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("rejects non-admin roles", async () => {
    setProfile("doctor");
    setQueryResult({ data: [], error: null, count: 0 });

    const { GET } = await import("@/app/api/staff-invitations/route");
    const res = await GET(buildGet("http://localhost/api/staff-invitations"));
    expect(res.status).toBe(403);
  });

  it("applies status filter", async () => {
    setProfile("super_admin");
    setQueryResult({ data: [], error: null, count: 0 });

    const { GET } = await import("@/app/api/staff-invitations/route");
    const res = await GET(buildGet("http://localhost/api/staff-invitations?status=pending"));
    expect(res.status).toBe(200);
  });
});

describe("POST /api/staff-invitations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromCallCount = 0;
  });

  it("creates an invitation", async () => {
    setProfile("clinic_admin");
    queryChain = createChainable();
    // existing invitation check returns nothing (no pending invitation)
    queryChain.maybeSingle.mockResolvedValue({ data: null, error: null });
    // insert returns new invitation
    queryChain.single.mockResolvedValue({
      data: { id: "inv-1", email: "newdr@clinique.ma", status: "pending" },
      error: null,
    });

    const { POST } = await import("@/app/api/staff-invitations/route");
    const res = await POST(
      buildPost("http://localhost/api/staff-invitations", {
        email: "newdr@clinique.ma",
        role: "doctor",
      }),
    );
    expect(res.status).toBe(201);
  });

  it("rejects invalid email", async () => {
    setProfile("clinic_admin");
    setQueryResult({ data: null, error: null });

    const { POST } = await import("@/app/api/staff-invitations/route");
    const res = await POST(
      buildPost("http://localhost/api/staff-invitations", {
        email: "bad-email",
        role: "doctor",
      }),
    );
    expect(res.status).toBe(422);
  });

  it("rejects non-admin attempting to invite", async () => {
    setProfile("receptionist");
    setQueryResult({ data: null, error: null });

    const { POST } = await import("@/app/api/staff-invitations/route");
    const res = await POST(
      buildPost("http://localhost/api/staff-invitations", {
        email: "dr@clinique.ma",
        role: "doctor",
      }),
    );
    expect(res.status).toBe(403);
  });
});

// ── Insurance Claims Tests ───────────────────────────────────────────

describe("GET /api/insurance-claims", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromCallCount = 0;
  });

  it("returns claims list for staff", async () => {
    setProfile("receptionist");
    setQueryResult({
      data: [{ id: "c1", claim_number: "CLM-001", insurance_type: "CNSS" }],
      error: null,
      count: 1,
    });

    const { GET } = await import("@/app/api/insurance-claims/route");
    const res = await GET(buildGet("http://localhost/api/insurance-claims"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("rejects patient role", async () => {
    setProfile("patient");
    setQueryResult({ data: [], error: null, count: 0 });

    const { GET } = await import("@/app/api/insurance-claims/route");
    const res = await GET(buildGet("http://localhost/api/insurance-claims"));
    expect(res.status).toBe(403);
  });

  it("applies filters", async () => {
    setProfile("clinic_admin");
    setQueryResult({ data: [], error: null, count: 0 });

    const { GET } = await import("@/app/api/insurance-claims/route");
    const res = await GET(
      buildGet(
        `http://localhost/api/insurance-claims?status=approved&insurance_type=CNOPS&patient_id=${UUID1}`,
      ),
    );
    expect(res.status).toBe(200);
  });
});

describe("POST /api/insurance-claims", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromCallCount = 0;
  });

  it("creates a claim", async () => {
    setProfile("receptionist");
    setQueryResult({
      data: { id: "c-new", claim_number: "CLM-002", status: "draft" },
      error: null,
    });

    const { POST } = await import("@/app/api/insurance-claims/route");
    const res = await POST(
      buildPost("http://localhost/api/insurance-claims", {
        patient_id: UUID1,
        insurance_type: "CNSS",
        amount_claimed: 150000,
        line_items: [{ description: "Consultation", unit_price_centimes: 150000, quantity: 1 }],
      }),
    );
    expect(res.status).toBe(201);
  });

  it("rejects invalid insurance type", async () => {
    setProfile("receptionist");
    setQueryResult({ data: null, error: null });

    const { POST } = await import("@/app/api/insurance-claims/route");
    const res = await POST(
      buildPost("http://localhost/api/insurance-claims", {
        patient_id: UUID1,
        insurance_type: "INVALID",
        amount_claimed: 100000,
        line_items: [{ description: "A", unit_price_centimes: 100000, quantity: 1 }],
      }),
    );
    expect(res.status).toBe(422);
  });

  it("handles insert error", async () => {
    setProfile("receptionist");
    setQueryResult({ data: null, error: { message: "insert failed" } });

    const { POST } = await import("@/app/api/insurance-claims/route");
    const res = await POST(
      buildPost("http://localhost/api/insurance-claims", {
        patient_id: UUID1,
        insurance_type: "AMO",
        amount_claimed: 200000,
        line_items: [{ description: "Chirurgie", unit_price_centimes: 200000, quantity: 1 }],
      }),
    );
    expect(res.status).toBe(500);
  });
});

// ── Admissions Tests ─────────────────────────────────────────────────

describe("POST /api/admissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromCallCount = 0;
  });

  it("creates an admission", async () => {
    setProfile("receptionist");
    setQueryResult({
      data: { id: "adm-1", status: "admitted", bed_id: UUID1 },
      error: null,
    });

    const { POST } = await import("@/app/api/admissions/route");
    const res = await POST(
      buildPost("http://localhost/api/admissions", {
        patient_id: UUID1,
        bed_id: UUID2,
        diagnosis: "Fracture",
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("rejects patient role", async () => {
    setProfile("patient");
    setQueryResult({ data: null, error: null });

    const { POST } = await import("@/app/api/admissions/route");
    const res = await POST(
      buildPost("http://localhost/api/admissions", {
        patient_id: UUID1,
        bed_id: UUID2,
      }),
    );
    expect(res.status).toBe(403);
  });

  it("rejects invalid body", async () => {
    setProfile("doctor");
    setQueryResult({ data: null, error: null });

    const { POST } = await import("@/app/api/admissions/route");
    const res = await POST(buildPost("http://localhost/api/admissions", { patient_id: UUID1 }));
    expect(res.status).toBe(422);
  });

  it("handles insert error", async () => {
    setProfile("doctor");
    setQueryResult({ data: null, error: { message: "FK violation" } });

    const { POST } = await import("@/app/api/admissions/route");
    const res = await POST(
      buildPost("http://localhost/api/admissions", {
        patient_id: UUID1,
        bed_id: UUID2,
      }),
    );
    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/admissions/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromCallCount = 0;
  });

  it("discharges an admission", async () => {
    setProfile("doctor");
    setQueryResult({ data: { id: "adm-1", status: "discharged" }, error: null });

    const { PATCH } = await import("@/app/api/admissions/[id]/route");
    const res = await PATCH(
      buildPatch("http://localhost/api/admissions/adm-1", {
        action: "discharge",
        notes: "Sortie normale",
      }),
    );
    expect(res.status).toBe(200);
  });

  it("transfers an admission", async () => {
    setProfile("doctor");
    setQueryResult({ data: { id: "adm-1", status: "transferred" }, error: null });

    const { PATCH } = await import("@/app/api/admissions/[id]/route");
    const res = await PATCH(
      buildPatch("http://localhost/api/admissions/adm-1", {
        action: "transfer",
        department_id: UUID1,
        bed_id: UUID2,
      }),
    );
    expect(res.status).toBe(200);
  });

  it("rejects unknown action", async () => {
    setProfile("doctor");
    setQueryResult({ data: null, error: null });

    const { PATCH } = await import("@/app/api/admissions/[id]/route");
    const res = await PATCH(
      buildPatch("http://localhost/api/admissions/adm-1", { action: "unknown" }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects missing action", async () => {
    setProfile("doctor");
    setQueryResult({ data: null, error: null });

    const { PATCH } = await import("@/app/api/admissions/[id]/route");
    const res = await PATCH(buildPatch("http://localhost/api/admissions/adm-1", {}));
    expect(res.status).toBe(400);
  });

  it("handles discharge error", async () => {
    setProfile("doctor");
    setQueryResult({ data: null, error: { message: "update failed" } });

    const { PATCH } = await import("@/app/api/admissions/[id]/route");
    const res = await PATCH(
      buildPatch("http://localhost/api/admissions/adm-1", {
        action: "discharge",
      }),
    );
    expect(res.status).toBe(500);
  });
});
// ── Insurance Claims [id] Tests ──────────────────────────────────────

describe("GET /api/insurance-claims/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromCallCount = 0;
  });

  it("returns claim detail", async () => {
    setProfile("clinic_admin");
    setQueryResult({
      data: { id: "c1", claim_number: "CLM-001", insurance_type: "CNSS", status: "submitted" },
      error: null,
    });

    const { GET } = await import("@/app/api/insurance-claims/[id]/route");
    const res = await GET(buildGet("http://localhost/api/insurance-claims/c1"));
    expect(res.status).toBe(200);
  });

  it("returns 404 when not found", async () => {
    setProfile("clinic_admin");
    setQueryResult({ data: null, error: { code: "PGRST116" } });

    const { GET } = await import("@/app/api/insurance-claims/[id]/route");
    const res = await GET(buildGet("http://localhost/api/insurance-claims/missing"));
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/insurance-claims/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromCallCount = 0;
  });

  it("approves a claim", async () => {
    setProfile("clinic_admin");
    setQueryResult({
      data: { id: "c1", status: "approved", amount_approved: 120000 },
      error: null,
    });

    const { PATCH } = await import("@/app/api/insurance-claims/[id]/route");
    const res = await PATCH(
      buildPatch("http://localhost/api/insurance-claims/c1", {
        status: "approved",
        amount_approved: 120000,
      }),
    );
    expect(res.status).toBe(200);
  });

  it("rejects a claim with reason", async () => {
    setProfile("clinic_admin");
    setQueryResult({
      data: { id: "c1", status: "rejected" },
      error: null,
    });

    const { PATCH } = await import("@/app/api/insurance-claims/[id]/route");
    const res = await PATCH(
      buildPatch("http://localhost/api/insurance-claims/c1", {
        status: "rejected",
        rejection_reason: "Documents incomplets",
      }),
    );
    expect(res.status).toBe(200);
  });

  it("submits a claim", async () => {
    setProfile("receptionist");
    setQueryResult({
      data: { id: "c1", status: "submitted" },
      error: null,
    });

    const { PATCH } = await import("@/app/api/insurance-claims/[id]/route");
    const res = await PATCH(
      buildPatch("http://localhost/api/insurance-claims/c1", {
        status: "submitted",
      }),
    );
    expect(res.status).toBe(200);
  });

  it("partially approves a claim", async () => {
    setProfile("clinic_admin");
    setQueryResult({
      data: { id: "c1", status: "partially_approved" },
      error: null,
    });

    const { PATCH } = await import("@/app/api/insurance-claims/[id]/route");
    const res = await PATCH(
      buildPatch("http://localhost/api/insurance-claims/c1", {
        status: "partially_approved",
        amount_approved: 80000,
        reviewer_notes: "Partiellement approuvé",
      }),
    );
    expect(res.status).toBe(200);
  });

  it("handles update error", async () => {
    setProfile("clinic_admin");
    setQueryResult({ data: null, error: { message: "update failed" } });

    const { PATCH } = await import("@/app/api/insurance-claims/[id]/route");
    const res = await PATCH(
      buildPatch("http://localhost/api/insurance-claims/c1", {
        status: "submitted",
      }),
    );
    expect(res.status).toBe(500);
  });
});
