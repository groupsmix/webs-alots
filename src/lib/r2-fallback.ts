/**
 * R2 Fallback URL Configuration
 *
 * When the primary R2 bucket is unreachable, automatically
 * falls back to the replica bucket URL.
 *
 * Includes a circuit breaker to avoid adding latency to every request
 * during an outage: after consecutive failures, the primary is assumed
 * down and skipped until the cooldown period expires.
 *
 * Required env vars:
 *   R2_PUBLIC_URL          — Primary bucket public URL
 *   R2_REPLICA_PUBLIC_URL  — Replica bucket public URL (different region)
 */

import { logger } from "@/lib/logger";

interface R2FallbackConfig {
  primaryUrl: string;
  replicaUrl: string | null;
  healthCheckPath: string;
  timeoutMs: number;
}

function getR2FallbackConfig(): R2FallbackConfig {
  return {
    primaryUrl: (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, ""),
    replicaUrl: process.env.R2_REPLICA_PUBLIC_URL
      ? process.env.R2_REPLICA_PUBLIC_URL.replace(/\/$/, "")
      : null,
    healthCheckPath: "/health-check.txt",
    timeoutMs: 3000,
  };
}

let _cachedActiveUrl: string | null = null;
let _lastCheck = 0;
const CHECK_INTERVAL_MS = 60_000; // Re-check every 60 seconds

// ── Circuit breaker state ──
// After FAILURE_THRESHOLD consecutive failures, the primary is considered
// "open" (down) and skipped for COOLDOWN_MS to avoid adding latency.
const FAILURE_THRESHOLD = 3;
const COOLDOWN_MS = 30_000; // 30 seconds before retrying a failed endpoint

let _primaryFailures = 0;
let _primaryCircuitOpenAt = 0; // timestamp when circuit opened (0 = closed)

/**
 * Check if the circuit breaker for the primary URL is open (tripped).
 * Returns true if the primary should be skipped.
 */
function isPrimaryCircuitOpen(): boolean {
  if (_primaryFailures < FAILURE_THRESHOLD) return false;
  const now = Date.now();
  if (now - _primaryCircuitOpenAt >= COOLDOWN_MS) {
    // Cooldown expired — move to half-open (allow one probe)
    _primaryFailures = FAILURE_THRESHOLD - 1;
    return false;
  }
  return true;
}

function recordPrimarySuccess(): void {
  _primaryFailures = 0;
  _primaryCircuitOpenAt = 0;
}

function recordPrimaryFailure(): void {
  _primaryFailures++;
  if (_primaryFailures >= FAILURE_THRESHOLD && _primaryCircuitOpenAt === 0) {
    _primaryCircuitOpenAt = Date.now();
  }
}

/**
 * Get the active R2 public URL, falling back to replica if primary is down.
 * Caches the result for 60 seconds to avoid excessive health checks.
 * Uses a circuit breaker to skip the primary during sustained outages.
 */
export async function getActiveR2Url(): Promise<string> {
  const config = getR2FallbackConfig();
  const now = Date.now();

  // Return cached result if still fresh
  if (_cachedActiveUrl && now - _lastCheck < CHECK_INTERVAL_MS) {
    return _cachedActiveUrl;
  }

  // Try primary first (unless circuit breaker is open)
  if (config.primaryUrl && !isPrimaryCircuitOpen()) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

      const response = await fetch(
        `${config.primaryUrl}${config.healthCheckPath}`,
        {
          method: "HEAD",
          signal: controller.signal,
        },
      );
      clearTimeout(timeout);

      if (response.ok || response.status === 404) {
        // 404 is fine — means the bucket is reachable, just no health file
        recordPrimarySuccess();
        _cachedActiveUrl = config.primaryUrl;
        _lastCheck = now;
        return config.primaryUrl;
      }
      recordPrimaryFailure();
    } catch (err) {
      logger.warn("Primary R2 bucket unreachable", { context: "r2-fallback", error: err });
      recordPrimaryFailure();
    }
  }

  // Fall back to replica
  if (config.replicaUrl) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

      const response = await fetch(
        `${config.replicaUrl}${config.healthCheckPath}`,
        {
          method: "HEAD",
          signal: controller.signal,
        },
      );
      clearTimeout(timeout);

      if (response.ok || response.status === 404) {
        _cachedActiveUrl = config.replicaUrl;
        _lastCheck = now;
        return config.replicaUrl;
      }
    } catch (err) {
      logger.warn("Replica R2 bucket also unreachable", { context: "r2-fallback", error: err });
    }
  }

  // Both down — return primary as last resort
  _cachedActiveUrl = config.primaryUrl || "";
  _lastCheck = now;
  return _cachedActiveUrl;
}

/**
 * Build a full URL for an R2 object, using the active bucket.
 * Falls back to replica automatically if primary is down.
 *
 * @param objectKey  Object key in the bucket (e.g., "clinics/abc/logo.png")
 * @returns Full public URL to the object
 */
export async function getR2ObjectUrl(objectKey: string): Promise<string> {
  const baseUrl = await getActiveR2Url();
  return `${baseUrl}/${objectKey}`;
}

/**
 * Reset the cached active URL and circuit breaker state
 * (useful for testing or forcing re-check).
 */
export function resetR2FallbackCache(): void {
  _cachedActiveUrl = null;
  _lastCheck = 0;
  _primaryFailures = 0;
  _primaryCircuitOpenAt = 0;
}
