/**
 * Distributed sliding-window rate limiter.
 *
 * Supports two backends:
 *
 * 1. **Supabase** (default when `RATE_LIMIT_BACKEND=supabase` or a Supabase URL
 *    is configured) — uses a `rate_limit_entries` table so counters survive
 *    cold starts and are shared across all Cloudflare Worker isolates.
 *
 * 2. **In-memory** (fallback) — uses a local `Map`.  Counters reset on cold
 *    starts and are **not** shared across isolates.  Suitable for development
 *    or single-instance deployments only.
 *
 * The backend is selected automatically at startup via `RATE_LIMIT_BACKEND`
 * env var or the presence of Supabase credentials.  Set
 * `RATE_LIMIT_BACKEND=memory` to force the in-memory fallback.
 *
 * Usage:
 *   const limiter = createRateLimiter({ windowMs: 60_000, max: 20 });
 *   if (!(await limiter.check(ip))) { // blocked }
 */

import { NextRequest } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

/**
 * Extract the real client IP from a request.
 *
 * Priority order (HIGH-02 hardened):
 *   1. CF-Connecting-IP — set by Cloudflare's edge, cannot be spoofed by
 *      the client when traffic goes through Cloudflare.
 *   2. "unknown" fallback — groups all unidentified requests together,
 *      which is safe behind a trusted proxy.
 *
 * X-Forwarded-For and X-Real-IP are intentionally NOT used because they
 * are attacker-controlled when the request does not pass through a trusted
 * proxy that overwrites them.  Since this app runs behind Cloudflare,
 * CF-Connecting-IP is the only trustworthy source of client IP.
 */
export function extractClientIp(request: NextRequest): string {
  return request.headers.get("cf-connecting-ip") ?? "unknown";
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimiterOptions {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum requests allowed per window */
  max: number;
  /** Maximum number of distinct keys to track (prevents memory exhaustion, in-memory only) */
  maxKeys?: number;
}

export interface RateLimiter {
  /**
   * Returns `true` if the request is allowed, `false` if rate-limited.
   * May be async when using a distributed backend.
   */
  check(key: string): boolean | Promise<boolean>;
}

// ── Backend selection ──

function shouldUseSupabase(): boolean {
  const explicit = process.env.RATE_LIMIT_BACKEND;
  if (explicit === "memory") return false;
  if (explicit === "supabase") return true;
  // Auto-detect: use Supabase when credentials are available
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// ── Supabase-backed distributed rate limiter ──

function createSupabaseRateLimiter(options: RateLimiterOptions): RateLimiter {
  const { windowMs, max } = options;

  // SECURITY NOTE: Service role key intentionally used here.
  // rate_limit_entries is a global infrastructure table (not tenant-scoped)
  // that tracks per-IP request counts. It contains no clinic/patient data and
  // is NOT subject to multi-tenant isolation. RLS is enabled on the table as
  // defense-in-depth (blocks anon/authenticated access) but the service role
  // bypasses it to perform atomic counter operations.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing required environment variables for Supabase rate limiter: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  const supabase = createSupabaseClient(supabaseUrl, serviceRoleKey);

  return {
    async check(key: string): Promise<boolean> {
      const now = Date.now();
      const windowStart = now - windowMs;

      try {
        // FIX (HIGH-03): Use a single atomic upsert with raw SQL via RPC
        // to eliminate the SELECT → UPDATE race condition.
        // The RPC function `rate_limit_increment` atomically:
        //   1. Resets the counter if the window has expired
        //   2. Increments the counter
        //   3. Returns the new count
        // If the RPC doesn't exist, fall back to the non-atomic approach
        // with a single upsert that's still better than separate SELECT+UPDATE.
        const resetAt = now + windowMs;
        const { data: rpcResult, error: rpcError } = await supabase
          .rpc("rate_limit_increment", {
            p_key: key,
            p_window_start: windowStart,
            p_reset_at: resetAt,
            p_now: new Date(now).toISOString(),
          });

        if (!rpcError && rpcResult != null) {
          // RPC succeeded — rpcResult is the new count
          return (rpcResult as number) <= max;
        }

        // RPC not available — fall back to upsert-based approach.
        // This is still susceptible to a narrow race window but is
        // better than the original SELECT → UPDATE pattern.
        if (rpcError) {
          logger.warn("Rate limiter RPC unavailable, falling back to upsert", { context: "rate-limit", error: rpcError });
        }

        const { data, error } = await supabase
          .from("rate_limit_entries")
          .select("count, reset_at")
          .eq("key", key)
          .maybeSingle();

        if (error) {
          // Fail OPEN: allow the request through when the rate-limit
          // infrastructure is unavailable (e.g. table missing, network
          // error). Blocking all traffic because of an infra outage is
          // worse than temporarily losing rate-limit protection.
          logger.error("Rate limiter query failed — failing open", { context: "rate-limit", error });
          return true;
        }

        if (!data || data.reset_at <= windowStart) {
          // Window expired or first request — create/reset entry
          const { error: upsertError } = await supabase
            .from("rate_limit_entries")
            .upsert(
              { key, count: 1, reset_at: resetAt, updated_at: new Date(now).toISOString() },
              { onConflict: "key" },
            );

          if (upsertError) {
            logger.error("Rate limiter upsert failed — failing open", { context: "rate-limit", error: upsertError });
            return true;
          }
          return true;
        }

        // Window still active — increment atomically using a conditional update.
        // The WHERE count = data.count acts as an optimistic lock.
        const expectedCount = data.count ?? 0;
        const newCount = expectedCount + 1;
        const { data: updated, error: updateError } = await supabase
          .from("rate_limit_entries")
          .update({ count: newCount, updated_at: new Date(now).toISOString() })
          .eq("key", key)
          .eq("count", expectedCount)
          .select("count")
          .maybeSingle();

        if (updateError) {
          logger.error("Rate limiter update failed — failing open", { context: "rate-limit", error: updateError });
          return true;
        }

        // If no row was updated, another request incremented concurrently.
        // Re-read the current count to get the accurate value.
        if (!updated) {
          const { data: reread } = await supabase
            .from("rate_limit_entries")
            .select("count")
            .eq("key", key)
            .maybeSingle();
          return (reread?.count ?? 0) <= max;
        }

        return newCount <= max;
      } catch (err) {
        // Network/transient failure — fail OPEN to prevent blocking
        // all legitimate traffic during infrastructure outages.
        // The trade-off (briefly losing rate-limit protection) is
        // preferable to returning 429 to every user.
        logger.error("Rate limiter network failure — failing open", { context: "rate-limit", error: err });
        return true;
      }
    },
  };
}

// ── In-memory fallback rate limiter ──

function createMemoryRateLimiter(options: RateLimiterOptions): RateLimiter {
  const { windowMs, max, maxKeys = 10_000 } = options;
  const store = new Map<string, RateLimitEntry>();
  let coldStartWarned = false;

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

      // Log a warning on the first request after a cold start so operators
      // know the rate-limit state was reset (all previous counters lost).
      if (!coldStartWarned) {
        coldStartWarned = true;
        // In-memory fallback active — counters not shared across isolates
      }

      prune(now);

      // Cap the number of tracked keys to prevent memory exhaustion
      // from a distributed attack using many distinct IPs.
      if (store.size >= maxKeys && !store.has(key)) {
        // Store full — rejecting new key to prevent memory exhaustion
        return false;
      }

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

// ── Factory ──

export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  if (shouldUseSupabase()) {
    return createSupabaseRateLimiter(options);
  }
  return createMemoryRateLimiter(options);
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

/** Chat endpoint: 15 req / 60s per IP (prevent AI API abuse) */
export const chatLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 15,
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
  { prefix: "/api/chat", limiter: chatLimiter },
  { prefix: "/api/webhooks", limiter: webhookLimiter },
  { prefix: "/api/notifications", limiter: apiMutationLimiter },
  // Catch-all for other API mutations (applied in middleware only to POST/PUT/PATCH/DELETE)
  { prefix: "/api/", limiter: apiMutationLimiter },
];
