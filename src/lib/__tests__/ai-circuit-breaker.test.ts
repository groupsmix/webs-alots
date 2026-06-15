import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/features", () => ({
  getKVBinding: vi.fn(async () => undefined),
}));

describe("AI circuit breaker", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.stubEnv("AI_CIRCUIT_BREAKER_FAILURE_THRESHOLD", "3");
    vi.stubEnv("AI_CIRCUIT_BREAKER_FAILURE_WINDOW_MS", "60000");
    vi.stubEnv("AI_CIRCUIT_BREAKER_COOLDOWN_MS", "120000");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("opens after repeated failures inside the configured window", async () => {
    const breaker = await import("@/lib/ai/circuit-breaker");

    await breaker.recordAICircuitBreakerFailure({ reason: "http_503", statusCode: 503 });
    await breaker.recordAICircuitBreakerFailure({ reason: "http_503", statusCode: 503 });
    const snapshot = await breaker.recordAICircuitBreakerFailure({
      reason: "http_503",
      statusCode: 503,
    });

    expect(snapshot.state).toBe("open");
    expect(snapshot.consecutiveFailures).toBe(3);

    const allowed = await breaker.assertAICircuitBreakerAllowsRequests();
    expect(allowed.ok).toBe(false);
  });

  it("moves to half-open after cooldown and closes again on success", async () => {
    const breaker = await import("@/lib/ai/circuit-breaker");

    await breaker.recordAICircuitBreakerFailure({ reason: "timeout" });
    await breaker.recordAICircuitBreakerFailure({ reason: "timeout" });
    await breaker.recordAICircuitBreakerFailure({ reason: "timeout" });

    vi.advanceTimersByTime(120_001);

    let snapshot = await breaker.getAICircuitBreakerSnapshot();
    expect(snapshot.state).toBe("half_open");

    await breaker.recordAICircuitBreakerSuccess();

    snapshot = await breaker.getAICircuitBreakerSnapshot();
    expect(snapshot.state).toBe("closed");
    expect(snapshot.consecutiveFailures).toBe(0);
  });
});
