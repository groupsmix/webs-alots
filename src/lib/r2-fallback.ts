/**
 * R2 Fallback URL Configuration
 *
 * When the primary R2 bucket is unreachable, automatically
 * falls back to the replica bucket URL.
 *
 * Required env vars:
 *   R2_PUBLIC_URL          — Primary bucket public URL
 *   R2_REPLICA_PUBLIC_URL  — Replica bucket public URL (different region)
 */

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

/**
 * Get the active R2 public URL, falling back to replica if primary is down.
 * Caches the result for 60 seconds to avoid excessive health checks.
 */
export async function getActiveR2Url(): Promise<string> {
  const config = getR2FallbackConfig();
  const now = Date.now();

  // Return cached result if still fresh
  if (_cachedActiveUrl && now - _lastCheck < CHECK_INTERVAL_MS) {
    return _cachedActiveUrl;
  }

  // Try primary first
  if (config.primaryUrl) {
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
        _cachedActiveUrl = config.primaryUrl;
        _lastCheck = now;
        return config.primaryUrl;
      }
    } catch {
      console.warn("[R2 Fallback] Primary bucket unreachable, trying replica...");
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
        console.warn("[R2 Fallback] Using replica bucket URL");
        return config.replicaUrl;
      }
    } catch {
      console.error("[R2 Fallback] Replica bucket also unreachable!");
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
 * Reset the cached active URL (useful for testing or forcing re-check).
 */
export function resetR2FallbackCache(): void {
  _cachedActiveUrl = null;
  _lastCheck = 0;
}
