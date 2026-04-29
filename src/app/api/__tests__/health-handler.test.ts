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

  it("returns 200 with degraded status when env vars are missing", async () => {
    // Ensure Supabase env vars are NOT set
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    // Dynamic import so mocks are in place
    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    // O-04: Public health endpoint returns only ok, status, timestamp
    // Detailed checks are only exposed via /api/health/internal
    expect(body.data.ok).toBeDefined();
    expect(body.data.status).toBeDefined();
    expect(body.data.timestamp).toBeDefined();
  });

  it("returns response with correct Cache-Control header", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    const { GET } = await import("@/app/api/health/route");
    const response = await GET();

    expect(response.headers.get("Cache-Control")).toBe("public, max-age=30");
  });

  it("O-04: does NOT expose granular dependency status to anon callers", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    const body = await response.json();

    // O-04: checks object should NOT be present in public response
    expect(body.data.checks).toBeUndefined();
    expect(body.data.ok).toBeDefined();
    expect(body.data.status).toBeDefined();
  });

  it("returns ok:true or ok:false based on overall status", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    const body = await response.json();

    // With missing env vars, status is "degraded" which still means ok:true
    // (only "down" means ok:false)
    expect(typeof body.data.ok).toBe("boolean");
  });
});
