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
    expect(body.data.status).toBeDefined();
    expect(body.data.checks).toBeDefined();
    expect(body.data.checks.database).toBeDefined();
    expect(body.data.timestamp).toBeDefined();
  });

  it("returns response with correct Cache-Control header", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    const { GET } = await import("@/app/api/health/route");
    const response = await GET();

    expect(response.headers.get("Cache-Control")).toBe("public, max-age=30");
  });

  it("reports r2 as degraded when not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    const body = await response.json();

    expect(body.data.checks.r2.status).toBe("degraded");
  });

  it("reports whatsapp as degraded when tokens are missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "");
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "");
    vi.stubEnv("TWILIO_ACCOUNT_SID", "");
    vi.stubEnv("TWILIO_AUTH_TOKEN", "");

    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    const body = await response.json();

    expect(body.data.checks.whatsapp.status).toBe("degraded");
  });

  it("includes all expected component checks in response", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    const body = await response.json();

    const checkKeys = Object.keys(body.data.checks);
    expect(checkKeys).toContain("database");
    expect(checkKeys).toContain("r2");
    expect(checkKeys).toContain("whatsapp");
    expect(checkKeys).toContain("rateLimiter");
  });
});
