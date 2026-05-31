/**
 * Dose range checker.
 *
 * Validates prescribed doses against reference ranges considering:
 * - Patient age (pediatric vs adult vs elderly)
 * - Weight-based dosing (mg/kg)
 * - Renal function adjustment (CrCl-based)
 * - Maximum daily dose limits
 */

import { logger } from "@/lib/logger";
import type { InteractionSeverity } from "./types";

export interface DoseCheckInput {
  drugName: string;
  doseAmount: number;
  doseUnit: "mg" | "g" | "mcg" | "ml" | "IU";
  frequency: "od" | "bid" | "tid" | "qid" | "stat" | "prn";
  route: "oral" | "iv" | "im" | "sc" | "topical" | "inhaled";
}

export interface PatientFactors {
  ageYears: number;
  weightKg?: number;
  creatinineClearanceMl?: number;
  isPregnant?: boolean;
}

export interface DoseAlert {
  drug: string;
  severity: InteractionSeverity;
  issue: "over-dose" | "under-dose" | "renal-adjustment" | "age-warning" | "pregnancy-risk";
  description: string;
  recommendation: string;
  referenceRange: string;
}

export interface DoseCheckResult {
  alerts: DoseAlert[];
  hasOverdose: boolean;
  checkedAt: string;
}

/**
 * Frequency multipliers (doses per day).
 */
const FREQ_MULTIPLIER: Record<DoseCheckInput["frequency"], number> = {
  od: 1,
  bid: 2,
  tid: 3,
  qid: 4,
  stat: 1,
  prn: 3, // assume max PRN usage
};

interface DrugDoseReference {
  name: string;
  adultMaxSingleDoseMg: number;
  adultMaxDailyDoseMg: number;
  pediatricMaxMgPerKgPerDay?: number;
  elderlyReduction?: number; // fractional reduction (e.g., 0.25 = reduce by 25%)
  renalAdjustment?: { crclThreshold: number; reduction: number }[];
  pregnancyCategory?: "A" | "B" | "C" | "D" | "X";
}

/**
 * Reference dose ranges for common medications.
 */
const DOSE_REFERENCES: DrugDoseReference[] = [
  {
    name: "paracetamol",
    adultMaxSingleDoseMg: 1000,
    adultMaxDailyDoseMg: 4000,
    pediatricMaxMgPerKgPerDay: 60,
    elderlyReduction: 0.25,
    renalAdjustment: [{ crclThreshold: 30, reduction: 0.5 }],
  },
  {
    name: "ibuprofen",
    adultMaxSingleDoseMg: 800,
    adultMaxDailyDoseMg: 2400,
    pediatricMaxMgPerKgPerDay: 40,
    elderlyReduction: 0.5,
    renalAdjustment: [
      { crclThreshold: 30, reduction: 0.5 },
      { crclThreshold: 15, reduction: 1.0 }, // avoid
    ],
    pregnancyCategory: "D",
  },
  {
    name: "amoxicillin",
    adultMaxSingleDoseMg: 1000,
    adultMaxDailyDoseMg: 3000,
    pediatricMaxMgPerKgPerDay: 100,
    renalAdjustment: [
      { crclThreshold: 30, reduction: 0.33 },
      { crclThreshold: 10, reduction: 0.5 },
    ],
  },
  {
    name: "metformin",
    adultMaxSingleDoseMg: 1000,
    adultMaxDailyDoseMg: 2550,
    renalAdjustment: [
      { crclThreshold: 45, reduction: 0.5 },
      { crclThreshold: 30, reduction: 1.0 }, // contraindicated
    ],
    pregnancyCategory: "B",
  },
  {
    name: "omeprazole",
    adultMaxSingleDoseMg: 40,
    adultMaxDailyDoseMg: 80,
  },
  {
    name: "amlodipine",
    adultMaxSingleDoseMg: 10,
    adultMaxDailyDoseMg: 10,
    elderlyReduction: 0.5,
  },
  {
    name: "atorvastatin",
    adultMaxSingleDoseMg: 80,
    adultMaxDailyDoseMg: 80,
  },
  {
    name: "ciprofloxacin",
    adultMaxSingleDoseMg: 750,
    adultMaxDailyDoseMg: 1500,
    renalAdjustment: [{ crclThreshold: 30, reduction: 0.5 }],
    pregnancyCategory: "C",
  },
  {
    name: "diclofenac",
    adultMaxSingleDoseMg: 75,
    adultMaxDailyDoseMg: 150,
    elderlyReduction: 0.33,
    pregnancyCategory: "D",
  },
  {
    name: "prednisolone",
    adultMaxSingleDoseMg: 60,
    adultMaxDailyDoseMg: 60,
    pediatricMaxMgPerKgPerDay: 2,
  },
];

function normalizeDrugName(name: string): string {
  const aliases: Record<string, string> = {
    doliprane: "paracetamol",
    dafalgan: "paracetamol",
    efferalgan: "paracetamol",
    glucophage: "metformin",
    augmentin: "amoxicillin",
    tahor: "atorvastatin",
    mopral: "omeprazole",
    voltarene: "diclofenac",
  };
  const lower = name.toLowerCase().trim();
  return aliases[lower] ?? lower;
}

function convertToMg(amount: number, unit: DoseCheckInput["doseUnit"]): number {
  switch (unit) {
    case "g":
      return amount * 1000;
    case "mcg":
      return amount / 1000;
    case "mg":
    default:
      return amount;
  }
}

/**
 * Check a prescribed dose against reference ranges.
 */
export function checkDose(input: DoseCheckInput, patient: PatientFactors): DoseCheckResult {
  const alerts: DoseAlert[] = [];
  const normalized = normalizeDrugName(input.drugName);
  const ref = DOSE_REFERENCES.find((r) => r.name === normalized);

  if (!ref) {
    return { alerts: [], hasOverdose: false, checkedAt: new Date().toISOString() };
  }

  const doseMg = convertToMg(input.doseAmount, input.doseUnit);
  const dailyDoseMg = doseMg * FREQ_MULTIPLIER[input.frequency];

  // Single dose check
  let maxSingle = ref.adultMaxSingleDoseMg;
  if (patient.ageYears >= 65 && ref.elderlyReduction) {
    maxSingle = maxSingle * (1 - ref.elderlyReduction);
  }

  if (doseMg > maxSingle) {
    alerts.push({
      drug: input.drugName,
      severity: doseMg > maxSingle * 1.5 ? "critical" : "major",
      issue: "over-dose",
      description: `Single dose ${doseMg}mg exceeds maximum ${maxSingle}mg${patient.ageYears >= 65 ? " (elderly-adjusted)" : ""}`,
      recommendation: `Reduce single dose to ≤${maxSingle}mg`,
      referenceRange: `Max single dose: ${maxSingle}mg`,
    });
  }

  // Daily dose check
  let maxDaily = ref.adultMaxDailyDoseMg;
  if (patient.ageYears >= 65 && ref.elderlyReduction) {
    maxDaily = maxDaily * (1 - ref.elderlyReduction);
  }

  if (dailyDoseMg > maxDaily) {
    alerts.push({
      drug: input.drugName,
      severity: dailyDoseMg > maxDaily * 1.5 ? "critical" : "major",
      issue: "over-dose",
      description: `Daily dose ${dailyDoseMg}mg exceeds maximum ${maxDaily}mg/day`,
      recommendation: `Reduce to ≤${maxDaily}mg/day (currently ${input.frequency})`,
      referenceRange: `Max daily: ${maxDaily}mg/day`,
    });
  }

  // Pediatric weight-based check
  if (patient.ageYears < 18 && patient.weightKg && ref.pediatricMaxMgPerKgPerDay) {
    const maxPediatricDaily = ref.pediatricMaxMgPerKgPerDay * patient.weightKg;
    if (dailyDoseMg > maxPediatricDaily) {
      alerts.push({
        drug: input.drugName,
        severity: "major",
        issue: "over-dose",
        description: `Pediatric dose ${dailyDoseMg}mg/day exceeds ${ref.pediatricMaxMgPerKgPerDay}mg/kg/day (max ${maxPediatricDaily.toFixed(0)}mg for ${patient.weightKg}kg)`,
        recommendation: `Reduce to ≤${ref.pediatricMaxMgPerKgPerDay}mg/kg/day`,
        referenceRange: `${ref.pediatricMaxMgPerKgPerDay}mg/kg/day × ${patient.weightKg}kg = ${maxPediatricDaily.toFixed(0)}mg/day`,
      });
    }
  }

  // Renal adjustment
  if (patient.creatinineClearanceMl && ref.renalAdjustment) {
    for (const adj of ref.renalAdjustment) {
      if (patient.creatinineClearanceMl < adj.crclThreshold) {
        if (adj.reduction >= 1.0) {
          alerts.push({
            drug: input.drugName,
            severity: "critical",
            issue: "renal-adjustment",
            description: `Contraindicated with CrCl <${adj.crclThreshold} ml/min (patient: ${patient.creatinineClearanceMl})`,
            recommendation: "Use alternative medication",
            referenceRange: `Contraindicated below CrCl ${adj.crclThreshold}`,
          });
        } else {
          const adjustedMax = maxDaily * (1 - adj.reduction);
          if (dailyDoseMg > adjustedMax) {
            alerts.push({
              drug: input.drugName,
              severity: "major",
              issue: "renal-adjustment",
              description: `Dose requires ${(adj.reduction * 100).toFixed(0)}% reduction for CrCl <${adj.crclThreshold} (patient: ${patient.creatinineClearanceMl})`,
              recommendation: `Reduce to ≤${adjustedMax.toFixed(0)}mg/day`,
              referenceRange: `Max with renal adjustment: ${adjustedMax.toFixed(0)}mg/day`,
            });
          }
        }
        break; // Only apply most restrictive threshold
      }
    }
  }

  // Pregnancy check
  if (patient.isPregnant && ref.pregnancyCategory) {
    if (ref.pregnancyCategory === "X") {
      alerts.push({
        drug: input.drugName,
        severity: "critical",
        issue: "pregnancy-risk",
        description: `Category X: Contraindicated in pregnancy`,
        recommendation: "CONTRAINDICATED. Use safe alternative.",
        referenceRange: "FDA Pregnancy Category X",
      });
    } else if (ref.pregnancyCategory === "D") {
      alerts.push({
        drug: input.drugName,
        severity: "major",
        issue: "pregnancy-risk",
        description: `Category D: Evidence of fetal risk`,
        recommendation: "Avoid unless benefit clearly outweighs risk. Document justification.",
        referenceRange: "FDA Pregnancy Category D",
      });
    }
  }

  const hasOverdose = alerts.some((a) => a.issue === "over-dose" && a.severity === "critical");

  if (alerts.length > 0) {
    logger.warn("CDSS: dose alert", {
      drug: normalized,
      alertCount: alerts.length,
      hasOverdose,
    });
  }

  return {
    alerts,
    hasOverdose,
    checkedAt: new Date().toISOString(),
  };
}
