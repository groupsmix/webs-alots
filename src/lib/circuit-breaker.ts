/**
 * A74-2 / A76-2: Lightweight circuit breaker for outbound service calls.
 *
 * Prevents cascading latency amplification when a dependency (OpenAI,
 * WhatsApp, Stripe, Resend) is hard-down. Instead of every request
 * blocking for timeout × retries, the breaker trips after N consecutive
 * failures and fast-fails subsequent calls until a half-open probe
 * succeeds.
 *
 * Also implements a per-breaker global retry budget (A76-2): once a
 * configurable number of retries have been consumed within a rolling
 * window, additional retries are suppressed — even if individual
 * operations have retries remaining.
 *
 * States:
 *   CLOSED   → normal operation; failures are counted
 *   OPEN     → fast-fail; no requests pass through
 *   HALF_OPEN → one probe request allowed; success closes, failure re-opens
 *
 * Deep-Dive P6: this is the *general-purpose* breaker for outbound
 * dependencies (WhatsApp, Stripe, Resend, etc). AI provider routes use the
 * separate `@/lib/ai/circuit-breaker` instead, which persists state in
 * Cloudflare KV (so it survives Worker isolate churn) and uses a longer
 * open window tuned for LLM provider outages. The two are intentionally not
 * merged: KV-backed persistence has latency/cost trade-offs that are only
 * justified for AI traffic today. If a second consumer needs KV-backed
 * state, promote the AI breaker's storage layer into a shared module rather
 * than duplicating it again.
 */

import { logger } from "@/lib/logger";

// ── Types ──

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  /** Unique name for logging / metrics. */
  name: string;
  /** Number of consecutive failures before opening the circuit. Default 5. */
  failureThreshold?: number;
  /** Time in ms before an OPEN circuit transitions to HALF_OPEN. Default 30 000. */
  resetTimeoutMs?: number;
  /** Maximum retries allowed across all callers in `retryWindowMs`. Default 20. */
  globalRetryBudget?: number;
  /** Rolling window in ms for the global retry budget. Default 60 000. */
  retryWindowMs?: number;
}

export interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  lastFailureAt: number;
  retryTokens: number;
  retryWindowStart: number;
}

// ── Implementation ──

export class CircuitBreaker {
  readonly name: string;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly globalRetryBudget: number;
  private readonly retryWindowMs: number;

  private state: CircuitState = "CLOSED";
  private consecutiveFailures = 0;
  private lastFailureAt = 0;

  private retriesUsed = 0;
  private retryWindowStart = Date.now();

  constructor(opts: CircuitBreakerOptions) {
    this.name = opts.name;
    this.failureThreshold = opts.failureThreshold ?? 5;
    this.resetTimeoutMs = opts.resetTimeoutMs ?? 30_000;
    this.globalRetryBudget = opts.globalRetryBudget ?? 20;
    this.retryWindowMs = opts.retryWindowMs ?? 60_000;
  }

  /** Current snapshot — useful for health-check endpoints / tests. */
  getState(): CircuitBreakerState {
    this.maybeTransitionToHalfOpen();
    return {
      state: this.state,
      failures: this.consecutiveFailures,
      lastFailureAt: this.lastFailureAt,
      retryTokens: Math.max(0, this.globalRetryBudget - this.retriesUsed),
      retryWindowStart: this.retryWindowStart,
    };
  }

  /**
   * Execute `fn` through the circuit breaker.
   *
   * @param fn        The async work to perform.
   * @param fallback  Optional fast-fail value returned when the circuit is OPEN.
   * @throws          Re-throws `fn`'s error when no fallback is provided and
   *                  the circuit is CLOSED or HALF_OPEN.
   * @throws          `CircuitOpenError` when the circuit is OPEN and no
   *                  fallback was supplied.
   */
  async fire<T>(fn: () => Promise<T>, fallback?: T): Promise<T> {
    this.maybeTransitionToHalfOpen();

    if (this.state === "OPEN") {
      logger.warn("Circuit breaker OPEN — fast-failing", {
        context: "circuit-breaker",
        breaker: this.name,
      });
      if (fallback !== undefined) return fallback;
      throw new CircuitOpenError(this.name);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  /**
   * A76-2: Consume a retry token from the global budget.
   * Returns `true` if a retry is allowed, `false` if the budget is
   * exhausted for the current window.
   */
  consumeRetryToken(): boolean {
    this.rollRetryWindow();
    if (this.retriesUsed >= this.globalRetryBudget) {
      logger.warn("Global retry budget exhausted", {
        context: "circuit-breaker",
        breaker: this.name,
        retriesUsed: this.retriesUsed,
        window: this.retryWindowMs,
      });
      return false;
    }
    this.retriesUsed++;
    return true;
  }

  // ── Internal ──

  private onSuccess(): void {
    if (this.state === "HALF_OPEN") {
      logger.info("Circuit breaker probe succeeded — closing", {
        context: "circuit-breaker",
        breaker: this.name,
      });
    }
    this.consecutiveFailures = 0;
    this.state = "CLOSED";
  }

  private onFailure(): void {
    this.consecutiveFailures++;
    this.lastFailureAt = Date.now();

    if (this.consecutiveFailures >= this.failureThreshold && this.state !== "OPEN") {
      this.state = "OPEN";
      logger.error("Circuit breaker tripped — OPEN", {
        context: "circuit-breaker",
        breaker: this.name,
        failures: this.consecutiveFailures,
      });
    }
  }

  private maybeTransitionToHalfOpen(): void {
    if (this.state === "OPEN" && Date.now() - this.lastFailureAt >= this.resetTimeoutMs) {
      this.state = "HALF_OPEN";
      logger.info("Circuit breaker → HALF_OPEN (probe allowed)", {
        context: "circuit-breaker",
        breaker: this.name,
      });
    }
  }

  private rollRetryWindow(): void {
    const now = Date.now();
    if (now - this.retryWindowStart >= this.retryWindowMs) {
      this.retriesUsed = 0;
      this.retryWindowStart = now;
    }
  }
}

/** Typed error thrown when the circuit is OPEN and no fallback is provided. */
export class CircuitOpenError extends Error {
  readonly breaker: string;
  constructor(name: string) {
    super(`Circuit breaker "${name}" is OPEN — request rejected`);
    this.breaker = name;
    this.name = "CircuitOpenError";
    // Required for correct `instanceof` checks when targeting ES5 / CommonJS.
    // TypeScript subclasses of built-ins (Error, Array …) lose their prototype
    // chain after transpilation unless we restore it explicitly.
    Object.setPrototypeOf(this, CircuitOpenError.prototype);
  }
}

// ── Per-service singleton breakers ──

const breakers = new Map<string, CircuitBreaker>();

/**
 * Get or create a named circuit breaker singleton.
 *
 * Usage:
 *   const breaker = getCircuitBreaker("openai");
 *   const result = await breaker.fire(() => fetchAllowlisted(url, init));
 */
export function getCircuitBreaker(
  name: string,
  opts?: Omit<CircuitBreakerOptions, "name">,
): CircuitBreaker {
  let cb = breakers.get(name);
  if (!cb) {
    cb = new CircuitBreaker({ name, ...opts });
    breakers.set(name, cb);
  }
  return cb;
}
