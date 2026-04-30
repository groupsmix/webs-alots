/**
 * F-35: Chaos / failure-mode tests for the rate-limit circuit breaker.
 *
 * Injects simulated backend errors and verifies the limiter holds
 * in fail-closed mode (post F-06 changes).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Supabase to simulate errors
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: { code: "PGRST000", message: "simulated failure" },
          }),
        }),
      }),
      upsert: vi.fn().mockResolvedValue({
        error: { code: "PGRST000", message: "simulated failure" },
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: { code: "PGRST000", message: "simulated failure" },
              }),
            }),
          }),
        }),
      }),
    }),
    rpc: vi.fn().mockResolvedValue({
      data: null,
      error: { code: "42883", message: "function not found" },
    }),
  }),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

describe("Rate Limiter Chaos Tests (F-35)", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
    vi.stubEnv("RATE_LIMIT_BACKEND", "supabase");
  });

  // A87-F03: Restore original env after each test to prevent leakage
  // into subsequent tests running in the same Vitest worker.
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should deny requests when backend errors and failClosed=true", async () => {
    const { createRateLimiter } = await import("@/lib/rate-limit");
    const limiter = createRateLimiter({
      windowMs: 60_000,
      max: 10,
      failClosed: true,
    });

    // With 100% error rate, fail-closed should deny
    const result = await limiter.check("chaos-test-key");
    expect(result).toBe(false);
  });

  it("should allow requests when backend errors and failClosed=false", async () => {
    const { createRateLimiter } = await import("@/lib/rate-limit");
    const limiter = createRateLimiter({
      windowMs: 60_000,
      max: 10,
      failClosed: false,
    });

    // With 100% error rate but fail-open, should allow
    const result = await limiter.check("chaos-test-key-open");
    expect(result).toBe(true);
  });
});
