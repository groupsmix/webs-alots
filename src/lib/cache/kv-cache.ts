/**
 * Application-level KV cache for frequently accessed read-heavy data.
 *
 * Uses Cloudflare KV (APP_CACHE_KV binding) with automatic fallback to an
 * in-memory LRU for development and test environments.
 *
 * Usage:
 *   const config = await kvCache.get<ClinicConfig>(clinicConfigKey(id));
 *   if (!config) {
 *     const fresh = await fetchClinicConfig(id);
 *     await kvCache.set(clinicConfigKey(id), fresh, CACHE_TTL.CLINIC_CONFIG);
 *   }
 */

import { getWorkerBinding } from "@/lib/cf-bindings";
import { logger } from "@/lib/logger";

interface KVLike {
  get(key: string, options?: { type: "text" }): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

// In-memory fallback for dev/test (evicts LRU after 500 entries).
const memStore = new Map<string, { value: string; expiresAt: number }>();
const MAX_MEM_ENTRIES = 500;

function evictIfNeeded(): void {
  if (memStore.size <= MAX_MEM_ENTRIES) return;
  // Evict oldest entries.
  const entries = [...memStore.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt);
  const toRemove = entries.slice(0, entries.length - MAX_MEM_ENTRIES);
  for (const [key] of toRemove) memStore.delete(key);
}

const memKV: KVLike = {
  async get(key) {
    const entry = memStore.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      memStore.delete(key);
      return null;
    }
    return entry.value;
  },
  async put(key, value, options) {
    const ttl = options?.expirationTtl ?? 300;
    memStore.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
    evictIfNeeded();
  },
  async delete(key) {
    memStore.delete(key);
  },
};

async function resolveKV(): Promise<KVLike> {
  const kv = await getWorkerBinding<KVLike>("APP_CACHE_KV");
  return kv ?? memKV;
}

export const kvCache = {
  /**
   * Get a cached value. Returns null on miss.
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const kv = await resolveKV();
      const raw = await kv.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      logger.warn("Cache get failed", { key, error: err });
      return null;
    }
  },

  /**
   * Store a value with TTL (seconds).
   */
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      const kv = await resolveKV();
      await kv.put(key, JSON.stringify(value), { expirationTtl: ttlSeconds });
    } catch (err) {
      logger.warn("Cache set failed", { key, error: err });
    }
  },

  /**
   * Invalidate a cached key.
   */
  async invalidate(key: string): Promise<void> {
    try {
      const kv = await resolveKV();
      await kv.delete(key);
    } catch (err) {
      logger.warn("Cache invalidate failed", { key, error: err });
    }
  },

  /**
   * Invalidate all keys matching a prefix.
   * Note: KV does not support prefix deletion natively. For production,
   * callers should invalidate specific keys. This method is provided for
   * local dev where the in-memory store supports iteration.
   */
  async invalidatePrefix(prefix: string): Promise<void> {
    // Only works with in-memory store; KV requires listing.
    for (const key of memStore.keys()) {
      if (key.startsWith(prefix)) memStore.delete(key);
    }
  },
};
