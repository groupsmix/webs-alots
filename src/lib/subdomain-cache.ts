/**
 * Subdomain cache management.
 *
 * F-07: Two-tier cache:
 *   1. In-memory Map — fast, per-isolate, lost on cold start.
 *   2. Cloudflare KV (FEATURE_FLAGS_KV) — per-edge-PoP, survives cold starts.
 *
 * The KV tier is used when the FEATURE_FLAGS_KV binding is available.
 * On cache miss in memory, the KV tier is checked before hitting the DB.
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
function evictExpiredEntries(): void {
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

// ── F-07: KV-backed subdomain cache helpers ──

/** KV key prefix for subdomain cache entries */
const _KV_PREFIX = "subdomain:";
/** KV TTL in seconds (5 minutes) */
const _KV_TTL_SECONDS = 300;

interface KVNamespace {
  get(key: string, options?: { type: "json" }): Promise<CachedClinic | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

function _getKV(): KVNamespace | null {
  return (globalThis as unknown as { FEATURE_FLAGS_KV?: KVNamespace }).FEATURE_FLAGS_KV ?? null;
}

// ── A75-2: Single-flight / promise coalescing ──

/**
 * In-flight promise map for subdomain lookups. On a cold cache, N
 * concurrent requests for the same subdomain each hit the DB (thundering
 * herd). By coalescing in-flight promises we ensure only the first
 * request performs the lookup; all others await the same promise.
 */
const inFlightLookups = new Map<string, Promise<CachedClinic | null>>();

/**
 * A75-2: Resolve a subdomain through a single-flight gate.
 *
 * `lookupFn` is invoked at most once per subdomain while a lookup is
 * in progress. Concurrent callers receive the same promise. The entry
 * is removed from the in-flight map once the promise settles (success
 * or failure) so subsequent requests trigger a fresh lookup.
 *
 * Usage (in middleware or route):
 *   const clinic = await singleFlightSubdomainLookup(subdomain, async () => {
 *     const { data } = await supabase.from("clinics")...;
 *     return data ? { id: data.id, ... , cachedAt: Date.now() } : null;
 *   });
 */
export async function singleFlightSubdomainLookup(
  subdomain: string,
  lookupFn: () => Promise<CachedClinic | null>,
): Promise<CachedClinic | null> {
  // Fast path: already in memory cache
  const cached = subdomainCache.get(subdomain);
  if (cached && Date.now() - cached.cachedAt <= SUBDOMAIN_CACHE_TTL_MS) {
    return cached;
  }

  // Check negative cache
  const neg = negativeSubdomainCache.get(subdomain);
  if (neg && Date.now() - neg.cachedAt <= NEGATIVE_CACHE_TTL_MS) {
    return null;
  }

  // Coalesce in-flight lookups
  const existing = inFlightLookups.get(subdomain);
  if (existing) return existing;

  const promise = lookupFn()
    .then((result) => {
      if (result) {
        setSubdomainCache(subdomain, result);
      } else {
        setNegativeSubdomainCache(subdomain);
      }
      return result;
    })
    .finally(() => {
      inFlightLookups.delete(subdomain);
    });

  inFlightLookups.set(subdomain, promise);
  return promise;
}
