/**
 * Tests that the login rate limiter honours the LOGIN_RATE_LIMIT_MAX /
 * LOGIN_RATE_LIMIT_WINDOW_MS environment overrides while keeping the secure
 * 5-req / 60s default when they are absent or malformed.
 *
 * The limiter is a module-level singleton constructed at import time, so each
 * case resets modules and re-imports after stubbing the environment.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function freshLoginLimiter() {
  vi.resetModules();
  const mod = await import("@/lib/rate-limit");
  return mod.loginLimiter;
}

describe("loginLimiter configuration", () => {
  it("defaults to 5 requests per window when no override is set", async () => {
    const limiter = await freshLoginLimiter();
    for (let i = 0; i < 5; i++) {
      expect(await limiter.check("default-key")).toBe(true);
    }
    expect(await limiter.check("default-key")).toBe(false);
  });

  it("respects LOGIN_RATE_LIMIT_MAX override", async () => {
    vi.stubEnv("LOGIN_RATE_LIMIT_MAX", "2");
    const limiter = await freshLoginLimiter();
    expect(await limiter.check("override-key")).toBe(true);
    expect(await limiter.check("override-key")).toBe(true);
    expect(await limiter.check("override-key")).toBe(false);
  });

  it("ignores a malformed override and keeps the secure default", async () => {
    vi.stubEnv("LOGIN_RATE_LIMIT_MAX", "not-a-number");
    const limiter = await freshLoginLimiter();
    for (let i = 0; i < 5; i++) {
      expect(await limiter.check("malformed-key")).toBe(true);
    }
    expect(await limiter.check("malformed-key")).toBe(false);
  });

  it("ignores a non-positive override and keeps the secure default", async () => {
    vi.stubEnv("LOGIN_RATE_LIMIT_MAX", "0");
    const limiter = await freshLoginLimiter();
    for (let i = 0; i < 5; i++) {
      expect(await limiter.check("zero-key")).toBe(true);
    }
    expect(await limiter.check("zero-key")).toBe(false);
  });
});
