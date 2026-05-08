/**
 * Drug Interaction Checker — Local (Fast, No API Call)
 *
 * Checks a list of medications against each other and against patient
 * allergies for drug-drug interactions and allergy conflicts.
 *
 * Returns a structured result with severity-coded alerts.
 */

import {
  checkInteraction,
  checkAllergyConflict,
  type DrugInteraction,
  type InteractionSeverity,
} from "@/lib/drug-interactions-db";

// ── Types ──

export interface InteractionAlert {
  /** Unique key for React rendering */
  id: string;
  /** Type of alert */
  type: "drug-drug" | "allergy";
  /** Severity level */
  severity: InteractionSeverity;
  /** Drug names involved */
  drugs: string[];
  /** Alert title in French */
  title: string;
  /** Description in French */
  description: string;
  /** Clinical recommendation in French */
  recommendation: string;
}

export interface InteractionCheckResult {
  /** Overall safety level (worst severity found) */
  overallSeverity: InteractionSeverity;
  /** All alerts found */
  alerts: InteractionAlert[];
  /** Number of dangerous interactions */
  dangerousCount: number;
  /** Number of caution interactions */
  cautionCount: number;
}

// ── Main Check Function ──

/**
 * Check a list of medications for interactions and allergy conflicts.
 *
 * @param medications - Array of DCI drug names to check
 * @param patientAllergies - Array of known patient allergies
 * @returns Structured result with all alerts
 */
export function checkAllInteractions(
  medications: string[],
  patientAllergies: string[] = [],
): InteractionCheckResult {
  const alerts: InteractionAlert[] = [];
  const seen = new Set<string>();

  // 1. Check drug-drug interactions (all pairs)
  for (let i = 0; i < medications.length; i++) {
    for (let j = i + 1; j < medications.length; j++) {
      const drugA = medications[i];
      const drugB = medications[j];
      const pairKey = [drugA, drugB].sort().join("|");

      if (seen.has(pairKey)) continue;
      seen.add(pairKey);

      const interactions: DrugInteraction[] = checkInteraction(drugA, drugB);
      for (const interaction of interactions) {
        alerts.push({
          id: `dd-${pairKey}-${interaction.severity}`,
          type: "drug-drug",
          severity: interaction.severity,
          drugs: [drugA, drugB],
          title:
            interaction.severity === "dangerous"
              ? `Interaction dangereuse : ${drugA} + ${drugB}`
              : `Précaution : ${drugA} + ${drugB}`,
          description: interaction.description,
          recommendation: interaction.recommendation,
        });
      }
    }
  }

  // 2. Check allergy conflicts
  for (const medication of medications) {
    const conflictingAllergy = checkAllergyConflict(medication, patientAllergies);
    if (conflictingAllergy) {
      alerts.push({
        id: `allergy-${medication}-${conflictingAllergy}`,
        type: "allergy",
        severity: "dangerous",
        drugs: [medication],
        title: `Allergie connue : ${conflictingAllergy}`,
        description: `Le patient est allergique à "${conflictingAllergy}". Le médicament "${medication}" est contre-indiqué.`,
        recommendation: `Ne PAS prescrire ${medication}. Choisir une alternative thérapeutique.`,
      });
    }
  }

  // Sort: dangerous first, then caution
  alerts.sort((a, b) => {
    const order: Record<InteractionSeverity, number> = { dangerous: 0, caution: 1, safe: 2 };
    return order[a.severity] - order[b.severity];
  });

  const dangerousCount = alerts.filter((a) => a.severity === "dangerous").length;
  const cautionCount = alerts.filter((a) => a.severity === "caution").length;

  let overallSeverity: InteractionSeverity = "safe";
  if (dangerousCount > 0) overallSeverity = "dangerous";
  else if (cautionCount > 0) overallSeverity = "caution";

  return { overallSeverity, alerts, dangerousCount, cautionCount };
}
