/**
 * Provider Config Cache
 *
 * Without caching, every /api/ai call hits the DB to load 8 provider rows
 * before routing — adds 20-50ms of latency and hammers Postgres at scale.
 *
 * Cache is invalidated on any PATCH/POST through the admin route. The TTL
 * is a safety net for the in-memory case (multiple serverless instances
 * won't see each other's writes, so the TTL forces eventual consistency).
 *
 * In a multi-instance deployment (Cloudflare Workers, Vercel functions),
 * each instance has its own copy of the cache. A 30-second TTL keeps
 * staleness bounded.
 */

import { logger } from "@/lib/logger";
import type { AIProvider, ProviderConfig } from "./types";

const TTL_MS = 30_000;

interface CachedEntry {
  configs: Map<AIProvider, ProviderConfig>;
  expiresAt: number;
}

let _cached: CachedEntry | null = null;

/** Returns the cached configs if still fresh, otherwise null. */
export function getCachedConfigs(): Map<AIProvider, ProviderConfig> | null {
  if (!_cached) return null;
  if (Date.now() > _cached.expiresAt) {
    _cached = null;
    return null;
  }
  return _cached.configs;
}

/** Stores the freshly loaded configs into the cache. */
export function setCachedConfigs(configs: Map<AIProvider, ProviderConfig>): void {
  _cached = {
    configs,
    expiresAt: Date.now() + TTL_MS,
  };
}

/** Invalidate the cache — call this whenever provider configs are mutated. */
export function invalidateConfigCache(): void {
  if (_cached) {
    logger.debug("AI provider config cache invalidated", { context: "ai-config-cache" });
  }
  _cached = null;
}

/**
 * Cached feature toggle state. Tracked separately from provider configs
 * because toggles change rarely and the lookup is per-request.
 */
interface FeatureToggleCache {
  toggles: Map<string, { isEnabled: boolean; minTier: number }>;
  expiresAt: number;
}

let _toggleCache: FeatureToggleCache | null = null;

export function getCachedFeatureToggles(): Map<
  string,
  { isEnabled: boolean; minTier: number }
> | null {
  if (!_toggleCache) return null;
  if (Date.now() > _toggleCache.expiresAt) {
    _toggleCache = null;
    return null;
  }
  return _toggleCache.toggles;
}

export function setCachedFeatureToggles(
  toggles: Map<string, { isEnabled: boolean; minTier: number }>,
): void {
  _toggleCache = {
    toggles,
    expiresAt: Date.now() + TTL_MS,
  };
}

export function invalidateFeatureToggleCache(): void {
  _toggleCache = null;
}
