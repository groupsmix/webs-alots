"use client";

import { usePerformanceMonitoring } from "@/lib/hooks/use-performance-monitoring";

/**
 * Drop-in component that silently monitors Core Web Vitals.
 * Add to a layout to automatically track LCP, FID, CLS, FCP.
 *
 * In production, only enabled when NEXT_PUBLIC_ENABLE_PERF_MONITORING
 * is set to "true", avoiding unnecessary JS execution for all users.
 */
export function PerformanceMonitor() {
  const enabled =
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_ENABLE_PERF_MONITORING === "true";

  usePerformanceMonitoring({ enabled });
  return null;
}
