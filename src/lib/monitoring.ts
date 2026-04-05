/**
 * Monitoring and Error Tracking
 * 
 * Centralized monitoring for AI Revenue Agent
 */

import * as Sentry from '@sentry/nextjs';
import { logger } from './logger';

// Initialize Sentry if DSN is provided
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    
    // AI-specific tags
    beforeSend(event) {
      // Add AI context to all events
      if (event.tags) {
        event.tags.component = event.tags.component || 'ai-revenue-agent';
      }
      return event;
    },
  });
}

/**
 * Track AI action execution
 */
export function trackActionExecution(
  actionId: string,
  actionType: string,
  businessId: string,
  success: boolean,
  duration: number
) {
  // Log to console
  logger.info('AI action executed', {
    context: 'monitoring',
    actionId,
    actionType,
    businessId,
    success,
    duration,
  });
  
  // Send to Sentry as breadcrumb
  Sentry.addBreadcrumb({
    category: 'ai-action',
    message: `${actionType} ${success ? 'succeeded' : 'failed'}`,
    level: success ? 'info' : 'error',
    data: {
      actionId,
      actionType,
      businessId,
      duration,
    },
  });
  
  // Track metric
  if (typeof window !== 'undefined' && (window as any).plausible) {
    (window as any).plausible('AI Action', {
      props: {
        type: actionType,
        success: success ? 'yes' : 'no',
        duration: Math.round(duration),
      },
    });
  }
}

/**
 * Track AI decision generation
 */
export function trackDecisionGeneration(
  businessId: string,
  actionsCount: number,
  confidence: number,
  duration: number
) {
  logger.info('AI decision generated', {
    context: 'monitoring',
    businessId,
    actionsCount,
    confidence,
    duration,
  });
  
  Sentry.addBreadcrumb({
    category: 'ai-decision',
    message: `Generated ${actionsCount} actions`,
    level: 'info',
    data: {
      businessId,
      actionsCount,
      confidence,
      duration,
    },
  });
}

/**
 * Track integration errors
 */
export function trackIntegrationError(
  integration: 'whatsapp' | 'sms' | 'email' | 'booking' | 'pricing',
  error: Error,
  context?: Record<string, any>
) {
  logger.error(`${integration} integration error`, {
    context: 'monitoring',
    integration,
    error: error.message,
    ...context,
  });
  
  Sentry.captureException(error, {
    tags: {
      integration,
      component: 'ai-integration',
    },
    extra: context,
  });
}

/**
 * Track safety violations
 */
export function trackSafetyViolation(
  ruleId: string,
  severity: string,
  actionType: string,
  businessId: string
) {
  logger.warn('Safety violation detected', {
    context: 'monitoring',
    ruleId,
    severity,
    actionType,
    businessId,
  });
  
  Sentry.captureMessage(`Safety violation: ${ruleId}`, {
    level: severity === 'critical' ? 'error' : 'warning',
    tags: {
      ruleId,
      severity,
      actionType,
      component: 'ai-safety',
    },
    extra: {
      businessId,
    },
  });
}

/**
 * Track performance metrics
 */
export function trackPerformance(
  metric: string,
  value: number,
  unit: 'ms' | 'count' | 'bytes',
  tags?: Record<string, string>
) {
  logger.info('Performance metric', {
    context: 'monitoring',
    metric,
    value,
    unit,
    ...tags,
  });
  
  // Send to Sentry as measurement
  Sentry.setMeasurement(metric, value, unit);
}

/**
 * Health check endpoint data
 */
export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  checks: {
    database: boolean;
    ai_engine: boolean;
    integrations: {
      whatsapp: boolean;
      sms: boolean;
      email: boolean;
    };
  };
  metrics: {
    uptime: number;
    memory_usage: number;
    cpu_usage: number;
  };
}

/**
 * Get system health status
 */
export async function getHealthStatus(): Promise<HealthCheck> {
  const checks = {
    database: true, // TODO: Add actual database check
    ai_engine: true,
    integrations: {
      whatsapp: !!process.env.META_WHATSAPP_ACCESS_TOKEN || !!process.env.TWILIO_ACCOUNT_SID,
      sms: !!process.env.TWILIO_ACCOUNT_SID,
      email: !!process.env.RESEND_API_KEY || !!process.env.SMTP_HOST,
    },
  };
  
  const allHealthy = checks.database && 
                     checks.ai_engine && 
                     Object.values(checks.integrations).every(v => v);
  
  return {
    status: allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    checks,
    metrics: {
      uptime: process.uptime(),
      memory_usage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
      cpu_usage: 0, // TODO: Add actual CPU usage
    },
  };
}
