/**
 * Insurance co-pay calculation for Moroccan clinic billing.
 *
 * Lane-A safe: operates on invoice totals and patient policy numbers. It does
 * NOT submit insurance claims (which is feature-flagged off) and does NOT
 * require diagnostic or procedure codes.
 */

import { checkEligibility, type MoroccanInsuranceType } from "@/lib/insurance/client";
import { logger } from "@/lib/logger";

export interface InsuranceCoPayInput {
  /** Invoice total in MAD (smallest displayed unit, not centimes). */
  totalAmount: number;
  policyNumber: string;
  insuranceType: MoroccanInsuranceType;
  clinicId: string;
}

export interface InsuranceCoPayResult {
  totalAmount: number;
  coveragePercentage: number;
  coPayPercentage: number;
  insuranceCoveredAmount: number;
  patientPayAmount: number;
  eligible: boolean;
  message?: string;
}

/**
 * Calculate the patient and insurance portions of an invoice.
 *
 * Returns rounded values in MAD. Falls back to patient-pays-full if
 * eligibility fails or the provider is unavailable.
 */
export async function calculateInsuranceCoPay({
  totalAmount,
  policyNumber,
  insuranceType,
  clinicId,
}: InsuranceCoPayInput): Promise<InsuranceCoPayResult> {
  try {
    const eligibility = await checkEligibility(policyNumber, insuranceType);

    if (!eligibility.eligible || insuranceType === "none") {
      return {
        totalAmount,
        coveragePercentage: 0,
        coPayPercentage: 100,
        insuranceCoveredAmount: 0,
        patientPayAmount: totalAmount,
        eligible: false,
        message: eligibility.message || "Couverture non éligible",
      };
    }

    const coverage = eligibility.coveragePercentage ?? 0;
    const coPay = eligibility.coPayPercentage ?? 100 - coverage;

    const insuranceCoveredAmount = Math.round((totalAmount * coverage) / 100);
    const patientPayAmount = Math.max(0, totalAmount - insuranceCoveredAmount);

    return {
      totalAmount,
      coveragePercentage: coverage,
      coPayPercentage: coPay,
      insuranceCoveredAmount,
      patientPayAmount,
      eligible: true,
      message: eligibility.message,
    };
  } catch (error) {
    logger.warn("Insurance co-pay calculation failed, falling back to patient-pays-full", {
      context: "billing/insurance-copay",
      clinicId,
      insuranceType,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      totalAmount,
      coveragePercentage: 0,
      coPayPercentage: 100,
      insuranceCoveredAmount: 0,
      patientPayAmount: totalAmount,
      eligible: false,
      message: "Erreur de vérification d'assurance",
    };
  }
}
