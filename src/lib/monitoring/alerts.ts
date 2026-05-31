/**
 * Automated alerting engine.
 *
 * Defines alert thresholds, deduplication, and escalation rules
 * for critical metrics like API latency, error rates, and DB health.
 */

import { logger } from "@/lib/logger";

// ─── Types ───────────────────────────────────────────────────────────────────

export type AlertSeverity = "critical" | "warning" | "info";
export type AlertStatus = "firing" | "acknowledged" | "resolved";

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  condition: "gt" | "lt" | "gte" | "lte" | "eq";
  threshold: number;
  severity: AlertSeverity;
  windowSeconds: number;
  cooldownSeconds: number;
  description: string;
}

export interface Alert {
  id: string;
  ruleId: string;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  description: string;
  currentValue: number;
  threshold: number;
  firedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  dedupKey: string;
}

export interface AlertEvaluation {
  rule: AlertRule;
  shouldFire: boolean;
  currentValue: number;
}

// ─── Default Alert Rules ─────────────────────────────────────────────────────

export const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    id: "api-latency-p95",
    name: "API Latency P95 High",
    metric: "api.latency.p95",
    condition: "gt",
    threshold: 2000,
    severity: "warning",
    windowSeconds: 300,
    cooldownSeconds: 600,
    description: "P95 API latency exceeds 2 seconds over 5-minute window",
  },
  {
    id: "api-error-rate",
    name: "API Error Rate High",
    metric: "api.error_rate",
    condition: "gt",
    threshold: 0.05,
    severity: "critical",
    windowSeconds: 60,
    cooldownSeconds: 300,
    description: "Error rate exceeds 5% over 1-minute window",
  },
  {
    id: "db-connection-pool",
    name: "DB Connection Pool Exhaustion",
    metric: "db.connections.used_ratio",
    condition: "gt",
    threshold: 0.85,
    severity: "critical",
    windowSeconds: 60,
    cooldownSeconds: 120,
    description: "Database connection pool usage exceeds 85%",
  },
  {
    id: "memory-usage",
    name: "High Memory Usage",
    metric: "system.memory.used_ratio",
    condition: "gt",
    threshold: 0.9,
    severity: "warning",
    windowSeconds: 120,
    cooldownSeconds: 300,
    description: "System memory usage exceeds 90%",
  },
  {
    id: "queue-depth",
    name: "Notification Queue Depth",
    metric: "queue.notification.depth",
    condition: "gt",
    threshold: 1000,
    severity: "warning",
    windowSeconds: 300,
    cooldownSeconds: 600,
    description: "Notification queue depth exceeds 1000 messages",
  },
  {
    id: "auth-failure-spike",
    name: "Authentication Failure Spike",
    metric: "auth.failures.count",
    condition: "gt",
    threshold: 50,
    severity: "critical",
    windowSeconds: 60,
    cooldownSeconds: 300,
    description: "More than 50 auth failures in 1 minute (possible brute force)",
  },
];

// ─── Implementation ──────────────────────────────────────────────────────────

export function evaluateAlertRule(rule: AlertRule, currentValue: number): AlertEvaluation {
  let shouldFire = false;

  switch (rule.condition) {
    case "gt":
      shouldFire = currentValue > rule.threshold;
      break;
    case "lt":
      shouldFire = currentValue < rule.threshold;
      break;
    case "gte":
      shouldFire = currentValue >= rule.threshold;
      break;
    case "lte":
      shouldFire = currentValue <= rule.threshold;
      break;
    case "eq":
      shouldFire = currentValue === rule.threshold;
      break;
  }

  return { rule, shouldFire, currentValue };
}

export function createAlert(evaluation: AlertEvaluation): Alert {
  const { rule, currentValue } = evaluation;

  logger.warn("Alert firing", {
    ruleId: rule.id,
    severity: rule.severity,
    currentValue,
    threshold: rule.threshold,
  });

  return {
    id: crypto.randomUUID(),
    ruleId: rule.id,
    severity: rule.severity,
    status: "firing",
    title: rule.name,
    description: rule.description,
    currentValue,
    threshold: rule.threshold,
    firedAt: new Date().toISOString(),
    acknowledgedAt: null,
    resolvedAt: null,
    dedupKey: `${rule.id}:${Math.floor(Date.now() / (rule.cooldownSeconds * 1000))}`,
  };
}

export function shouldDeduplicate(existingAlerts: Alert[], newAlert: Alert): boolean {
  return existingAlerts.some((a) => a.dedupKey === newAlert.dedupKey && a.status === "firing");
}

export function acknowledgeAlert(alert: Alert): Alert {
  return {
    ...alert,
    status: "acknowledged",
    acknowledgedAt: new Date().toISOString(),
  };
}

export function resolveAlert(alert: Alert): Alert {
  return {
    ...alert,
    status: "resolved",
    resolvedAt: new Date().toISOString(),
  };
}
