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

/** Shared subdomain cache — used by middleware and invalidation API */
export const subdomainCache = new Map<string, CachedClinic>();

/** TTL for cached entries (1 minute) */
export const SUBDOMAIN_CACHE_TTL_MS = 60 * 1000;

/**
 * Invalidate a specific subdomain entry from the cache.
 * The next request for this subdomain will trigger a fresh DB lookup.
 */
export function invalidateSubdomainCache(subdomain: string): void {
  subdomainCache.delete(subdomain);
}

/**
 * Invalidate all cached subdomain entries.
 * Use sparingly — only for bulk operations.
 */
export function invalidateAllSubdomainCaches(): void {
  subdomainCache.clear();
}
