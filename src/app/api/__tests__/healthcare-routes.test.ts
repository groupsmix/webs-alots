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
