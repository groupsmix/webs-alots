/**
 * CDSS severity classification and alert prioritisation.
 *
 * Aggregates results from all CDSS checks (drug interactions, allergies,
 * dose ranges) and produces a unified priority-sorted alert list for the
 * prescribing physician.
 */

import type { AllergyCheckResult } from "./allergy-checker";
import type { DoseCheckResult } from "./dose-checker";
import type { InteractionAlert, InteractionSeverity } from "./types";

export interface CDSSAlert {
  id: string;
  category: "drug-interaction" | "allergy" | "dose";
  severity: InteractionSeverity;
  title: string;
  description: string;
  recommendation: string;
  requiresOverride: boolean;
}

export interface CDSSCheckSummary {
  alerts: CDSSAlert[];
  blockPrescription: boolean;
  requiresOverrideJustification: boolean;
  totalAlerts: number;
  criticalCount: number;
  majorCount: number;
}

const SEVERITY_ORDER: Record<InteractionSeverity, number> = {
  critical: 0,
  major: 1,
  minor: 2,
};

let alertIdCounter = 0;

function nextAlertId(): string {
  alertIdCounter += 1;
  return `cdss-${Date.now()}-${alertIdCounter}`;
}

/**
 * Aggregate and classify all CDSS check results into a unified summary.
 */
export function classifyAlerts(
  interactionAlerts?: InteractionAlert[],
  allergyResult?: AllergyCheckResult,
  doseResults?: DoseCheckResult[],
): CDSSCheckSummary {
  const alerts: CDSSAlert[] = [];

  // Process drug interactions
  if (interactionAlerts) {
    for (const ix of interactionAlerts) {
      alerts.push({
        id: nextAlertId(),
        category: "drug-interaction",
        severity: ix.severity,
        title: `${ix.pair[0]} ↔ ${ix.pair[1]}`,
        description: ix.message,
        recommendation: ix.recommendation,
        requiresOverride: ix.severity === "critical" || ix.severity === "major",
      });
    }
  }

  // Process allergy alerts
  if (allergyResult) {
    for (const alert of allergyResult.alerts) {
      alerts.push({
        id: nextAlertId(),
        category: "allergy",
        severity: alert.severity,
        title: `Allergie: ${alert.drug} vs ${alert.allergen}`,
        description: alert.description,
        recommendation: alert.recommendation,
        requiresOverride: alert.severity === "critical" || alert.severity === "major",
      });
    }
  }

  // Process dose alerts
  if (doseResults) {
    for (const result of doseResults) {
      for (const alert of result.alerts) {
        alerts.push({
          id: nextAlertId(),
          category: "dose",
          severity: alert.severity,
          title: `${alert.drug}: ${alert.issue}`,
          description: alert.description,
          recommendation: alert.recommendation,
          requiresOverride: alert.severity === "critical",
        });
      }
    }
  }

  // Sort by severity (critical first)
  alerts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const majorCount = alerts.filter((a) => a.severity === "major").length;

  return {
    alerts,
    blockPrescription: criticalCount > 0,
    requiresOverrideJustification: criticalCount > 0 || majorCount > 0,
    totalAlerts: alerts.length,
    criticalCount,
    majorCount,
  };
}
