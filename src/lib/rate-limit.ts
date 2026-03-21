/**
 * In-memory sliding-window rate limiter for edge runtime.
 *
 * Tracks request counts per IP in a Map. Old entries are pruned on
 * every check to prevent unbounded growth. State resets on cold starts,
 * which is acceptable — sustained abuse is still throttled.
 *
 * Usage:
 *   const limiter = createRateLimiter({ windowMs: 60_000, max: 20 });
 *   if (!limiter.check(ip)) { // blocked }
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimiterOptions {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum requests allowed per window */
  max: number;
}

interface RateLimiter {
  /**
   * Returns `true` if the request is allowed, `false` if rate-limited.
   */
  check(key: string): boolean;
}

export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const { windowMs, max } = options;
  const store = new Map<string, RateLimitEntry>();

  // Prune expired entries periodically to prevent memory leaks
  let lastPrune = Date.now();
  const PRUNE_INTERVAL = windowMs * 2;

  function prune(now: number) {
    if (now - lastPrune < PRUNE_INTERVAL) return;
    lastPrune = now;
    for (const [key, entry] of store) {
      if (now >= entry.resetAt) {
        store.delete(key);
      }
    }
  }

  return {
    check(key: string): boolean {
      const now = Date.now();
      prune(now);

      const entry = store.get(key);

      if (!entry || now >= entry.resetAt) {
        store.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }

      entry.count += 1;
      return entry.count <= max;
    },
  };
}

/**
 * Pre-configured limiters for abuse-prone endpoints.
 * Each limiter is a singleton — the Map persists across requests
 * within the same Worker isolate.
 */

/** General API mutations: 30 req / 60s per IP */
export const apiMutationLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 30,
});

/** File uploads: 10 req / 60s per IP */
export const uploadLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 10,
});

/** Onboarding (clinic creation): 5 req / 60s per IP */
export const onboardingLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 5,
});

/** Webhook ingress: 100 req / 60s per IP (higher limit for legitimate webhook traffic) */
export const webhookLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 100,
});

export interface RateLimitRule {
  /** URL prefix to match */
  prefix: string;
  /** The limiter instance to use */
  limiter: RateLimiter;
}

/**
 * Ordered list of rate-limit rules. First matching prefix wins.
 */
export const rateLimitRules: RateLimitRule[] = [
  { prefix: "/api/upload", limiter: uploadLimiter },
  { prefix: "/api/onboarding", limiter: onboardingLimiter },
  { prefix: "/api/webhooks", limiter: webhookLimiter },
  { prefix: "/api/notifications", limiter: apiMutationLimiter },
  // Catch-all for other API mutations (applied in middleware only to POST/PUT/PATCH/DELETE)
  { prefix: "/api/", limiter: apiMutationLimiter },
];
