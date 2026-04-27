/**
 * Distributed sliding-window rate limiter.
 *
 * Supports three backends:
 *
 * 1. **Cloudflare KV** (default when `RATE_LIMIT_BACKEND=kv` or RATE_LIMIT_KV
 *    binding is configured) — uses Workers KV namespace so counters survive
 *    Worker restarts and are shared across all Cloudflare edge locations.
 *    Uses sliding window algorithm for smoother rate limiting.
 *
 * 2. **Supabase** (default when `RATE_LIMIT_BACKEND=supabase` or a Supabase URL
 *    is configured) — uses a `rate_limit_entries` table so counters survive
 *    cold starts and are shared across all Cloudflare Worker isolates.
 *
 * 3. **In-memory** (fallback) — uses a local `Map`.  Counters reset on cold
 *    starts and are **not** shared across isolates.  Suitable for development
 *    or single-instance deployments only.
 *
 * The backend is selected automatically at startup via `RATE_LIMIT_BACKEND`
 * env var or the presence of KV/Supabase credentials.  Set
 * `RATE_LIMIT_BACKEND=memory` to force the in-memory fallback.
 *
 * Usage:
 *   const limiter = createRateLimiter({ windowMs: 60_000, max: 20 });
 *   if (!(await limiter.check(ip))) { // blocked }
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { logger } from "@/lib/logger";

/**
 * Extract the real client IP from a request (Issue 55).
 *
 * Priority order:
 *   1. CF-Connecting-IP — set by Cloudflare's edge, most trustworthy.
 *   2. X-Forwarded-For  — first IP in the chain (client IP when behind
 *      a trusted reverse proxy). Only the left-most entry is used.
 *   3. X-Real-IP        — set by some proxies (e.g. Nginx) to the real
 *      client address.
 *   4. "unknown"        — safe fallback that groups unidentified requests.
 *
 * Note: X-Forwarded-For / X-Real-IP can be spoofed when requests bypass
 * the trusted proxy.  For Cloudflare deployments CF-Connecting-IP is
 * authoritative, but the fallbacks improve dev/staging accuracy.
 */
export function extractClientIp(request: NextRequest): string {
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp;

  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  return request.headers.get("x-real-ip") ?? "unknown";
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
  /**
   * F-06: When true, deny requests on backend errors instead of allowing them.
   * Defaults to true for security-critical limiters (login, registration, AI).
   */
  failClosed?: boolean;
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

/**
 * Check if Cloudflare KV should be used for rate limiting.
 * Priority: KV > Supabase > Memory
 */
function shouldUseKV(): boolean {
  const explicit = process.env.RATE_LIMIT_BACKEND;
  if (explicit === "kv") return true;
  if (explicit === "memory" || explicit === "supabase") return false;
  // Auto-detect KV binding availability in Cloudflare Workers
  return !!(globalThis as unknown as { RATE_LIMIT_KV?: unknown }).RATE_LIMIT_KV;
}

// ── Circuit breaker for Supabase rate limiter ──
// After CIRCUIT_BREAKER_THRESHOLD consecutive failures, the Supabase
// backend "trips" and falls back to an in-memory limiter for
// CIRCUIT_BREAKER_RESET_MS. This prevents failing completely open
// during sustained infrastructure outages.
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_RESET_MS = 60_000;

interface CircuitBreakerState {
  consecutiveFailures: number;
  trippedAt: number | null;
  fallback: RateLimiter | null;
  lastFailure?: number;
}

function createCircuitBreaker(): CircuitBreakerState {
  return {
    consecutiveFailures: 0,
    trippedAt: null,
    fallback: null,
  };
}

function isCircuitOpen(state: CircuitBreakerState): boolean {
  if (!state.trippedAt) return false;
  if (Date.now() - state.trippedAt > CIRCUIT_BREAKER_RESET_MS) {
    // Reset circuit breaker — try Supabase again
    state.trippedAt = null;
    state.consecutiveFailures = 0;
    return false;
  }
  return true;
}

function recordFailure(state: CircuitBreakerState, options: RateLimiterOptions): void {
  state.consecutiveFailures++;
  state.lastFailure = Date.now();
  if (state.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
    state.trippedAt = Date.now();
    if (!state.fallback) {
      state.fallback = createMemoryRateLimiter(options);
    }
    logger.warn(
      `Rate limiter circuit breaker tripped after ${state.consecutiveFailures} failures — falling back to in-memory limiter`,
      { context: "rate-limit" },
    );
  }
}

function recordSuccess(state: CircuitBreakerState): void {
  state.consecutiveFailures = 0;
}

/**
 * F-06: Report rate-limit backend errors to Sentry at error severity.
 */
function reportRateLimitBackendError(operation: string, error: unknown): void {
  try {
    import("@sentry/nextjs").then((Sentry) => {
      Sentry.captureException(
        error instanceof Error ? error : new Error(`Rate limiter ${operation} failed`),
        {
          tags: { rateLimit: "backend_error", operation },
          level: "error",
        },
      );
    });
  } catch {
    // Sentry unavailable — structured log above is sufficient
  }
}

// ── Supabase-backed distributed rate limiter ──

function createSupabaseRateLimiter(options: RateLimiterOptions): RateLimiter {
  const { windowMs, max, failClosed = true } = options;
  const circuitBreaker = createCircuitBreaker();

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
      // If circuit breaker is tripped, use the in-memory fallback
      // instead of failing open.
      if (isCircuitOpen(circuitBreaker)) {
        return circuitBreaker.fallback!.check(key);
      }

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
          recordSuccess(circuitBreaker);
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
          // Record failure for circuit breaker. After N consecutive
          // failures, the circuit trips and we use an in-memory fallback
          // instead of failing completely open.
          logger.error("Rate limiter query failed", { context: "rate-limit", error });
          recordFailure(circuitBreaker, options);
          reportRateLimitBackendError("query", error);
          if (circuitBreaker.fallback) {
            return circuitBreaker.fallback.check(key);
          }
          return !failClosed;
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
            logger.error("Rate limiter upsert failed", { context: "rate-limit", error: upsertError });
            recordFailure(circuitBreaker, options);
            reportRateLimitBackendError("upsert", upsertError);
            if (circuitBreaker.fallback) {
              return circuitBreaker.fallback.check(key);
            }
            return !failClosed;
          }
          recordSuccess(circuitBreaker);
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
          logger.error("Rate limiter update failed", { context: "rate-limit", error: updateError });
          recordFailure(circuitBreaker, options);
          reportRateLimitBackendError("update", updateError);
          if (circuitBreaker.fallback) {
            return circuitBreaker.fallback.check(key);
          }
          return !failClosed;
        }
        recordSuccess(circuitBreaker);

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
        // Network/transient failure — record for circuit breaker.
        // After N consecutive failures, fall back to in-memory limiter
        // instead of failing completely open.
        logger.error("Rate limiter network failure", { context: "rate-limit", error: err });
        recordFailure(circuitBreaker, options);
        reportRateLimitBackendError("network", err);
        if (circuitBreaker.fallback) {
          return circuitBreaker.fallback.check(key);
        }
        return !failClosed;
      }
    },
  };
}

/**
 * Cloudflare KV binding type for rate limiting
 */
interface CloudflareKV {
  get(key: string, options?: { type: "text" | "json" }): Promise<string | number[] | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

// ── Cloudflare KV-backed distributed rate limiter ──

/**
 * Cloudflare KV-backed sliding window rate limiter.
 * Uses timestamp array stored in KV with sliding window algorithm.
 * Provides better rate limiting smoothness than fixed window.
 */
function createKVRateLimiter(options: RateLimiterOptions): RateLimiter {
  const { windowMs, max, failClosed = true } = options;
  const circuitBreaker = createCircuitBreaker();
  
  // KV-backed limiters have a configured grace period before they fail-closed
  const getKvGraceMs = () => {
    const raw = process.env.RATE_LIMIT_KV_GRACE_MS;
    const DEFAULT_KV_GRACE_MS = 60_000;
    if (!raw) return DEFAULT_KV_GRACE_MS;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : DEFAULT_KV_GRACE_MS;
  };

  return {
    async check(key: string): Promise<boolean> {
      // If circuit breaker is tripped, use the in-memory fallback
      if (isCircuitOpen(circuitBreaker)) {
        // Enforce the grace period fail-closed boundary
        const elapsed = Date.now() - (circuitBreaker.lastFailure || 0);
        if (elapsed > getKvGraceMs()) {
          logger.error("Rate limiter KV grace period expired, failing closed", {
            context: "rate-limit",
            key,
            elapsedMs: elapsed
          });
          return false; // Fail closed after grace period
        }
        return circuitBreaker.fallback!.check(key);
      }

      const now = Date.now();
      const windowStart = now - windowMs;

      try {
        // Get existing timestamps from KV
        // In production, RATE_LIMIT_KV would be bound to the Worker
        // For now, we'll check if the binding exists
        const kv = (globalThis as unknown as { RATE_LIMIT_KV?: CloudflareKV }).RATE_LIMIT_KV;

        if (!kv) {
          // KV binding not available, fall back to memory
          logger.warn("Rate limiter KV binding not available, falling back to in-memory", { context: "rate-limit" });
          recordFailure(circuitBreaker, options);
          const elapsed = Date.now() - (circuitBreaker.lastFailure || 0);
          if (elapsed > getKvGraceMs()) return false; // Fail closed after grace period
          if (circuitBreaker.fallback) {
            return circuitBreaker.fallback.check(key);
          }
          return !failClosed;
        }

        const stored = await kv.get(`rate_limit:${key}`, { type: "json" });
        const timestamps: number[] = (stored as number[] | null) ?? [];

        // Prune timestamps outside the sliding window
        const validTimestamps = timestamps.filter((ts) => ts > windowStart);

        if (validTimestamps.length >= max) {
          // Rate limit exceeded
          recordSuccess(circuitBreaker);
          return false;
        }

        // Add current request timestamp
        validTimestamps.push(now);

        // Write back to KV with TTL
        // TTL = window size + 1 minute buffer
        const ttlSeconds = Math.ceil(windowMs / 1000) + 60;
        await kv.put(`rate_limit:${key}`, JSON.stringify(validTimestamps), {
          expirationTtl: ttlSeconds,
        });

        recordSuccess(circuitBreaker);
        return true;
      } catch (err) {
        logger.error("Rate limiter KV failure", { context: "rate-limit", error: err });
        recordFailure(circuitBreaker, options);
        const elapsed = Date.now() - (circuitBreaker.lastFailure || 0);
        if (elapsed > getKvGraceMs()) return false; // Fail closed after grace period
        reportRateLimitBackendError("kv", err);
        if (circuitBreaker.fallback) {
          return circuitBreaker.fallback.check(key);
        }
        return !failClosed;
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
        if (process.env.NODE_ENV !== "test") {
          logger.warn(
            "In-memory rate limiter active — counters are not shared across isolates and will reset on cold starts. " +
            "Configure RATE_LIMIT_BACKEND=kv or RATE_LIMIT_BACKEND=supabase for production use.",
            { context: "rate-limit" },
          );
        }
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
  // Priority: KV > Supabase > Memory
  // KV provides best consistency for distributed rate limiting
  if (shouldUseKV()) {
    return createKVRateLimiter(options);
  }
  if (shouldUseSupabase()) {
    return createSupabaseRateLimiter(options);
  }

  // Only log the warning if not running in a test environment
  if (process.env.NODE_ENV !== "test") {
    logger.warn(
      "Rate limiter falling back to in-memory backend. " +
      "This is unsuitable for production serverless deployments — " +
      "counters reset on cold starts and are not shared across isolates. " +
      "Set RATE_LIMIT_BACKEND=kv or configure NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.",
      { context: "rate-limit" },
    );
  }
  return createMemoryRateLimiter(options);
}

/**
 * Pre-configured limiters for abuse-prone endpoints.
 * Each limiter is a singleton — the Map persists across requests
 * within the same Worker isolate.
 */

/** Login attempts: 5 req / 60s per key (applied per-email and per-IP in handler, per-IP in middleware) */
export const loginLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 5,
});

/** Auth endpoints catch-all: 10 req / 60s per IP (RL-01 defense-in-depth) */
export const authLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 10,
});

/**
 * Account lockout: 10 requests / 15 min per email.
 * After exceeding this, the account is locked for the remainder of the window.
 * This is stricter than loginLimiter and prevents sustained brute-force attacks
 * even from distributed IPs.
 *
 * SECURITY NOTE — request-count vs. failure-count lockout:
 * This limiter counts all login *requests* for a given email, not just failed
 * authentication attempts. This means:
 *   - An attacker gets at most 10 password guesses per 15-minute window per email,
 *     regardless of whether some guesses succeed (acceptable trade-off).
 *   - A legitimate user who logs in successfully still consumes attempts from the
 *     budget. In practice this is fine — 10 requests in 15 minutes is generous
 *     for normal login activity.
 *
 * The primary account lockout mechanism is Supabase Auth's built-in rate limiting
 * and brute-force protection (configured in the Supabase dashboard under
 * Auth > Rate Limits). This custom limiter is **defense-in-depth** — it adds an
 * application-layer limit in case Supabase's controls are misconfigured or bypassed.
 *
 * If failure-aware lockout is needed in the future, the handler should call
 * `accountLockoutLimiter.check(email)` only *after* Supabase returns an
 * authentication error, rather than on every request.
 */
export const accountLockoutLimiter = createRateLimiter({
  windowMs: 15 * 60_000,
  max: 10,
});

/** OTP send rate limiter: 3 req / 60s per phone number (prevents SMS pumping) */
export const otpSendLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 3,
});

/** Password reset rate limiter: 3 req / 60s per IP (prevents email spam) */
export const passwordResetLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 3,
});

/** Branding GET: 20 req / 60s per IP (public endpoint, prevents clinic enumeration) */
export const brandingLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 20,
});

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

/** AI Prescription: 50 req / 24h per doctor (included in plan limits) */
export const aiPrescriptionLimiter = createRateLimiter({
  windowMs: 24 * 60 * 60_000,
  max: 50,
});

/** Webhook ingress: 100 req / 60s per IP (higher limit for legitimate webhook traffic) */
export const webhookLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 100,
});

/** Booking submissions: 10 req / 60s per IP (prevent spam bookings) */
export const bookingLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 10,
});

/** Waiting-list joins: 3 req / 60 min per key (applied per phone, Issue 51) */
export const waitingListLimiter = createRateLimiter({
  windowMs: 60 * 60_000,
  max: 3,
});

/** Email verification: 5 req / 60s per IP (prevent OTP/link abuse) */
export const emailVerificationLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 5,
});

/** AI Patient Summary: 30 req / 24h per doctor (included in plan limits) */
export const aiPatientSummaryLimiter = createRateLimiter({
  windowMs: 24 * 60 * 60_000,
  max: 30,
});

/** AI Drug Interaction Check: 100 req / 24h per doctor */
export const aiDrugCheckLimiter = createRateLimiter({
  windowMs: 24 * 60 * 60_000,
  max: 100,
});

/** AI Manager (Smart Dashboard): 30 req / 24h per admin */
export const aiManagerLimiter = createRateLimiter({
  windowMs: 24 * 60 * 60_000,
  max: 30,
});

/** AI Auto-Suggest (Prescription suggestions): 100 req / 24h per doctor */
export const aiAutoSuggestLimiter = createRateLimiter({
  windowMs: 24 * 60 * 60_000,
  max: 100,
});

export interface RateLimitRule {
  /** URL prefix to match */
  prefix: string;
  /** The limiter instance to use */
  limiter: RateLimiter;
  /** Time window in milliseconds (mirrors the limiter's config for header reporting) */
  windowMs: number;
  /** Maximum requests allowed per window (mirrors the limiter's config for header reporting) */
  max: number;
}

/**
 * Ordered list of rate-limit rules. First matching prefix wins.
 */
export const rateLimitRules: RateLimitRule[] = [
  // RL-01: Auth endpoints — strict limits to prevent brute-force / credential stuffing.
  // Auth is primarily handled by Supabase, but demo-login and any future
  // auth routes under /api/auth/ get the loginLimiter (5 req / 60s).
  { prefix: "/api/auth/", limiter: loginLimiter, windowMs: 60_000, max: 5 },
  // RL-01: Public registration — same limits as onboarding to prevent abuse
  { prefix: "/api/v1/register-clinic", limiter: onboardingLimiter, windowMs: 60_000, max: 5 },
  // RL-01: Public check-in kiosk endpoints
  { prefix: "/api/checkin", limiter: apiMutationLimiter, windowMs: 60_000, max: 30 },
  // RL-01: Password reset — strict limit to prevent email spam
  { prefix: "/api/patient/delete-account", limiter: passwordResetLimiter, windowMs: 60_000, max: 3 },
  { prefix: "/api/booking/waiting-list", limiter: waitingListLimiter, windowMs: 60 * 60_000, max: 3 },
  { prefix: "/api/book", limiter: bookingLimiter, windowMs: 60_000, max: 10 },
  { prefix: "/api/verify-email", limiter: emailVerificationLimiter, windowMs: 60_000, max: 5 },
  { prefix: "/api/upload", limiter: uploadLimiter, windowMs: 60_000, max: 10 },
  { prefix: "/api/onboarding", limiter: onboardingLimiter, windowMs: 60_000, max: 5 },
  { prefix: "/api/v1/ai/patient-summary", limiter: aiPatientSummaryLimiter, windowMs: 24 * 60 * 60_000, max: 30 },
  { prefix: "/api/v1/ai/drug-check", limiter: aiDrugCheckLimiter, windowMs: 24 * 60 * 60_000, max: 100 },
  { prefix: "/api/v1/ai/prescription", limiter: aiPrescriptionLimiter, windowMs: 24 * 60 * 60_000, max: 50 },
  { prefix: "/api/ai/manager", limiter: aiManagerLimiter, windowMs: 24 * 60 * 60_000, max: 30 },
  { prefix: "/api/ai/auto-suggest", limiter: aiAutoSuggestLimiter, windowMs: 24 * 60 * 60_000, max: 100 },
  { prefix: "/api/chat", limiter: chatLimiter, windowMs: 60_000, max: 15 },
  { prefix: "/api/webhooks", limiter: webhookLimiter, windowMs: 60_000, max: 100 },
  { prefix: "/api/branding", limiter: brandingLimiter, windowMs: 60_000, max: 20 },
  { prefix: "/api/notifications", limiter: apiMutationLimiter, windowMs: 60_000, max: 30 },
  // Catch-all for other API mutations (applied in middleware only to POST/PUT/PATCH/DELETE)
  { prefix: "/api/", limiter: apiMutationLimiter, windowMs: 60_000, max: 30 },
];
