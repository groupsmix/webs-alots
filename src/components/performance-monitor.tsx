"use client";

import { usePerformanceMonitoring } from "@/lib/hooks/use-performance-monitoring";

const ENABLED =
  process.env.NODE_ENV === "development" ||
  process.env.NEXT_PUBLIC_ENABLE_PERF_MONITORING === "true";

/**
 * Drop-in component that silently monitors Core Web Vitals.
 * Add to a layout to automatically track LCP, FID, CLS, FCP.
 *
 * Only active in development or when NEXT_PUBLIC_ENABLE_PERF_MONITORING
 * is explicitly set to "true" (Issue 41).
 */
export function PerformanceMonitor() {
  usePerformanceMonitoring({ enabled: ENABLED });
  return null;
}
