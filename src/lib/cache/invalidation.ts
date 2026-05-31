/**
 * Cache invalidation helpers.
 *
 * Call these after mutations that affect cached data to ensure consistency.
 * Each invalidation targets specific cache keys rather than flushing everything.
 */

import { clinicConfigKey, featureFlagsKey, userSessionKey, aiStatusKey } from "./cache-keys";
import { kvCache } from "./kv-cache";

/**
 * Invalidate clinic configuration cache.
 * Call after updating clinic settings (timezone, working hours, etc.).
 */
export async function invalidateClinicConfig(clinicId: string): Promise<void> {
  await kvCache.invalidate(clinicConfigKey(clinicId));
}

/**
 * Invalidate feature flags cache for a clinic.
 * Call after toggling features or updating per-clinic overrides.
 */
export async function invalidateFeatureFlags(clinicId: string): Promise<void> {
  await kvCache.invalidate(featureFlagsKey(clinicId));
}

/**
 * Invalidate user session cache.
 * Call after role changes, clinic reassignment, or logout.
 */
export async function invalidateUserSession(userId: string): Promise<void> {
  await kvCache.invalidate(userSessionKey(userId));
}

/**
 * Invalidate AI provider status cache.
 * Call after AI provider health check changes.
 */
export async function invalidateAIStatus(): Promise<void> {
  await kvCache.invalidate(aiStatusKey());
}
