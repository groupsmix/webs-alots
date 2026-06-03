/**
 * Regression tests for the production 429 outage (P0).
 *
 * Root cause: under @opennextjs/cloudflare (v1.17+), Worker bindings live on
 * `getCloudflareContext().env`, not on `globalThis`. The KV limiter read the
 * binding off `globalThis`, so KV was always `undefined` in production. Once
 * the circuit-breaker grace period expired, the limiter failed CLOSED for
 * EVERY request — including `failClosed: false` limiters such as
 * `globalPageLimiter` — returning HTTP 429 site-wide.
 *
 * These tests simulate "no KV binding available" (the production condition)
 * and assert the defense-in-depth contract: a `failClosed: false` limiter must
 * NEVER 429 on a backend outage — it degrades to the in-memory limiter and
 * keeps allowing/limiting by real count. Only `failClosed: true` limiters may
 * fail closed once the grace period elapses.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

describe("Rate limiter — KV binding unavailable (prod 429 outage regression)", () => {
  beforeEach(() => {
    vi.resetModules();
    // Select the KV backend (as production does via wrangler.toml) and force a
    // short grace period so the circuit is provably OPEN and grace-expired
    // while we make the assertion — the exact state that took prod down.
    vi.stubEnv("RATE_LIMIT_BACKEND", "kv");
    vi.stubEnv("RATE_LIMIT_KV_GRACE_MS", "1000");
    // Ensure no KV binding is visible anywhere (matches production: bindings
    // are on getCloudflareContext().env, which is uninitialised in tests).
    delete (globalThis as { RATE_LIMIT_KV?: unknown }).RATE_LIMIT_KV;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("globalPageLimiter (failClosed:false) keeps allowing fresh keys after the grace period expires", async () => {
    vi.useFakeTimers();
    const { globalPageLimiter } = await import("@/lib/rate-limit");

    // Trip the circuit breaker — every call finds the KV binding missing.
    for (let i = 0; i < 5; i++) {
      expect(await globalPageLimiter.check(`warmup-${i}`)).toBe(true);
    }

    // Advance past the 1s grace period (circuit still open: reset is 60s).
    vi.advanceTimersByTime(5_000);

    // Regression: previously this returned false (HTTP 429) for EVERYONE.
    expect(await globalPageLimiter.check("fresh-visitor")).toBe(true);
  });

  it("globalPageLimiter still limits by real count when degraded to in-memory", async () => {
    const { globalPageLimiter } = await import("@/lib/rate-limit");

    const key = "noisy-visitor";
    // globalPageLimiter is 120 req / 60s. The in-memory fallback must enforce
    // the real count, not blanket-allow.
    for (let i = 0; i < 120; i++) {
      expect(await globalPageLimiter.check(key)).toBe(true);
    }
    expect(await globalPageLimiter.check(key)).toBe(false);
  });

  it("failClosed:true limiters still fail closed once the grace period expires with no KV", async () => {
    vi.useFakeTimers();
    const { createRateLimiter } = await import("@/lib/rate-limit");
    const limiter = createRateLimiter({ windowMs: 60_000, max: 5, failClosed: true });

    for (let i = 0; i < 5; i++) {
      await limiter.check(`warm-${i}`);
    }
    vi.advanceTimersByTime(5_000);

    // Security-critical endpoints remain protected: deny after grace expiry.
    expect(await limiter.check("attacker")).toBe(false);
  });
});
