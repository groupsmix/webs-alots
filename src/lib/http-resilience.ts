/**
 * A62-D1 / A62-D2 / A62-D3: HTTP call resilience patterns.
 *
 * A62-D1: Timeout enforcement on external HTTP calls
 * A62-D2: Circuit breaker pattern for cascading failure prevention
 * A62-D3: Exponential backoff retry logic for transient failures
 */

import { logger } from "@/lib/logger";

/**
 * A62-D1: Timeout configuration for external calls.
 */
export const HTTP_TIMEOUTS = {
  /** Typical API call timeout (sync endpoints). */
  DEFAULT: 10000, // 10 seconds
  /** For webhook deliveries and async operations. */
  ASYNC: 30000, // 30 seconds
  /** For streaming/long-polling. */
  STREAMING: 60000, // 60 seconds
  /** For critical payment/health checks. */
  CRITICAL: 5000, // 5 seconds (fail fast)
};

/**
 * A62-D2: Circuit breaker for external service calls.
 *
 * Tracks failure count and duration. When failure count exceeds threshold,
 * circuit "opens" and rejects requests for a cooldown period to prevent
 * cascading failures and give the downstream service time to recover.
 */
export interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number | null;
  state: "closed" | "open" | "half-open";
}

export interface CircuitBreakerConfig {
  /** Number of failures before opening the circuit. */
  failureThreshold: number;
  /** How long to keep the circuit open before trying again (ms). */
  resetTimeout: number;
  /** Half-open: how many successes before closing again. */
  successThreshold: number;
}

const DEFAULT_CB_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute
  successThreshold: 2,
};

/**
 * In-memory circuit breaker store. In production, use a distributed cache
 * (Redis, Memcached) so all instances share state.
 */
const circuitBreakers = new Map<string, CircuitBreakerState>();

/**
 * Get or initialize a circuit breaker for a named service.
 */
function getCircuitBreaker(name: string): CircuitBreakerState {
  if (!circuitBreakers.has(name)) {
    circuitBreakers.set(name, {
      failures: 0,
      lastFailureTime: null,
      state: "closed",
    });
  }
  return circuitBreakers.get(name)!;
}

/**
 * A62-D2: Check if a circuit breaker is open.
 * Returns true if the circuit is open and should reject requests.
 */
export function isCircuitOpen(
  name: string,
  config: CircuitBreakerConfig = DEFAULT_CB_CONFIG,
): boolean {
  const cb = getCircuitBreaker(name);

  if (cb.state === "closed") {
    return false; // Circuit is healthy
  }

  if (cb.state === "open") {
    const now = Date.now();
    const timeSinceLastFailure = now - (cb.lastFailureTime || 0);

    if (timeSinceLastFailure >= config.resetTimeout) {
      // Reset timeout expired. Try again (half-open).
      cb.state = "half-open";
      cb.failures = 0;
      logger.info(`circuit-breaker[${name}]: transitioning to half-open`, {
        context: "http-resilience",
        service: name,
      });
      return false; // Allow one request through
    }

    return true; // Circuit still open
  }

  // Half-open: allow requests through but track results
  return false;
}

/**
 * A62-D2: Record a failure on a circuit breaker.
 * If failures exceed threshold, open the circuit.
 */
export function recordCircuitFailure(
  name: string,
  config: CircuitBreakerConfig = DEFAULT_CB_CONFIG,
): void {
  const cb = getCircuitBreaker(name);
  cb.failures++;
  cb.lastFailureTime = Date.now();

  if (cb.state === "half-open") {
    // Any failure while half-open goes back to open
    cb.state = "open";
    logger.warn(`circuit-breaker[${name}]: re-opened after half-open failure`, {
      context: "http-resilience",
      service: name,
    });
  } else if (cb.failures >= config.failureThreshold && cb.state === "closed") {
    cb.state = "open";
    logger.warn(
      `circuit-breaker[${name}]: opened after ${cb.failures} failures (threshold: ${config.failureThreshold})`,
      {
        context: "http-resilience",
        service: name,
      },
    );
  }
}

/**
 * A62-D2: Record a success on a circuit breaker.
 * If successes exceed threshold while half-open, close the circuit.
 */
export function recordCircuitSuccess(
  name: string,
  config: CircuitBreakerConfig = DEFAULT_CB_CONFIG,
): void {
  const cb = getCircuitBreaker(name);

  if (cb.state === "half-open") {
    cb.failures++;
    if (cb.failures >= config.successThreshold) {
      cb.state = "closed";
      cb.failures = 0;
      cb.lastFailureTime = null;
      logger.info(`circuit-breaker[${name}]: closed after successful half-open requests`, {
        context: "http-resilience",
        service: name,
      });
    }
  } else if (cb.state === "closed") {
    // Reset failure counter on success while closed (to tolerate occasional glitches)
    cb.failures = Math.max(0, cb.failures - 1);
  }
}

/**
 * A62-D3: Exponential backoff retry configuration.
 */
export interface RetryConfig {
  /** Maximum number of retry attempts. */
  maxAttempts: number;
  /** Base delay in ms. Actual delay = baseDelayMs * (2 ^ attemptNumber). */
  baseDelayMs: number;
  /** Maximum delay cap to prevent delays from growing too large. */
  maxDelayMs: number;
  /** HTTP status codes to retry on (default: 408, 429, 500-599). */
  retryableStatuses: number[];
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 100,
  maxDelayMs: 10000,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

/**
 * A62-D3: Calculate exponential backoff delay.
 * delay = min(baseDelayMs * (2 ^ attemptNumber), maxDelayMs)
 * Plus jitter: ±20% of the delay to prevent thundering herd.
 */
export function calculateBackoffDelay(
  attemptNumber: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): number {
  const exponential = Math.min(config.baseDelayMs * Math.pow(2, attemptNumber), config.maxDelayMs);
  const jitter = exponential * 0.2 * (Math.random() * 2 - 1); // ±20%
  return Math.max(0, exponential + jitter);
}

/**
 * A62-D1 / A62-D3: Resilient fetch wrapper.
 * Applies timeout, circuit breaker, and retry logic.
 *
 * Usage:
 *   const response = await resilientFetch(
 *     "https://api.example.com/data",
 *     { method: "GET" },
 *     { serviceName: "example-api", timeoutMs: 10000 }
 *   );
 */
export async function resilientFetch(
  url: string,
  init?: RequestInit,
  options?: {
    serviceName?: string;
    timeoutMs?: number;
    retryConfig?: RetryConfig;
    circuitBreakerConfig?: CircuitBreakerConfig;
    onRetry?: (attemptNumber: number, error: string) => void;
  },
): Promise<Response> {
  const serviceName = options?.serviceName || new URL(url).hostname;
  const timeoutMs = options?.timeoutMs || HTTP_TIMEOUTS.DEFAULT;
  const retryConfig = options?.retryConfig || DEFAULT_RETRY_CONFIG;
  const cbConfig = options?.circuitBreakerConfig || DEFAULT_CB_CONFIG;

  // A62-D2: Check circuit breaker
  if (isCircuitOpen(serviceName, cbConfig)) {
    const error = new Error(`Circuit breaker open for ${serviceName}`);
    logger.warn("resilient-fetch: circuit breaker rejected request", {
      context: "http-resilience",
      serviceName,
      url,
    });
    throw error;
  }

  let lastError: Error | null = null;

  for (let attemptNumber = 0; attemptNumber < retryConfig.maxAttempts; attemptNumber++) {
    try {
      // A62-D1: Apply timeout using AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      let response: Response;
      try {
        response = await fetch(url, {
          ...init,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      // Check if response status is retryable
      if (!retryConfig.retryableStatuses.includes(response.status)) {
        // Success or non-retryable error
        recordCircuitSuccess(serviceName, cbConfig);
        return response;
      }

      // Retryable status code
      if (attemptNumber < retryConfig.maxAttempts - 1) {
        const delayMs = calculateBackoffDelay(attemptNumber, retryConfig);
        const reason = `HTTP ${response.status}`;
        lastError = new Error(reason);

        if (options?.onRetry) {
          options.onRetry(attemptNumber + 1, reason);
        }

        logger.debug(`resilient-fetch: retrying after ${delayMs}ms`, {
          context: "http-resilience",
          serviceName,
          url,
          status: response.status,
          attempt: attemptNumber + 1,
        });

        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      // Final attempt, return the error response
      recordCircuitFailure(serviceName, cbConfig);
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if this is a timeout or network error
      const isTimeout = (error as { name?: string })?.name === "AbortError";
      const isRetryable = isTimeout || error instanceof TypeError;

      if (!isRetryable || attemptNumber >= retryConfig.maxAttempts - 1) {
        // Non-retryable or final attempt
        recordCircuitFailure(serviceName, cbConfig);
        logger.error("resilient-fetch: final attempt failed", {
          context: "http-resilience",
          serviceName,
          url,
          error: lastError.message,
          isTimeout,
        });
        throw lastError;
      }

      // Retry
      const delayMs = calculateBackoffDelay(attemptNumber, retryConfig);
      const reason = isTimeout ? "Timeout" : lastError.message;

      if (options?.onRetry) {
        options.onRetry(attemptNumber + 1, reason);
      }

      logger.debug(`resilient-fetch: retrying after ${delayMs}ms`, {
        context: "http-resilience",
        serviceName,
        url,
        error: reason,
        attempt: attemptNumber + 1,
      });

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  // Should not reach here
  throw lastError || new Error("Unknown error in resilientFetch");
}
