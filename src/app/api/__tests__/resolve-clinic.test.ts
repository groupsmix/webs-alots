import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Route-handler tests for POST /api/auth/resolve-clinic — the root-domain
 * login funnel resolver. Exercises the full request → rate-limit → validation
 * → service-role lookup → response chain, focusing on the security branches
 * (enumeration-safe empty result, inactive clinics, multi-clinic, rate limit).
 */

const limiterCheck = vi.fn<(key: string) => Promise<boolean>>(() => Promise.resolve(true));
const adminClient = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
  loginLimiter: { check: (key: string) => limiterCheck(key) },
  extractClientIp: () => "127.0.0.1",
}));

vi.mock("@/lib/supabase-server", () => ({
  createAdminClient: () => adminClient(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

/**
 * Minimal thenable Supabase query builder. Each `.from(table)` resolves to the
 * preconfigured `{ data, error }` for that table regardless of filter chain.
 */
function makeClient(tables: Record<string, { data: unknown; error?: unknown }>) {
  return {
    from(table: string) {
      const result = tables[table] ?? { data: [], error: null };
      const builder: Record<string, unknown> = {};
      const chain = () => builder;
      for (const m of ["select", "eq", "ilike", "in", "is", "not"]) {
        builder[m] = vi.fn(chain);
      }
      (builder as { then: unknown }).then = (resolve: (v: unknown) => unknown) =>
        resolve({ data: result.data, error: result.error ?? null });
      return builder;
    },
  };
}

function post(body: unknown) {
  return new Request("http://oltigo.com/api/auth/resolve-clinic", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

async function callRoute(body: unknown) {
  const { POST } = await import("../auth/resolve-clinic/route");
  return POST(post(body));
}

describe("POST /api/auth/resolve-clinic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limiterCheck.mockResolvedValue(true);
  });

  it("returns a single clinic for a known email", async () => {
    adminClient.mockReturnValue(
      makeClient({
        users: { data: [{ clinic_id: "c1" }] },
        clinics: { data: [{ subdomain: "alpha", name: "Clinique Alpha" }] },
      }),
    );
    const res = await callRoute({ email: "staff@alpha.ma" });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.clinics).toEqual([{ subdomain: "alpha", name: "Clinique Alpha" }]);
  });

  it("returns an empty list for an unknown email (no enumeration)", async () => {
    adminClient.mockReturnValue(makeClient({ users: { data: [] } }));
    const res = await callRoute({ email: "nobody@example.com" });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.clinics).toEqual([]);
  });

  it("returns multiple clinics sorted by name for a multi-clinic user", async () => {
    adminClient.mockReturnValue(
      makeClient({
        users: { data: [{ clinic_id: "c1" }, { clinic_id: "c2" }] },
        clinics: {
          data: [
            { subdomain: "beta", name: "Clinique Beta" },
            { subdomain: "alpha", name: "Clinique Alpha" },
          ],
        },
      }),
    );
    const res = await callRoute({ email: "doc@multi.ma" });
    const json = await res.json();
    expect(json.data.clinics.map((c: { name: string }) => c.name)).toEqual([
      "Clinique Alpha",
      "Clinique Beta",
    ]);
  });

  it("drops clinic rows without a subdomain", async () => {
    adminClient.mockReturnValue(
      makeClient({
        users: { data: [{ clinic_id: "c1" }] },
        clinics: { data: [{ subdomain: null, name: "No Subdomain" }] },
      }),
    );
    const res = await callRoute({ email: "x@y.ma" });
    const json = await res.json();
    expect(json.data.clinics).toEqual([]);
  });

  it("rejects an invalid email as a validation error", async () => {
    const res = await callRoute({ email: "not-an-email" });
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.ok).toBe(false);
  });

  it("returns 429 when rate-limited", async () => {
    limiterCheck.mockResolvedValue(false);
    const res = await callRoute({ email: "staff@alpha.ma" });
    expect(res.status).toBe(429);
  });

  it("returns 500 when the user lookup errors", async () => {
    adminClient.mockReturnValue(makeClient({ users: { data: null, error: { message: "boom" } } }));
    const res = await callRoute({ email: "staff@alpha.ma" });
    expect(res.status).toBe(500);
  });
});
