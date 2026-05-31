/**
 * Drug-allergy interaction checker.
 *
 * Cross-references prescribed drugs against patient's documented allergies
 * to detect potentially dangerous prescriptions. Handles both exact drug
 * allergies and drug-class cross-reactivity (e.g., penicillin allergy →
 * amoxicillin contraindicated).
 */

import { logger } from "@/lib/logger";
import type { InteractionSeverity } from "./types";

export interface PatientAllergy {
  allergen: string;
  severity: "mild" | "moderate" | "severe" | "anaphylaxis";
  notes?: string;
}

export interface AllergyAlert {
  drug: string;
  allergen: string;
  severity: InteractionSeverity;
  crossReactivity: boolean;
  description: string;
  recommendation: string;
}

export interface AllergyCheckResult {
  alerts: AllergyAlert[];
  hasContraindication: boolean;
  checkedAt: string;
}

/**
 * Drug class membership — maps individual drugs to their pharmacological classes.
 * Used for cross-reactivity detection.
 */
const DRUG_CLASSES: Record<string, string[]> = {
  penicillin: [
    "amoxicillin",
    "ampicillin",
    "piperacillin",
    "flucloxacillin",
    "augmentin",
    "amoxil",
  ],
  cephalosporin: ["cefazolin", "ceftriaxone", "cefuroxime", "cephalexin", "cefixime"],
  sulfonamide: ["sulfamethoxazole", "trimethoprim-sulfamethoxazole", "cotrimoxazole", "bactrim"],
  nsaid: [
    "ibuprofen",
    "diclofenac",
    "naproxen",
    "ketoprofen",
    "indomethacin",
    "celecoxib",
    "aspirin",
  ],
  quinolone: ["ciprofloxacin", "levofloxacin", "moxifloxacin", "ofloxacin", "norfloxacin"],
  macrolide: ["azithromycin", "clarithromycin", "erythromycin", "roxithromycin"],
  statin: ["atorvastatin", "simvastatin", "rosuvastatin", "pravastatin", "fluvastatin"],
  "ace-inhibitor": ["enalapril", "lisinopril", "ramipril", "captopril", "perindopril"],
};

/**
 * Cross-reactivity rates between drug classes.
 * Source: UpToDate cross-reactivity guidelines.
 */
const CROSS_REACTIVITY: Record<string, { relatedClass: string; rate: string }[]> = {
  penicillin: [{ relatedClass: "cephalosporin", rate: "1-2% (historically 10%)" }],
  sulfonamide: [{ relatedClass: "thiazide", rate: "Low but documented" }],
};

function normalizeName(name: string): string {
  return name.toLowerCase().trim();
}

function getDrugClasses(drugName: string): string[] {
  const normalized = normalizeName(drugName);
  const classes: string[] = [];
  for (const [className, members] of Object.entries(DRUG_CLASSES)) {
    if (members.includes(normalized) || className === normalized) {
      classes.push(className);
    }
  }
  return classes;
}

/**
 * Check prescribed drugs against patient allergies.
 */
export function checkAllergies(
  drugNames: string[],
  allergies: PatientAllergy[],
): AllergyCheckResult {
  const alerts: AllergyAlert[] = [];

  for (const drug of drugNames) {
    const normalizedDrug = normalizeName(drug);
    const drugClasses = getDrugClasses(normalizedDrug);

    for (const allergy of allergies) {
      const normalizedAllergen = normalizeName(allergy.allergen);

      // Direct match
      if (normalizedDrug === normalizedAllergen) {
        alerts.push({
          drug,
          allergen: allergy.allergen,
          severity: allergy.severity === "anaphylaxis" ? "critical" : "major",
          crossReactivity: false,
          description: `Patient has documented ${allergy.severity} allergy to ${allergy.allergen}`,
          recommendation:
            allergy.severity === "anaphylaxis"
              ? "CONTRAINDICATED. Use alternative drug class."
              : "Avoid unless no alternative exists. Document override justification.",
        });
        continue;
      }

      // Class-level match (drug belongs to a class the patient is allergic to)
      const allergenClasses = getDrugClasses(normalizedAllergen);
      const sharedClasses = drugClasses.filter((c) => allergenClasses.includes(c));
      if (sharedClasses.length > 0) {
        alerts.push({
          drug,
          allergen: allergy.allergen,
          severity: allergy.severity === "anaphylaxis" ? "critical" : "major",
          crossReactivity: true,
          description: `${drug} belongs to same class (${sharedClasses.join(", ")}) as allergen ${allergy.allergen}`,
          recommendation: `Cross-reactivity possible. ${allergy.severity === "anaphylaxis" ? "AVOID." : "Use with caution, monitor for reaction."}`,
        });
        continue;
      }

      // Cross-reactivity between related classes
      for (const drugClass of drugClasses) {
        const crossReactivities = CROSS_REACTIVITY[normalizedAllergen] ?? [];
        const crossMatch = crossReactivities.find((cr) => cr.relatedClass === drugClass);
        if (crossMatch) {
          alerts.push({
            drug,
            allergen: allergy.allergen,
            severity: "minor",
            crossReactivity: true,
            description: `Potential cross-reactivity between ${allergy.allergen} allergy and ${drugClass} class (rate: ${crossMatch.rate})`,
            recommendation:
              "Consider alternative. If prescribed, observe for 30 minutes after first dose.",
          });
        }
      }
    }
  }

  const hasContraindication = alerts.some((a) => a.severity === "critical");

  if (alerts.length > 0) {
    logger.warn("CDSS: allergy alert triggered", {
      alertCount: alerts.length,
      hasContraindication,
    });
  }

  return {
    alerts,
    hasContraindication,
    checkedAt: new Date().toISOString(),
  };
}
