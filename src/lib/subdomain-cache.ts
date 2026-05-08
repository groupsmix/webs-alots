/**
 * Subdomain cache management.
 *
 * F-07: Two-tier cache:
 *   1. In-memory LRU cache — fast, per-isolate, lost on cold start.
 *   2. Cloudflare KV (FEATURE_FLAGS_KV) — per-edge-PoP, survives cold starts.
 *
 * The KV tier is used when the FEATURE_FLAGS_KV binding is available.
 * On cache miss in memory, the KV tier is checked before hitting the DB.
 *
 * A12-04: Use LRU cache with TTL to prevent unbounded memory growth.
 */

import { LRUCache } from "lru-cache";
import { logger } from "@/lib/logger";

interface CachedClinic {
  id: string;
  name: string;
  subdomain: string;
  type: string;
  tier: string;
  cachedAt: number;
}

// We use a negative cache to prevent DDoS via random subdomains
export interface NegativeCacheEntry {
  cachedAt: number;
}

/** TTL for cached entries (5 minutes) */
export const SUBDOMAIN_CACHE_TTL_MS = 5 * 60 * 1000;

/** TTL for negative cached entries (5 minutes) */
export const NEGATIVE_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * A12-04: Replace Map with LRU cache to prevent resource leak.
 * - max: 1000 entries (prevents unbounded growth)
 * - ttl: 300000ms (5 minutes)
 * - Automatic eviction of least recently used entries when full
 * - TTL-based expiration removes stale entries
 */
export const subdomainCache = new LRUCache<string, CachedClinic>({
  max: 1000,
  ttl: SUBDOMAIN_CACHE_TTL_MS,
  // Track cache stats for monitoring
  updateAgeOnGet: true,
  updateAgeOnHas: true,
});

/**
 * A12-04: Negative cache with LRU eviction.
 * - max: 1000 entries
 * - ttl: 300000ms (5 minutes)
 */
export const negativeSubdomainCache = new LRUCache<string, NegativeCacheEntry>({
  max: 1000,
  ttl: NEGATIVE_CACHE_TTL_MS,
  updateAgeOnGet: true,
  updateAgeOnHas: true,
});

/**
 * Get cache statistics for monitoring.
 * A12-04: Track hit rate and eviction count for observability.
 */
export function getCacheStats() {
  return {
    subdomain: {
      size: subdomainCache.size,
      max: subdomainCache.max,
      // LRU cache doesn't expose hit/miss counters directly,
      // but we can track size as a proxy for cache health
    },
    negative: {
      size: negativeSubdomainCache.size,
      max: negativeSubdomainCache.max,
    },
  };
}

/**
 * Add or update an entry in the subdomain cache.
 * LRU cache automatically handles eviction when full.
 */
export function setSubdomainCache(subdomain: string, clinic: CachedClinic): void {
  subdomainCache.set(subdomain, clinic);
  negativeSubdomainCache.delete(subdomain); // clear negative cache if valid
}

/**
 * Add an entry to the negative subdomain cache.
 * LRU cache automatically handles eviction when full.
 */
export function setNegativeSubdomainCache(subdomain: string): void {
  negativeSubdomainCache.set(subdomain, { cachedAt: Date.now() });
}

/**
 * Invalidate a specific subdomain entry from the cache.
 * The next request for this subdomain will trigger a fresh DB lookup.
 */
export function invalidateSubdomainCache(subdomain: string): void {
  subdomainCache.delete(subdomain);
  negativeSubdomainCache.delete(subdomain);
}

/**
 * Invalidate all cached subdomain entries.
 * Use sparingly — only for bulk operations.
 */
export function invalidateAllSubdomainCaches(): void {
  subdomainCache.clear();
  negativeSubdomainCache.clear();
}

// ── F-07: KV-backed subdomain cache helpers ──

/** KV key prefix for subdomain cache entries */
const KV_PREFIX = "subdomain:";
/** KV TTL in seconds (5 minutes) */
const KV_TTL_SECONDS = 300;

interface KVNamespace {
  get(key: string, options?: { type: "json" }): Promise<CachedClinic | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

function getKV(): KVNamespace | null {
  return (globalThis as unknown as { FEATURE_FLAGS_KV?: KVNamespace }).FEATURE_FLAGS_KV ?? null;
}

/**
 * F-07: Try to read a subdomain entry from KV cache.
 * Returns null on miss or if KV is not available.
 */
export async function getSubdomainFromKV(subdomain: string): Promise<CachedClinic | null> {
  const kv = getKV();
  if (!kv) return null;
  try {
    return await kv.get(`${KV_PREFIX}${subdomain}`, { type: "json" });
  } catch {
    return null;
  }
}

/**
 * F-07: Write a subdomain entry to KV cache.
 */
export async function setSubdomainInKV(subdomain: string, clinic: CachedClinic): Promise<void> {
  const kv = getKV();
  if (!kv) return;
  try {
    await kv.put(`${KV_PREFIX}${subdomain}`, JSON.stringify(clinic), {
      expirationTtl: KV_TTL_SECONDS,
    });
  } catch {
    // KV write failure is non-critical
  }
}

/**
 * F-07: Delete a subdomain entry from KV cache.
 */
export async function deleteSubdomainFromKV(subdomain: string): Promise<void> {
  const kv = getKV();
  if (!kv) return;
  try {
    await kv.delete(`${KV_PREFIX}${subdomain}`);
  } catch {
    // KV delete failure is non-critical
  }
}
