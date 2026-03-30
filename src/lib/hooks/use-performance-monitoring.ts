"use client";

import { useEffect } from "react";
import { logger } from "@/lib/logger";

interface WebVitalsMetric {
  name: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
}

interface PerformanceMonitoringOptions {
  /** When false the hook is a no-op. Defaults to true. */
  enabled?: boolean;
}

/**
 * Monitor Core Web Vitals (LCP, FID, CLS, FCP, TTFB) using
 * the PerformanceObserver API. Logs metrics via the app logger.
 */
export function usePerformanceMonitoring(options: PerformanceMonitoringOptions = {}) {
  const { enabled = true } = options;
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined" || !("PerformanceObserver" in window)) return;

    const report = (metric: WebVitalsMetric) => {
      logger.info(`[Web Vitals] ${metric.name}: ${metric.value.toFixed(2)} (${metric.rating})`, {
        context: "web-vitals",
      });
    };

    const observers: PerformanceObserver[] = [];

    try {
      // Largest Contentful Paint
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          const value = lastEntry.startTime;
          report({
            name: "LCP",
            value,
            rating: value <= 2500 ? "good" : value <= 4000 ? "needs-improvement" : "poor",
          });
        }
      });
      lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
      observers.push(lcpObserver);
    } catch (err) {
      logger.warn("LCP observer not supported", { context: "web-vitals", error: err });
    }

    try {
      // First Input Delay
      const fidObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const fidEntry = entry as PerformanceEventTiming;
          const value = fidEntry.processingStart - fidEntry.startTime;
          report({
            name: "FID",
            value,
            rating: value <= 100 ? "good" : value <= 300 ? "needs-improvement" : "poor",
          });
        }
      });
      fidObserver.observe({ type: "first-input", buffered: true });
      observers.push(fidObserver);
    } catch (err) {
      logger.warn("FID observer not supported", { context: "web-vitals", error: err });
    }

    try {
      // Cumulative Layout Shift
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const layoutShift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
          if (!layoutShift.hadRecentInput && layoutShift.value) {
            clsValue += layoutShift.value;
          }
        }
        report({
          name: "CLS",
          value: clsValue,
          rating: clsValue <= 0.1 ? "good" : clsValue <= 0.25 ? "needs-improvement" : "poor",
        });
      });
      clsObserver.observe({ type: "layout-shift", buffered: true });
      observers.push(clsObserver);
    } catch (err) {
      logger.warn("CLS observer not supported", { context: "web-vitals", error: err });
    }

    // Navigation Timing (FCP, TTFB)
    try {
      const navObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const paintEntry = entry as PerformancePaintTiming;
          if (paintEntry.name === "first-contentful-paint") {
            const value = paintEntry.startTime;
            report({
              name: "FCP",
              value,
              rating: value <= 1800 ? "good" : value <= 3000 ? "needs-improvement" : "poor",
            });
          }
        }
      });
      navObserver.observe({ type: "paint", buffered: true });
      observers.push(navObserver);
    } catch (err) {
      logger.warn("Paint observer not supported", { context: "web-vitals", error: err });
    }

    return () => {
      observers.forEach((obs) => obs.disconnect());
    };
  }, [enabled]);
}
