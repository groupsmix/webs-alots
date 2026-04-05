/**
 * Performance Monitoring
 * 
 * Track and optimize system performance
 */

import { logger } from '@/lib/logger';
import * as Sentry from '@sentry/nextjs';

export interface PerformanceMetrics {
  operation: string;
  duration: number;
  success: boolean;
  timestamp: string;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private readonly maxMetrics = 1000;
  
  /**
   * Track operation performance
   */
  track(operation: string, duration: number, success: boolean, metadata?: Record<string, any>): void {
    const metric: PerformanceMetrics = {
      operation,
      duration,
      success,
      timestamp: new Date().toISOString(),
      metadata,
    };
    
    this.metrics.push(metric);
    
    // Keep only last N metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }
    
    // Log slow operations
    if (duration > 5000) {
      logger.warn('Slow operation detected', {
        context: 'performance-monitor',
        operation,
        duration,
        metadata,
      });
      
      Sentry.captureMessage(`Slow operation: ${operation}`, {
        level: 'warning',
        extra: { duration, metadata },
      });
    }
    
    // Send to Sentry
    Sentry.setMeasurement(operation, duration, 'millisecond');
  }
  
  /**
   * Get performance statistics
   */
  getStats(operation?: string) {
    const filtered = operation
      ? this.metrics.filter(m => m.operation === operation)
      : this.metrics;
    
    if (filtered.length === 0) {
      return null;
    }
    
    const durations = filtered.map(m => m.duration);
    const successCount = filtered.filter(m => m.success).length;
    
    return {
      operation: operation || 'all',
      count: filtered.length,
      successRate: successCount / filtered.length,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      p50: this.percentile(durations, 0.5),
      p95: this.percentile(durations, 0.95),
      p99: this.percentile(durations, 0.99),
    };
  }
  
  /**
   * Calculate percentile
   */
  private percentile(arr: number[], p: number): number {
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[index];
  }
  
  /**
   * Clear metrics
   */
  clear(): void {
    this.metrics = [];
  }
}

export const performanceMonitor = new PerformanceMonitor();

/**
 * Measure function execution time
 */
export async function measurePerformance<T>(
  operation: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const start = Date.now();
  let success = false;
  
  try {
    const result = await fn();
    success = true;
    return result;
  } finally {
    const duration = Date.now() - start;
    performanceMonitor.track(operation, duration, success, metadata);
  }
}
