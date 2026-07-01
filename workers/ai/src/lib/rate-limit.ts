/**
 * Minimal in-isolate rate limiter (defense-in-depth).
 *
 * The CopilotKit endpoint is already gated to authenticated super_admins, but
 * it had NO rate limiting at all — a hot session could fan out unbounded
 * (and expensive) calls to the upstream AI provider. This adds a cheap
 * sliding-window guard keyed per user.
 *
 * LIMITATION: state lives in the isolate's memory, so the limit is enforced
 * per-isolate, not globally across the whole Worker fleet. That is acceptable
 * for a low-traffic, super_admin-only endpoint as a backstop against runaway
 * loops / accidental hammering. For a hard global guarantee, back this with a
 * KV namespace or a Durable Object (would require a new wrangler binding).
 */

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 30; // per key, per window

const buckets = new Map<string, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds the caller should wait before retrying (0 when allowed). */
  retryAfterSec: number;
}

/**
 * Record a hit for `key` and report whether it is within the allowed rate.
 */
export function checkRateLimit(key: string, now: number = Date.now()): RateLimitResult {
  const cutoff = now - WINDOW_MS;
  const recent = (buckets.get(key) ?? []).filter((ts) => ts > cutoff);

  if (recent.length >= MAX_REQUESTS) {
    buckets.set(key, recent);
    const oldest = recent[0];
    const retryAfterSec = Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000));
    return { allowed: false, retryAfterSec };
  }

  recent.push(now);
  buckets.set(key, recent);

  // Opportunistically prune empty buckets so the map cannot grow without
  // bound across many distinct keys over the isolate's lifetime.
  if (buckets.size > 1024) {
    for (const [k, v] of buckets) {
      if (v.length === 0 || v[v.length - 1] <= cutoff) buckets.delete(k);
    }
  }

  return { allowed: true, retryAfterSec: 0 };
}
