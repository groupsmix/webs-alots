/**
 * Route handler tests for GET /api/v1/patients.
 *
 * Focus: the PostgREST filter-injection defense (audit MED-05 / A46.3).
 * The `search` query param is interpolated into a PostgREST `.or()` filter
 * string, so it MUST be sanitized — stripping `% _ , . ( ) |` — to stop a
 * caller from smuggling extra filter clauses (e.g. `role.eq.super_admin`)
 * or OR tokens. These tests invoke the real handler and assert the exact
 * filter string handed to Supabase, plus the auth gate and tenant scoping.
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
    // Only the sanitized term "ab" should appear inside the ilike patterns.
    expect(orArg()).toBe("name.ilike.%ab%,name_ar.ilike.%ab%,email.ilike.%ab%,phone.ilike.%ab%");
  });

  it("neutralizes an injected filter clause (role.eq.super_admin)", async () => {
    await GET(req("x,role.eq.super_admin"));
    const arg = orArg();
    // The dots/commas that would terminate the value and start a new clause
    // are gone, so no extra filter can be smuggled in.
    expect(arg).not.toContain("role.eq.super_admin");
    expect(arg).not.toContain(".eq.");
    expect(arg).toBe(
      "name.ilike.%xroleeqsuperadmin%,name_ar.ilike.%xroleeqsuperadmin%,email.ilike.%xroleeqsuperadmin%,phone.ilike.%xroleeqsuperadmin%",
    );
  });

  it("does not build an .or() filter when the term sanitizes to empty", async () => {
    await GET(req("%_,.()|"));
    expect(query.or).not.toHaveBeenCalled();
  });

  it("does not build an .or() filter when no search param is supplied", async () => {
    await GET(req());
    expect(query.or).not.toHaveBeenCalled();
  });
});
