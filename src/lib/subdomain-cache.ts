/**
 * Subdomain cache management.
 *
 * Provides a shared Map and invalidation helpers so that both
 * middleware.ts and API routes access the same cache instance.
 *
 * Since Next.js middleware and API routes share the same process
 * in Cloudflare Workers, the cache Map is shared via a module-level
 * export.
 */

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

/** Maximum number of entries to prevent unbounded memory growth (PERF-05). */
const MAX_CACHE_SIZE = 500;

/** Shared subdomain cache — used by middleware and invalidation API */
export const subdomainCache = new Map<string, CachedClinic>();

/** Shared negative cache — used to block random subdomains quickly */
export const negativeSubdomainCache = new Map<string, NegativeCacheEntry>();

/** TTL for cached entries (1 minute) */
export const SUBDOMAIN_CACHE_TTL_MS = 60 * 1000;

/** TTL for negative cached entries (5 minutes) */
export const NEGATIVE_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Evict expired entries from the cache.
 * Called periodically to prevent stale entries from accumulating.
 */
export function evictExpiredEntries(): void {
  const now = Date.now();
  for (const [key, value] of subdomainCache) {
    if (now - value.cachedAt > SUBDOMAIN_CACHE_TTL_MS) {
      subdomainCache.delete(key);
    }
  }
  for (const [key, value] of negativeSubdomainCache) {
    if (now - value.cachedAt > NEGATIVE_CACHE_TTL_MS) {
      negativeSubdomainCache.delete(key);
    }
  }
}

/**
 * Enforce the maximum cache size using LRU-style eviction.
 * Removes the oldest entry (first inserted) when the cache is full.
 */
function enforceMaxSize(): void {
  while (subdomainCache.size >= MAX_CACHE_SIZE) {
    const oldest = subdomainCache.keys().next().value;
    if (oldest !== undefined) {
      subdomainCache.delete(oldest);
    } else {
      break;
    }
  }
  while (negativeSubdomainCache.size >= MAX_CACHE_SIZE) {
    const oldest = negativeSubdomainCache.keys().next().value;
    if (oldest !== undefined) {
      negativeSubdomainCache.delete(oldest);
    } else {
      break;
    }
  }
}

/**
 * Add or update an entry in the subdomain cache.
 * Enforces the maximum cache size before inserting.
 */
export function setSubdomainCache(subdomain: string, clinic: CachedClinic): void {
  // If the key already exists, delete it first so re-insertion moves it
  // to the end of the Map's iteration order (most recently used).
  if (subdomainCache.has(subdomain)) {
    subdomainCache.delete(subdomain);
  } else {
    enforceMaxSize();
  }
  subdomainCache.set(subdomain, clinic);
  negativeSubdomainCache.delete(subdomain); // clear negative cache if valid
}

/**
 * Add an entry to the negative subdomain cache.
 */
export function setNegativeSubdomainCache(subdomain: string): void {
  if (negativeSubdomainCache.has(subdomain)) {
    negativeSubdomainCache.delete(subdomain);
  } else {
    enforceMaxSize();
  }
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
}

// Periodically evict expired entries every 30 seconds to prevent
// stale entries from accumulating in memory.
if (typeof setInterval !== "undefined") {
  setInterval(evictExpiredEntries, 30_000);
}
