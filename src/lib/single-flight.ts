/**
 * A75-2: Single-flight / request coalescing for cache reads.
 *
 * When multiple concurrent requests need the same cache key (e.g. clinic
 * branding, feature flags), only one fetch executes; all others await
 * the same in-flight promise. This prevents cache stampedes on cold
 * starts or after cache expiry.
 *
 * Usage:
 *   const flight = createSingleFlight<BrandingConfig>();
 *   const config = await flight.do(clinicId, () => fetchBrandingFromDB(clinicId));
 */

const _flights = new Map<string, Promise<unknown>>();

export interface SingleFlight<T> {
  /**
   * Execute `fn` for the given `key`. If a call with the same key is
   * already in flight, return its promise instead of starting a new one.
   */
  do(key: string, fn: () => Promise<T>): Promise<T>;
  /** Number of in-flight requests (for testing / metrics). */
  inflight(): number;
}

export function createSingleFlight<T>(): SingleFlight<T> {
  const flights = new Map<string, Promise<T>>();

  return {
    async do(key: string, fn: () => Promise<T>): Promise<T> {
      const existing = flights.get(key);
      if (existing) return existing;

      const promise = fn().finally(() => {
        flights.delete(key);
      });

      flights.set(key, promise);
      return promise;
    },

    inflight(): number {
      return flights.size;
    },
  };
}

/**
 * Global single-flight instance for general-purpose deduplication.
 * Prefer creating scoped instances via `createSingleFlight()` when
 * type safety is important.
 */
export const globalFlight = createSingleFlight<unknown>();
