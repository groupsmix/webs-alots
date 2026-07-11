/**
 * H-03: Durable Objects rate limiter backend.
 *
 * Provides strongly consistent per-key rate limiting across all
 * Cloudflare edge locations. Each key maps to a single DO instance,
 * ensuring atomic counter increments with no eventual-consistency races.
 *
 * Architecture:
 *   Worker → DO stub (by key hash) → atomic sliding window check
 *
 * The DO stores timestamps in in-memory state and uses alarm() for
 * window expiry cleanup. No external storage needed — state is
 * transactionally consistent within the DO instance.
 *
 * Provisioning:
 *   1. Add DO class export to wrangler.toml (see [durable_objects] section)
 *   2. Run: wrangler deploy (registers the DO binding)
 *   3. Set RATE_LIMIT_BACKEND=do in wrangler.toml [vars]
 *
 * @see https://developers.cloudflare.com/durable-objects/
 */

import { getWorkerBinding } from "@/lib/cf-bindings";
import { logger } from "@/lib/logger";
import type { RateLimiter, RateLimiterOptions } from "./rate-limit";

// ── Durable Object class (deployed as a separate Worker binding) ──

/**
 * RateLimiterDO is a Cloudflare Durable Object that provides strongly
 * consistent sliding-window rate limiting for a single key.
 *
 * Each rate-limited key (e.g., IP address) maps to one DO instance.
 * The Worker fetches the DO stub by ID (derived from the key) and
 * sends HTTP requests to check/increment the counter.
 */

// ── Client-side factory (used by the Worker to talk to the DO) ──

interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}

interface DurableObjectId {
  toString(): string;
}

interface DurableObjectStub {
  fetch(request: Request | string, init?: RequestInit): Promise<Response>;
}

/**
 * Check if Durable Objects rate limiting is available.
 */
export function shouldUseDO(): boolean {
  // nosemgrep: semgrep.env-access — boot-time backend selection, validated below
  const explicit = process.env.RATE_LIMIT_BACKEND;
  if (explicit === "do") return true;
  if (explicit === "kv" || explicit === "supabase" || explicit === "memory") return false;
  // Auto-detect DO binding availability
  return !!(globalThis as unknown as { RATE_LIMITER_DO?: DurableObjectNamespace }).RATE_LIMITER_DO;
}

/**
 * Create a rate limiter backed by Durable Objects.
 * Each key gets its own DO instance for strongly consistent counting.
 */
export function createDORateLimiter(options: RateLimiterOptions): RateLimiter {
  const { windowMs, max, failClosed = true } = options;

  return {
    async check(key: string): Promise<boolean> {
      try {
        // Bindings live on getCloudflareContext().env under
        // @opennextjs/cloudflare (v1.17+), NOT on globalThis — resolve at
        // request time, falling back to globalThis for tests/dev.
        const ns = await getWorkerBinding<DurableObjectNamespace>("RATE_LIMITER_DO");

        if (!ns) {
          logger.warn("Rate limiter DO binding not available", { context: "rate-limit" });
          return !failClosed;
        }

        const id = ns.idFromName(key);
        const stub = ns.get(id);

        const response = await stub.fetch(
          `https://rate-limiter.internal/check?windowMs=${windowMs}&max=${max}`,
        );

        const result = (await response.json()) as { allowed: boolean };
        return result.allowed;
      } catch (err) {
        logger.error("Rate limiter DO failure", { context: "rate-limit", error: err });
        return !failClosed;
      }
    },
  };
}
