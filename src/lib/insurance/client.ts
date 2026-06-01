/**
 * Insurance API Client
 *
 * Abstraction layer for Moroccan health insurance providers.
 * Supports AMO (Assurance Maladie Obligatoire), CNOPS, CNSS, RAMED, and private insurers.
 *
 * Currently implemented as a sandbox/simulation layer.
 * Replace the provider-specific methods with real API calls once credentials are available.
 *
 * Environment variables:
 *   INSURANCE_PROVIDER       — "sandbox" (default) | "amo" | "cnops"
 *   AMO_API_KEY              — required when INSURANCE_PROVIDER=amo
 *   CNOPS_API_KEY            — required when INSURANCE_PROVIDER=cnops
 *
 * Coverage rates by insurance type (Moroccan standard rates):
 *   AMO:    70–80% hospitalisation, 70% ambulatoire
 *   CNOPS:  80–90% hospitalisation, 80% ambulatoire
 *   RAMED:  100% (indigent care)
 *   Private: up to 100%
 */

import { logger } from "@/lib/logger";
import { getInsuranceProvider } from "@/lib/env";

export type MoroccanInsuranceType = "AMO" | "CNOPS" | "CNSS" | "RAMED" | "private" | "none";

export interface EligibilityResult {
  eligible: boolean;
  insuranceType: MoroccanInsuranceType;
  policyNumber?: string;
  /** Coverage percentage 0-100 */
  coveragePercentage: number;
  /** Patient co-pay percentage */
  coPayPercentage: number;
  /** Maximum annual coverage in MAD centimes */
  annualLimitCentimes?: number;
  /** Expiry date of coverage */
  expiryDate?: string;
  message?: string;
}

export interface ClaimSubmissionResult {
  success: boolean;
  claimNumber?: string;
  /** Approved amount in MAD centimes */
  approvedAmountCentimes?: number;
  rejectionReason?: string;
  processingDays?: number;
}

/**
 * Check a patient's insurance eligibility.
 * @param policyNumber - Patient's insurance policy number
 * @param insuranceType - Type of Moroccan insurance
 */
export async function checkEligibility(
  policyNumber: string,
  insuranceType: MoroccanInsuranceType,
): Promise<EligibilityResult> {
  const provider = getInsuranceProvider();

  if (provider === "sandbox") {
    return sandboxEligibilityCheck(policyNumber, insuranceType);
  }

  logger.warn("Real insurance API integration not yet implemented", {
    context: "insurance/client",
    provider,
    insuranceType,
  });
  throw new Error(`Insurance provider "${provider}" integration not yet implemented`);
}

/**
 * Submit an insurance claim for a patient's treatment.
 */
export async function submitClaim(params: {
  policyNumber: string;
  insuranceType: MoroccanInsuranceType;
  /** Amount billed in MAD centimes */
  amountCentimes: number;
  diagnosisCode?: string;
  procedureCodes?: string[];
  appointmentDate: string;
  doctorName: string;
  patientName: string;
}): Promise<ClaimSubmissionResult> {
  const provider = getInsuranceProvider();

  if (provider === "sandbox") {
    return sandboxSubmitClaim(params);
  }

  throw new Error(`Insurance provider "${provider}" integration not yet implemented`);
}

// ─── Sandbox Implementation ─────────────────────────────────────────────────

const COVERAGE_RATES: Record<MoroccanInsuranceType, { coverage: number; coPay: number }> = {
  AMO:     { coverage: 70, coPay: 30 },
  CNOPS:   { coverage: 80, coPay: 20 },
  CNSS:    { coverage: 70, coPay: 30 },
  RAMED:   { coverage: 100, coPay: 0 },
  private: { coverage: 90, coPay: 10 },
  none:    { coverage: 0, coPay: 100 },
};

function sandboxEligibilityCheck(
  policyNumber: string,
  insuranceType: MoroccanInsuranceType,
): EligibilityResult {
  // Simulate invalid policy
  if (!policyNumber || policyNumber.length < 5) {
    return {
      eligible: false,
      insuranceType,
      coveragePercentage: 0,
      coPayPercentage: 100,
      message: "Numéro de police invalide",
    };
  }

  const rates = COVERAGE_RATES[insuranceType];
  const expiryDate = new Date();
  expiryDate.setFullYear(expiryDate.getFullYear() + 1);

  return {
    eligible: true,
    insuranceType,
    policyNumber,
    coveragePercentage: rates.coverage,
    coPayPercentage: rates.coPay,
    annualLimitCentimes: insuranceType === "RAMED" ? undefined : 150_000_00, // 150,000 MAD
    expiryDate: expiryDate.toISOString().split("T")[0],
    message: `[SANDBOX] Couverture ${insuranceType}: ${rates.coverage}%`,
  };
}

function sandboxSubmitClaim(params: {
  policyNumber: string;
  insuranceType: MoroccanInsuranceType;
  amountCentimes: number;
  appointmentDate: string;
  doctorName: string;
  patientName: string;
}): ClaimSubmissionResult {
  const rates = COVERAGE_RATES[params.insuranceType];
  const approvedAmount = Math.floor(params.amountCentimes * (rates.coverage / 100));
  const claimNumber = `${params.insuranceType}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  return {
    success: true,
    claimNumber,
    approvedAmountCentimes: approvedAmount,
    processingDays: params.insuranceType === "RAMED" ? 3 : 14,
  };
}
