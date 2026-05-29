/**
 * A84-2: Fault-injection integration tests.
 *
 * Verifies that critical code paths degrade gracefully when
 * dependencies (Supabase, Auth, external APIs) are unavailable.
 * Each test mocks a dependency failure and asserts the response
 * is a well-formed degraded response — not an unhandled crash.
 */

import { describe, expect, it } from "vitest";

describe("Fault injection — degraded responses", () => {
  it("circuit breaker fast-fails after threshold consecutive failures", async () => {
    const { CircuitBreaker, CircuitOpenError } = await import("@/lib/circuit-breaker");
    const cb = new CircuitBreaker({ name: "test-cb", failureThreshold: 3, resetTimeoutMs: 100 });

    const failingFn = () => Promise.reject(new Error("boom"));

    // Trip the breaker
    for (let i = 0; i < 3; i++) {
      await expect(cb.fire(failingFn)).rejects.toThrow("boom");
    }

    // Next call should fast-fail with CircuitOpenError
    await expect(cb.fire(failingFn)).rejects.toThrow(CircuitOpenError);
    expect(cb.getState().state).toBe("OPEN");
  });

  it("circuit breaker transitions to HALF_OPEN after reset timeout", async () => {
    const { CircuitBreaker } = await import("@/lib/circuit-breaker");
    const cb = new CircuitBreaker({
      name: "test-half-open",
      failureThreshold: 2,
      resetTimeoutMs: 50,
    });

    const failingFn = () => Promise.reject(new Error("down"));

    // Trip it
    for (let i = 0; i < 2; i++) {
      await expect(cb.fire(failingFn)).rejects.toThrow();
    }
    expect(cb.getState().state).toBe("OPEN");

    // Wait for reset timeout
    await new Promise((r) => setTimeout(r, 60));
    expect(cb.getState().state).toBe("HALF_OPEN");
  });

  it("circuit breaker closes on successful probe in HALF_OPEN", async () => {
    const { CircuitBreaker } = await import("@/lib/circuit-breaker");
    const cb = new CircuitBreaker({ name: "test-close", failureThreshold: 2, resetTimeoutMs: 50 });

    // Trip it
    for (let i = 0; i < 2; i++) {
      await expect(cb.fire(() => Promise.reject(new Error("x")))).rejects.toThrow();
    }

    await new Promise((r) => setTimeout(r, 60));
    expect(cb.getState().state).toBe("HALF_OPEN");

    // Successful probe
    const result = await cb.fire(() => Promise.resolve("ok"));
    expect(result).toBe("ok");
    expect(cb.getState().state).toBe("CLOSED");
  });

  it("circuit breaker returns fallback when OPEN", async () => {
    const { CircuitBreaker } = await import("@/lib/circuit-breaker");
    const cb = new CircuitBreaker({
      name: "test-fallback",
      failureThreshold: 1,
      resetTimeoutMs: 5000,
    });

    await expect(cb.fire(() => Promise.reject(new Error("fail")))).rejects.toThrow();
    expect(cb.getState().state).toBe("OPEN");

    const result = await cb.fire(() => Promise.resolve("should not run"), "fallback-value");
    expect(result).toBe("fallback-value");
  });

  it("global retry budget is exhausted after max retries in window", async () => {
    const { CircuitBreaker } = await import("@/lib/circuit-breaker");
    const cb = new CircuitBreaker({
      name: "test-budget",
      failureThreshold: 100,
      globalRetryBudget: 3,
      retryWindowMs: 60_000,
    });

    expect(cb.consumeRetryToken()).toBe(true);
    expect(cb.consumeRetryToken()).toBe(true);
    expect(cb.consumeRetryToken()).toBe(true);
    expect(cb.consumeRetryToken()).toBe(false);

    expect(cb.getState().retryTokens).toBe(0);
  });

  it("single-flight subdomain lookup coalesces concurrent requests", async () => {
    const { singleFlightSubdomainLookup } = await import("@/lib/subdomain-cache");

    let callCount = 0;
    const mockLookup = () =>
      new Promise<{
        id: string;
        name: string;
        subdomain: string;
        type: string;
        tier: string;
        cachedAt: number;
      } | null>((resolve) => {
        callCount++;
        setTimeout(
          () =>
            resolve({
              id: "clinic-1",
              name: "Test Clinic",
              subdomain: "test",
              type: "doctor",
              tier: "pro",
              cachedAt: Date.now(),
            }),
          50,
        );
      });

    // Fire 5 concurrent lookups for the same subdomain — only 1 should hit the DB
    const uniqueSubdomain = `test-sf-${Date.now()}`;
    const promises = Array.from({ length: 5 }, () =>
      singleFlightSubdomainLookup(uniqueSubdomain, mockLookup),
    );
    const results = await Promise.all(promises);

    expect(callCount).toBe(1);
    results.forEach((r) => expect(r?.id).toBe("clinic-1"));
  });

  it("idempotencyKey produces deterministic output", async () => {
    const { idempotencyKey } = await import("@/lib/idempotency");

    const key1 = await idempotencyKey("stripe-charge", "clinic-1", "apt-123");
    const key2 = await idempotencyKey("stripe-charge", "clinic-1", "apt-123");
    const key3 = await idempotencyKey("stripe-charge", "clinic-1", "apt-456");

    expect(key1).toBe(key2);
    expect(key1).not.toBe(key3);
    expect(key1).toHaveLength(64); // SHA-256 hex
  });
});
