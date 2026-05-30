/**
 * Route handler tests for GET /api/v1/patients.
 *
 * Focus: the PostgREST filter-injection defense (audit MED-05 / A46.3).
 * The `search` query param is interpolated into a PostgREST `.or()` filter
 * string, so it MUST be sanitized with an allowlist (INJ-01: only
 * `[a-zA-Z0-9\s\-'@.]`) to prevent PostgREST filter injection.
 * Dots are kept for email search; commas, pipes, and parens are stripped
 * so attackers cannot inject new filter clauses or OR tokens.
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/v1/patients/route";

// ── Mock setup (hoisted before the handler import) ───────────────────

const result: { data: unknown[]; count: number; error: unknown } = {
  data: [],
  count: 0,
  error: null,
};

// A single thenable query object: every chain method returns `this`, and
// awaiting it resolves to `result` (mirrors the PostgREST builder).
const query: Record<string, unknown> = {};
for (const m of ["select", "eq", "order", "range", "or"]) {
  query[m] = vi.fn(() => query);
}
(query as { then: unknown }).then = (resolve: (v: typeof result) => void) => resolve(result);

const mockSupabase = { from: vi.fn(() => query) };

const authenticateApiKey = vi.fn();
vi.mock("@/lib/api-auth", () => ({
  authenticateApiKey: () => authenticateApiKey(),
}));

vi.mock("@/lib/supabase-server", () => ({
  createTenantClient: vi.fn(async () => mockSupabase),
}));

vi.mock("@/lib/tenant-context", () => ({
  logTenantContext: vi.fn(),
}));

vi.mock("@/lib/cors", () => ({
  getCorsHeaders: vi.fn(() => ({})),
  handlePreflight: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Helpers ──────────────────────────────────────────────────────────

const CLINIC = "11111111-1111-1111-1111-111111111111";

function req(search?: string): NextRequest {
  const url = new URL("http://api.localhost:3000/api/v1/patients");
  if (search !== undefined) url.searchParams.set("search", search);
  return new NextRequest(url, { headers: { authorization: "Bearer test-key" } });
}

function orArg(): string {
  const or = query.or as ReturnType<typeof vi.fn>;
  expect(or).toHaveBeenCalledTimes(1);
  return or.mock.calls[0][0] as string;
}

// ── Tests ────────────────────────────────────────────────────────────

describe("GET /api/v1/patients — search sanitization (MED-05/A46.3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateApiKey.mockResolvedValue({ clinicId: CLINIC });
  });

  it("rejects unauthenticated requests (401) before any DB access", async () => {
    authenticateApiKey.mockResolvedValue(null);
    const res = await GET(req("alice"));
    expect(res.status).toBe(401);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("scopes the query to the authenticated clinic and patient role", async () => {
    await GET(req());
    const eq = query.eq as ReturnType<typeof vi.fn>;
    expect(eq.mock.calls).toContainEqual(["clinic_id", CLINIC]);
    expect(eq.mock.calls).toContainEqual(["role", "patient"]);
  });

  it("strips PostgREST metacharacters from the search term", async () => {
    await GET(req("a%_,.()|b"));
    // Dots are allowed (email search); %, _, commas, parens, pipes are stripped.
    expect(orArg()).toBe(
      "name.ilike.%a.b%,name_ar.ilike.%a.b%,email.ilike.%a.b%,phone.ilike.%a.b%",
    );
  });

  it("neutralizes an injected filter clause (role.eq.super_admin)", async () => {
    await GET(req("x,role.eq.super_admin"));
    const arg = orArg();
    // Commas (clause separators), underscores, and pipes are stripped.
    // Dots remain but are harmless inside ilike values — PostgREST does
    // not re-parse operators inside a value position.
    expect(arg).not.toContain("role.eq.super_admin");
    expect(arg).toBe(
      "name.ilike.%xrole.eq.superadmin%,name_ar.ilike.%xrole.eq.superadmin%,email.ilike.%xrole.eq.superadmin%,phone.ilike.%xrole.eq.superadmin%",
    );
  });

  it("does not build an .or() filter when the term sanitizes to empty", async () => {
    await GET(req("%_,()|"));
    expect(query.or).not.toHaveBeenCalled();
  });

  it("does not build an .or() filter when no search param is supplied", async () => {
    await GET(req());
    expect(query.or).not.toHaveBeenCalled();
  });
});
