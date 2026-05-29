/**
 * A80-1: Per-tenant usage metrics for cost attribution.
 *
 * Tracks per-clinic counters for key cost-driving operations:
 *   - API requests
 *   - AI tokens consumed
 *   - R2 storage operations
 *   - Notification sends
 *
 * Counters are held in memory per isolate and flushed to a structured
 * log entry (picked up by Cloudflare Logpush / Sentry) on a periodic
 * interval or when the isolate is recycled.
 *
 * This is a lightweight, non-blocking implementation suitable for
 * Cloudflare Workers. For a persistent backend, counters should be
 * flushed to a KV namespace or analytics table.
 */

import { logger } from "@/lib/logger";

// ── Types ──

export interface TenantUsage {
  requests: number;
  aiTokens: number;
  r2Ops: number;
  notificationSends: number;
  lastFlushedAt: number;
}

type MetricKind = keyof Omit<TenantUsage, "lastFlushedAt">;

// ── State ──

const usageByClinic = new Map<string, TenantUsage>();

const FLUSH_INTERVAL_MS = 60_000;

function getOrCreate(clinicId: string): TenantUsage {
  let entry = usageByClinic.get(clinicId);
  if (!entry) {
    entry = {
      requests: 0,
      aiTokens: 0,
      r2Ops: 0,
      notificationSends: 0,
      lastFlushedAt: Date.now(),
    };
    usageByClinic.set(clinicId, entry);
  }
  return entry;
}

// ── Public API ──

/**
 * Increment a usage counter for a clinic.
 *
 * @param clinicId - The tenant clinic ID.
 * @param metric   - Which counter to increment.
 * @param delta    - Amount to add (default 1).
 */
export function trackUsage(clinicId: string, metric: MetricKind, delta = 1): void {
  const entry = getOrCreate(clinicId);
  entry[metric] += delta;
}

/**
 * Flush accumulated metrics for all clinics to structured logs and reset.
 * Called periodically or on isolate teardown.
 */
export function flushTenantMetrics(): void {
  const now = Date.now();
  for (const [clinicId, usage] of usageByClinic) {
    if (
      usage.requests === 0 &&
      usage.aiTokens === 0 &&
      usage.r2Ops === 0 &&
      usage.notificationSends === 0
    ) {
      continue;
    }
    logger.info("tenant_usage", {
      context: "tenant-metrics",
      clinicId,
      requests: usage.requests,
      aiTokens: usage.aiTokens,
      r2Ops: usage.r2Ops,
      notificationSends: usage.notificationSends,
      windowMs: now - usage.lastFlushedAt,
    });
    usage.requests = 0;
    usage.aiTokens = 0;
    usage.r2Ops = 0;
    usage.notificationSends = 0;
    usage.lastFlushedAt = now;
  }
}

/**
 * Get a read-only snapshot of current counters (for health/debug endpoints).
 */
export function getTenantMetricsSnapshot(): ReadonlyMap<string, Readonly<TenantUsage>> {
  return usageByClinic;
}

// Periodic flush every 60 s
if (typeof setInterval !== "undefined") {
  setInterval(flushTenantMetrics, FLUSH_INTERVAL_MS);
}
