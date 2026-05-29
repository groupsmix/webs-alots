/**
 * CDSS (Clinical Decision Support System) type definitions.
 *
 * Adapted from ECC healthcare-cdss-patterns skill.
 * Pure-function library — zero side effects, fully testable.
 */

// ── Drug Interaction Types ──

export type InteractionSeverity = "critical" | "major" | "minor";

export interface DrugInteractionPair {
  drugA: string;
  drugB: string;
  severity: InteractionSeverity;
  mechanism: string;
  clinicalEffect: string;
  recommendation: string;
}

export interface InteractionAlert {
  severity: InteractionSeverity;
  pair: [string, string];
  message: string;
  recommendation: string;
}

// ── Dose Validation Types ──

export type DoseRoute = "oral" | "iv" | "im" | "sc" | "topical";

export interface DoseValidationResult {
  valid: boolean;
  message: string;
  suggestedRange: { min: number; max: number; unit: string } | null;
  factors: string[];
}

export interface DoseRule {
  drug: string;
  route: DoseRoute;
  weightBased: boolean;
  minPerKg: number;
  maxPerKg: number;
  ageAdjusted: boolean;
  getAgeAdjustedMax: (age: number) => number;
  renalAdjusted: boolean;
  getRenalAdjustedMax: (egfr: number) => number;
  typicalMin: number;
  typicalMax: number;
  absoluteMax: number;
  unit: string;
}

// ── NEWS2 Types ──

export interface NEWS2Input {
  respiratoryRate: number;
  oxygenSaturation: number;
  supplementalOxygen: boolean;
  temperature: number;
  systolicBP: number;
  heartRate: number;
  consciousness: "alert" | "voice" | "pain" | "unresponsive";
}

export type NEWS2Risk = "low" | "low-medium" | "medium" | "high";

export interface NEWS2Result {
  total: number;
  risk: NEWS2Risk;
  components: Record<string, number>;
  escalation: string;
}

// ── Alert UI Behavior ──

export type AlertUIBehavior = "block" | "warn" | "info";

export interface ClinicalAlertDisplay {
  severity: InteractionSeverity;
  uiBehavior: AlertUIBehavior;
  color: string;
  actionRequired: string;
}

export const ALERT_DISPLAY_MAP: Record<InteractionSeverity, ClinicalAlertDisplay> = {
  critical: {
    severity: "critical",
    uiBehavior: "block",
    color: "red",
    actionRequired: "Doit documenter la raison du dépassement pour continuer",
  },
  major: {
    severity: "major",
    uiBehavior: "warn",
    color: "orange",
    actionRequired: "Doit confirmer avant de continuer",
  },
  minor: {
    severity: "minor",
    uiBehavior: "info",
    color: "yellow",
    actionRequired: "Information uniquement, aucune action requise",
  },
};
