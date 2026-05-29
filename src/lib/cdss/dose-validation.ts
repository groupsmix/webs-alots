/**
 * CDSS Dose Validation — Weight/Age/Renal Adjustments
 *
 * Adapted from ECC healthcare-cdss-patterns skill.
 * SAFETY: if rules require weight but weight is missing, BLOCK (not pass).
 */

import type { DoseRoute, DoseRule, DoseValidationResult } from "./types";

// ── Dose Rules Database ──

const DOSE_RULES: DoseRule[] = [
  {
    drug: "paracétamol",
    route: "oral",
    weightBased: false,
    minPerKg: 0,
    maxPerKg: 0,
    ageAdjusted: true,
    getAgeAdjustedMax: (age: number) => (age < 12 ? 2000 : 4000),
    renalAdjusted: false,
    getRenalAdjustedMax: () => 4000,
    typicalMin: 500,
    typicalMax: 1000,
    absoluteMax: 4000,
    unit: "mg",
  },
  {
    drug: "gentamicine",
    route: "iv",
    weightBased: true,
    minPerKg: 3,
    maxPerKg: 7,
    ageAdjusted: false,
    getAgeAdjustedMax: () => 500,
    renalAdjusted: true,
    getRenalAdjustedMax: (egfr: number) => {
      if (egfr < 30) return 80;
      if (egfr < 60) return 200;
      return 500;
    },
    typicalMin: 80,
    typicalMax: 400,
    absoluteMax: 500,
    unit: "mg",
  },
  {
    drug: "amoxicilline",
    route: "oral",
    weightBased: false,
    minPerKg: 0,
    maxPerKg: 0,
    ageAdjusted: true,
    getAgeAdjustedMax: (age: number) => (age < 12 ? 1500 : 3000),
    renalAdjusted: true,
    getRenalAdjustedMax: (egfr: number) => {
      if (egfr < 30) return 1000;
      return 3000;
    },
    typicalMin: 250,
    typicalMax: 1000,
    absoluteMax: 3000,
    unit: "mg",
  },
  {
    drug: "metformine",
    route: "oral",
    weightBased: false,
    minPerKg: 0,
    maxPerKg: 0,
    ageAdjusted: false,
    getAgeAdjustedMax: () => 3000,
    renalAdjusted: true,
    getRenalAdjustedMax: (egfr: number) => {
      if (egfr < 30) return 0; // Contre-indiqué
      if (egfr < 45) return 1000;
      if (egfr < 60) return 2000;
      return 3000;
    },
    typicalMin: 500,
    typicalMax: 2000,
    absoluteMax: 3000,
    unit: "mg",
  },
  {
    drug: "ciprofloxacine",
    route: "oral",
    weightBased: false,
    minPerKg: 0,
    maxPerKg: 0,
    ageAdjusted: false,
    getAgeAdjustedMax: () => 1500,
    renalAdjusted: true,
    getRenalAdjustedMax: (egfr: number) => {
      if (egfr < 30) return 500;
      return 1500;
    },
    typicalMin: 250,
    typicalMax: 750,
    absoluteMax: 1500,
    unit: "mg",
  },
];

function normalize(name: string): string {
  return name.toLowerCase().trim();
}

function getDoseRules(drug: string, route: DoseRoute): DoseRule | undefined {
  const normalizedDrug = normalize(drug);
  return DOSE_RULES.find((r) => normalize(r.drug) === normalizedDrug && r.route === route);
}

/**
 * Validate a prescribed dose against weight-based, age-adjusted, and renal-adjusted rules.
 *
 * SAFETY: if rules require weight but weight is missing, returns invalid (BLOCK, not pass).
 */
export function validateDose(
  drug: string,
  dose: number,
  route: DoseRoute,
  patientWeight?: number,
  patientAge?: number,
  renalFunction?: number,
): DoseValidationResult {
  const rules = getDoseRules(drug, route);
  if (!rules) {
    return {
      valid: true,
      message: "Aucune règle de validation disponible",
      suggestedRange: null,
      factors: [],
    };
  }

  const factors: string[] = [];

  // SAFETY: if rules require weight but weight missing, BLOCK
  if (rules.weightBased) {
    if (!patientWeight || patientWeight <= 0) {
      return {
        valid: false,
        message: `Poids requis pour ${drug} (médicament en mg/kg)`,
        suggestedRange: null,
        factors: ["weight_missing"],
      };
    }
    factors.push("weight");
    const maxDose = rules.maxPerKg * patientWeight;
    if (dose > maxDose) {
      return {
        valid: false,
        message: `La dose dépasse le maximum pour ${patientWeight}kg`,
        suggestedRange: {
          min: rules.minPerKg * patientWeight,
          max: maxDose,
          unit: rules.unit,
        },
        factors,
      };
    }
  }

  // Age-based adjustment
  if (rules.ageAdjusted && patientAge !== undefined) {
    factors.push("age");
    const ageMax = rules.getAgeAdjustedMax(patientAge);
    if (dose > ageMax) {
      return {
        valid: false,
        message: `Dépasse le maximum ajusté pour l'âge (${patientAge} ans)`,
        suggestedRange: {
          min: rules.typicalMin,
          max: ageMax,
          unit: rules.unit,
        },
        factors,
      };
    }
  }

  // Renal adjustment
  if (rules.renalAdjusted && renalFunction !== undefined) {
    factors.push("renal");
    const renalMax = rules.getRenalAdjustedMax(renalFunction);
    if (renalMax === 0) {
      return {
        valid: false,
        message: `${drug} est contre-indiqué avec un DFG de ${renalFunction}`,
        suggestedRange: null,
        factors,
      };
    }
    if (dose > renalMax) {
      return {
        valid: false,
        message: `Dépasse le maximum rénal ajusté pour DFG ${renalFunction}`,
        suggestedRange: {
          min: rules.typicalMin,
          max: renalMax,
          unit: rules.unit,
        },
        factors,
      };
    }
  }

  // Absolute max
  if (dose > rules.absoluteMax) {
    return {
      valid: false,
      message: `Dépasse le maximum absolu de ${rules.absoluteMax}${rules.unit}`,
      suggestedRange: {
        min: rules.typicalMin,
        max: rules.absoluteMax,
        unit: rules.unit,
      },
      factors: [...factors, "absolute_max"],
    };
  }

  return {
    valid: true,
    message: "Dans les limites acceptables",
    suggestedRange: {
      min: rules.typicalMin,
      max: rules.typicalMax,
      unit: rules.unit,
    },
    factors,
  };
}
