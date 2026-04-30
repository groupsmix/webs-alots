/**
 * Route handler tests for GET /api/health.
 *
 * Audit L9-03: These tests invoke the actual route handler function,
 * not just validate schemas. They verify HTTP status codes, response
 * shape, and component health reporting.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/r2", () => ({
  isR2Configured: vi.fn(() => false),
}));

const mockFrom = vi.fn();
const mockSupabaseClient = {
  from: mockFrom.mockReturnValue({
    select: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({ data: [{ id: "c1" }], error: null }),
    }),
  }),
};

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

describe("GET /api/health — route handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("returns 200 with ok:true when degraded but not down", async () => {
    // Ensure Supabase env vars are NOT set — this puts the database
    // check in a "degraded" state, but the overall endpoint still
    // returns 200 because nothing is fully down.
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    // Dynamic import so mocks are in place
    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.ok).toBe(true);
  });

  it("returns response with correct Cache-Control header", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    const { GET } = await import("@/app/api/health/route");
    const response = await GET();

    expect(response.headers.get("Cache-Control")).toBe("public, max-age=30");
  });

  it("O-04: anon response is exactly { ok: boolean } with no extra fields", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    const body = await response.json();

    // O-04: data payload must be exactly { ok: boolean } — no granular
    // dependency status, no overall status string, and no timestamp.
    expect(typeof body.data.ok).toBe("boolean");
    expect(Object.keys(body.data)).toEqual(["ok"]);
    expect(body.data.checks).toBeUndefined();
    expect(body.data.status).toBeUndefined();
    expect(body.data.timestamp).toBeUndefined();
  });
});
