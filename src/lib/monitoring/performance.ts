/**
 * Performance monitoring utilities.
 *
 * Tracks API response times, database query performance, and
 * provides regression detection via moving averages.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PerformanceEntry {
  endpoint: string;
  method: string;
  durationMs: number;
  statusCode: number;
  timestamp: string;
}

export interface PerformanceStats {
  endpoint: string;
  sampleCount: number;
  p50: number;
  p95: number;
  p99: number;
  mean: number;
  min: number;
  max: number;
  errorRate: number;
}

export interface RegressionResult {
  endpoint: string;
  isRegression: boolean;
  currentP95: number;
  baselineP95: number;
  percentageChange: number;
  threshold: number;
}

// ─── Implementation ──────────────────────────────────────────────────────────

export function computeStats(entries: PerformanceEntry[]): PerformanceStats {
  if (entries.length === 0) {
    return {
      endpoint: "",
      sampleCount: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      mean: 0,
      min: 0,
      max: 0,
      errorRate: 0,
    };
  }

  const durations = entries.map((e) => e.durationMs).sort((a, b) => a - b);
  const errors = entries.filter((e) => e.statusCode >= 500).length;

  return {
    endpoint: entries[0].endpoint,
    sampleCount: entries.length,
    p50: percentile(durations, 50),
    p95: percentile(durations, 95),
    p99: percentile(durations, 99),
    mean: durations.reduce((a, b) => a + b, 0) / durations.length,
    min: durations[0],
    max: durations[durations.length - 1],
    errorRate: errors / entries.length,
  };
}

export function detectRegression(
  current: PerformanceStats,
  baseline: PerformanceStats,
  thresholdPercent: number = 50,
): RegressionResult {
  if (baseline.p95 === 0) {
    return {
      endpoint: current.endpoint,
      isRegression: false,
      currentP95: current.p95,
      baselineP95: 0,
      percentageChange: 0,
      threshold: thresholdPercent,
    };
  }

  const percentageChange = ((current.p95 - baseline.p95) / baseline.p95) * 100;

  return {
    endpoint: current.endpoint,
    isRegression: percentageChange > thresholdPercent,
    currentP95: current.p95,
    baselineP95: baseline.p95,
    percentageChange: Math.round(percentageChange * 100) / 100,
    threshold: thresholdPercent,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function percentile(sorted: number[], pct: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((pct / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}
