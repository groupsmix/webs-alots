"use client";

import { usePerformanceMonitoring } from "@/lib/hooks/use-performance-monitoring";

/**
 * Drop-in component that silently monitors Core Web Vitals.
 * Add to a layout to automatically track LCP, FID, CLS, FCP.
 */
export function PerformanceMonitor() {
  usePerformanceMonitoring();
  return null;
}
