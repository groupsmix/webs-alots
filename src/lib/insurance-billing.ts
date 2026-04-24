/**
 * Insurance Billing — Unified Tariff Lookup
 *
 * Provides a single entry point to look up tariffs by act code + insurance type,
 * calculate coverage for a list of medical acts, and produce insurance-ready
 * invoice line items with automatic coverage breakdown.
 */

import {
  CNSS_TARIFFS,
  getCNSSTariffByCode,
  searchCNSSTariffs,
} from "./cnss-tariffs";
import {
  CNOPS_TARIFFS,
  getCNOPSTariffByCode,
  searchCNOPSTariffs,
} from "./cnops-tariffs";
import type { MoroccanInsuranceType, PatientInsurance } from "./morocco";

// ---- Types ----

/** Supported insurance types for tariff lookup */
export type InsuranceTariffType = "cnss" | "cnops";

/** Unified tariff entry (works for both CNSS and CNOPS) */
export interface TariffEntry {
  code: string;
  category: string;
  coefficient: number;
  descriptionFr: string;
  descriptionAr: string;
  tarifReference: number;
  reimbursementRate: number;
  reimbursementAmount: number;
  patientShare: number;
  requiresPriorApproval: boolean;
  specialty: string;
  /** Which insurance table this came from */
  source: InsuranceTariffType;
}

/** A billable medical act on an invoice */
export interface BillableAct {
  /** Tariff act code */
  code: string;
  /** Quantity (default: 1) */
  quantity: number;
  /** Override price (if doctor charges more than TNR) */
  overridePrice?: number;
  /** Description override */
  description?: string;
}

/** Result of calculating coverage for a single act */
export interface ActCoverageResult {
  code: string;
  description: string;
  quantity: number;
  /** Price the doctor actually charges */
  chargedPrice: number;
  /** Official tarif de référence */
  tarifReference: number;
  /** Insurance reimbursement rate */
  reimbursementRate: number;
  /** Amount reimbursed (based on TNR, not charged price) */
  reimbursementAmount: number;
  /** Amount patient pays */
  patientShare: number;
  /** Dépassement d'honoraires (amount above TNR) */
  depassement: number;
  /** Whether prior approval is needed */
  requiresPriorApproval: boolean;
  /** Total for this line (chargedPrice * quantity) */
  lineTotal: number;
  /** Total reimbursed for this line */
  lineReimbursement: number;
  /** Total patient pays for this line */
  linePatientShare: number;
}

/** Full coverage calculation result */
export interface CoverageCalculation {
  /** Insurance type used */
  insuranceType: InsuranceTariffType;
  /** Individual act breakdowns */
  acts: ActCoverageResult[];
  /** Sum of all line totals (what doctor charges) */
  totalCharged: number;
  /** Sum of all tarif de référence amounts */
  totalTarifReference: number;
  /** Total reimbursed by insurance */
  totalReimbursement: number;
  /** Total patient pays (including dépassements) */
  totalPatientShare: number;
  /** Total dépassements d'honoraires */
  totalDepassement: number;
  /** Acts requiring prior approval */
  actsRequiringApproval: string[];
  /** Mutuelle coverage (if applicable) */
  mutuelleCoverage: number;
  /** Final reste à charge after mutuelle */
  finalResteACharge: number;
}

// ---- Tariff Lookup ----

/**
 * Look up a tariff by act code and insurance type.
 * Returns the unified TariffEntry or undefined if not found.
 */
export function getTariffByCode(
  code: string,
  insuranceType: InsuranceTariffType,
): TariffEntry | undefined {
  if (insuranceType === "cnss") {
    const entry = getCNSSTariffByCode(code);
    if (!entry) return undefined;
    return { ...entry, source: "cnss" };
  }
  const entry = getCNOPSTariffByCode(code);
  if (!entry) return undefined;
  return { ...entry, source: "cnops" };
}

/**
 * Search tariffs across both CNSS and CNOPS tables.
 * Returns results from the specified insurance type, or both if not specified.
 */
export function searchTariffs(
  query: string,
  insuranceType?: InsuranceTariffType,
): TariffEntry[] {
  const results: TariffEntry[] = [];

  if (!insuranceType || insuranceType === "cnss") {
    for (const entry of searchCNSSTariffs(query)) {
      results.push({ ...entry, source: "cnss" });
    }
  }

  if (!insuranceType || insuranceType === "cnops") {
    for (const entry of searchCNOPSTariffs(query)) {
      results.push({ ...entry, source: "cnops" });
    }
  }

  return results;
}

/**
 * Get all tariffs for a given insurance type.
 */
export function getAllTariffs(insuranceType: InsuranceTariffType): TariffEntry[] {
  const source = insuranceType === "cnss" ? CNSS_TARIFFS : CNOPS_TARIFFS;
  return source.map((entry) => ({ ...entry, source: insuranceType }));
}

/**
 * Get tariffs by category for a given insurance type.
 */
export function getTariffsByCategory(
  category: string,
  insuranceType: InsuranceTariffType,
): TariffEntry[] {
  const source = insuranceType === "cnss" ? CNSS_TARIFFS : CNOPS_TARIFFS;
  return source
    .filter((t) => t.category === category)
    .map((entry) => ({ ...entry, source: insuranceType }));
}

/**
 * Get tariffs by specialty for a given insurance type.
 */
export function getTariffsBySpecialty(
  specialty: string,
  insuranceType: InsuranceTariffType,
): TariffEntry[] {
  const source = insuranceType === "cnss" ? CNSS_TARIFFS : CNOPS_TARIFFS;
  return source
    .filter((t) => t.specialty === specialty)
    .map((entry) => ({ ...entry, source: insuranceType }));
}

// ---- Coverage Calculation ----

/**
 * Calculate insurance coverage for a list of billable acts.
 *
 * Handles:
 * - Tariff lookup per act code
 * - Reimbursement based on TNR (not the doctor's charged price)
 * - Dépassement d'honoraires (when doctor charges above TNR)
 * - Mutuelle complementary coverage
 * - Final reste à charge calculation
 *
 * @param acts - List of billable medical acts
 * @param insuranceType - CNSS or CNOPS
 * @param patientInsurance - Optional patient insurance info (for mutuelle)
 */
export function calculateCoverage(
  acts: BillableAct[],
  insuranceType: InsuranceTariffType,
  patientInsurance?: PatientInsurance,
): CoverageCalculation {
  const actResults: ActCoverageResult[] = [];
  let totalCharged = 0;
  let totalTarifReference = 0;
  let totalReimbursement = 0;
  let totalPatientShare = 0;
  let totalDepassement = 0;
  const actsRequiringApproval: string[] = [];

  for (const act of acts) {
    const tariff = getTariffByCode(act.code, insuranceType);
    if (!tariff) {
      // Act not found in tariff table — no coverage
      const chargedPrice = act.overridePrice ?? 0;
      const lineTotal = chargedPrice * act.quantity;
      actResults.push({
        code: act.code,
        description: act.description ?? `Acte ${act.code} (non conventionné)`,
        quantity: act.quantity,
        chargedPrice,
        tarifReference: 0,
        reimbursementRate: 0,
        reimbursementAmount: 0,
        patientShare: chargedPrice,
        depassement: chargedPrice,
        requiresPriorApproval: false,
        lineTotal,
        lineReimbursement: 0,
        linePatientShare: lineTotal,
      });
      totalCharged += lineTotal;
      totalPatientShare += lineTotal;
      totalDepassement += lineTotal;
      continue;
    }

    const chargedPrice = act.overridePrice ?? tariff.tarifReference;
    const depassement = Math.max(0, chargedPrice - tariff.tarifReference);

    // Insurance reimburses based on TNR, not the charged price
    const reimbursementAmount = tariff.reimbursementAmount;
    const patientShare = chargedPrice - reimbursementAmount;

    const lineTotal = chargedPrice * act.quantity;
    const lineReimbursement = reimbursementAmount * act.quantity;
    const linePatientShare = patientShare * act.quantity;

    if (tariff.requiresPriorApproval) {
      actsRequiringApproval.push(
        `${tariff.code} — ${tariff.descriptionFr}`,
      );
    }

    actResults.push({
      code: act.code,
      description: act.description ?? tariff.descriptionFr,
      quantity: act.quantity,
      chargedPrice,
      tarifReference: tariff.tarifReference,
      reimbursementRate: tariff.reimbursementRate,
      reimbursementAmount,
      patientShare,
      depassement,
      requiresPriorApproval: tariff.requiresPriorApproval,
      lineTotal,
      lineReimbursement,
      linePatientShare,
    });

    totalCharged += lineTotal;
    totalTarifReference += tariff.tarifReference * act.quantity;
    totalReimbursement += lineReimbursement;
    totalPatientShare += linePatientShare;
    totalDepassement += depassement * act.quantity;
  }

  // Mutuelle complementary coverage
  let mutuelleCoverage = 0;
  let finalResteACharge = totalPatientShare;

  if (patientInsurance?.mutuelle) {
    const mutuelleRate = patientInsurance.mutuelle.coverageRate / 100;
    // Mutuelle covers a portion of the patient's share (excluding dépassements)
    const shareWithoutDepassement = totalPatientShare - totalDepassement;
    mutuelleCoverage =
      Math.round(Math.max(0, shareWithoutDepassement) * mutuelleRate * 100) / 100;
    finalResteACharge =
      Math.round((totalPatientShare - mutuelleCoverage) * 100) / 100;
  }

  return {
    insuranceType,
    acts: actResults,
    totalCharged: Math.round(totalCharged * 100) / 100,
    totalTarifReference: Math.round(totalTarifReference * 100) / 100,
    totalReimbursement: Math.round(totalReimbursement * 100) / 100,
    totalPatientShare: Math.round(totalPatientShare * 100) / 100,
    totalDepassement: Math.round(totalDepassement * 100) / 100,
    actsRequiringApproval,
    mutuelleCoverage,
    finalResteACharge,
  };
}

// ---- Helpers ----

/**
 * Determine the tariff insurance type from a MoroccanInsuranceType.
 * Returns undefined for insurance types that don't have tariff tables.
 */
export function toTariffInsuranceType(
  insuranceType: MoroccanInsuranceType,
): InsuranceTariffType | undefined {
  switch (insuranceType) {
    case "cnss":
      return "cnss";
    case "cnops":
      return "cnops";
    default:
      return undefined;
  }
}

/**
 * Get a summary label for an insurance type.
 */
export function getInsuranceLabel(insuranceType: InsuranceTariffType): string {
  switch (insuranceType) {
    case "cnss":
      return "CNSS (70%)";
    case "cnops":
      return "CNOPS (80%)";
  }
}

/**
 * Get all unique categories across both tariff tables.
 */
export function getAllCategories(): { code: string; label: string }[] {
  return [
    { code: "C", label: "Consultations généralistes" },
    { code: "CS", label: "Consultations spécialisées" },
    { code: "KC", label: "Chirurgie" },
    { code: "KE", label: "Explorations fonctionnelles" },
    { code: "K", label: "Actes techniques" },
    { code: "Z", label: "Radiologie / Imagerie" },
    { code: "B", label: "Biologie / Laboratoire" },
    { code: "D", label: "Actes dentaires" },
    { code: "P", label: "Prothèses / Optique" },
  ];
}

/**
 * Compare CNSS vs CNOPS coverage for a list of acts.
 * Useful for showing patients the difference.
 */
export function compareCoverage(
  acts: BillableAct[],
  patientInsurance?: PatientInsurance,
): { cnss: CoverageCalculation; cnops: CoverageCalculation } {
  return {
    cnss: calculateCoverage(acts, "cnss", patientInsurance),
    cnops: calculateCoverage(acts, "cnops", patientInsurance),
  };
}
