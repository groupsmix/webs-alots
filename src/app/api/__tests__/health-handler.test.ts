/**
 * Route handler tests for GET /api/health.
 *
 * Audit L9-03: These tests invoke the actual route handler function,
 * not just validate schemas. They verify HTTP status codes, response
 * shape, and component health reporting.
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/r2", () => ({
  isR2Configured: vi.fn(() => false),
}));

vi.mock("@/lib/cron-auth", () => ({
  verifyCronSecret: vi.fn(() => null),
}));

vi.mock("@/lib/ai/config", () => ({
  getAIAvailabilityStatus: vi.fn(async () => ({
    enabled: true,
    circuit: {
      state: "closed",
      backend: "memory",
      consecutiveFailures: 0,
      failureThreshold: 5,
      failureWindowMs: 60_000,
      cooldownMs: 300_000,
      openUntil: null,
      lastOpenedAt: null,
      lastFailureAt: null,
      lastFailureReason: null,
    },
  })),
}));

const mockLimit = vi.fn().mockResolvedValue({ data: [{ id: "c1" }], error: null });
const mockSelect = vi.fn(() => ({ limit: mockLimit }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));
const mockRpc = vi.fn();
const mockGetSession = vi.fn().mockResolvedValue({ error: null });
const mockSupabaseClient = {
  from: mockFrom,
  rpc: mockRpc,
  auth: {
    getSession: mockGetSession,
  },
};

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

vi.mock("@/lib/connection-pooling", () => ({
  verifyPoolerEndpoint: vi.fn(() => ({
    isPooled: true,
    url: "postgresql://postgres.xxx@aws-0-eu-west-1.pooler.supabase.com:6543/postgres",
    recommendation: null,
  })),
  verifyDirectDbPooler: vi.fn(() => ({
    isPooled: true,
    recommendation: null,
  })),
}));

describe("GET /api/health — route handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    mockLimit.mockResolvedValue({ data: [{ id: "c1" }], error: null });
    mockRpc.mockResolvedValue({ data: null, error: null });
    mockGetSession.mockResolvedValue({ error: null });
  });

  it("returns 200 with structured health data when degraded but not down", async () => {
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
    expect(body.data.status).toBe("degraded");
    expect(body.data.checks).toBeDefined();
    expect(body.data.timestamp).toBeDefined();
  });

  it("returns response with correct Cache-Control header", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    const { GET } = await import("@/app/api/health/route");
    const response = await GET();

    expect(response.headers.get("Cache-Control")).toBe("public, max-age=30");
  });

  it("returns structured health response with checks, status, and timestamp", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    const body = await response.json();

    expect(body.data.status).toMatch(/^(healthy|degraded|unhealthy)$/);
    expect(body.data.checks).toBeDefined();
    expect(body.data.checks.supabase).toBeDefined();
    expect(body.data.checks.r2).toBeDefined();
    expect(body.data.checks.rateLimiter).toBeDefined();
    expect(body.data.checks.ai).toBeDefined();
    expect(body.data.timestamp).toBeDefined();
  });

  it("reports AI health as degraded when the circuit breaker is open", async () => {
    const { getAIAvailabilityStatus } = await import("@/lib/ai/config");
    vi.mocked(getAIAvailabilityStatus).mockResolvedValueOnce({
      enabled: true,
      circuit: {
        state: "open",
        backend: "kv",
        consecutiveFailures: 5,
        failureThreshold: 5,
        failureWindowMs: 60_000,
        cooldownMs: 300_000,
        openUntil: new Date(Date.now() + 60_000).toISOString(),
        lastOpenedAt: new Date().toISOString(),
        lastFailureAt: new Date().toISOString(),
        lastFailureReason: "http_503",
      },
    });

    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    const body = await response.json();

    expect(body.data.checks.ai).toMatchObject({
      status: "degraded",
      backend: "kv",
      detail: "open",
      error: "http_503",
    });
  });

  it("internal health reports pooler recommendation when public URL fallback is in use", async () => {
    const { verifyPoolerEndpoint } = await import("@/lib/connection-pooling");
    vi.mocked(verifyPoolerEndpoint).mockReturnValueOnce({
      isPooled: true,
      url: "https://project.supabase.co",
      recommendation:
        "SUPABASE_POOLER_URL is not set; server code will fall back to the public Supabase URL",
    });

    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role");

    const { GET } = await import("@/app/api/health/internal/route");
    const request = new NextRequest("https://oltigo.com/api/health/internal", {
      headers: { authorization: "Bearer test" },
    });
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.checks.connectionPooling).toMatchObject({
      status: "ok",
      error:
        "SUPABASE_POOLER_URL is not set; server code will fall back to the public Supabase URL",
    });
  });

  it("internal health exposes postgres version, pool metrics, and age checks", async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        postgres_version: "15.8",
        postgres_version_major: 15,
        max_connections: 100,
        current_connections: 55,
        active_connections: 12,
        idle_connections: 40,
        waiting_connections: 3,
        pool_utilization_pct: 55,
      },
      error: null,
    });

    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role");
    vi.stubEnv("LAST_RESTORE_TEST_AT", new Date(Date.now() - 10 * 86_400_000).toISOString());
    vi.stubEnv("CRON_SECRET_ROTATED_AT", new Date(Date.now() - 5 * 86_400_000).toISOString());
    vi.stubEnv(
      "PROFILE_HEADER_HMAC_KEY_ROTATED_AT",
      new Date(Date.now() - 5 * 86_400_000).toISOString(),
    );
    vi.stubEnv(
      "PHI_ENCRYPTION_KEY_ROTATED_AT",
      new Date(Date.now() - 5 * 86_400_000).toISOString(),
    );

    const { GET } = await import("@/app/api/health/internal/route");
    const request = new NextRequest("https://oltigo.com/api/health/internal", {
      headers: { authorization: "Bearer test" },
    });
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.checks.postgres).toMatchObject({
      status: "ok",
      version: "15.8",
      major: 15,
    });
    expect(body.data.checks.connectionPooling).toMatchObject({
      status: "ok",
      maxConnections: 100,
      currentConnections: 55,
      activeConnections: 12,
      idleConnections: 40,
      waitingConnections: 3,
      utilizationPct: 55,
    });
    expect(body.data.checks.restoreDrill.status).toBe("ok");
    expect(body.data.checks.secretRotation.status).toBe("ok");
  });
});
