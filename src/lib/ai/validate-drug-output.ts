/**
 * F-AI-14 / A108: AI output drug name validator.
 *
 * Checks drug names returned by AI against the Moroccan DCI drug database.
 * Flags unrecognised drug names so clinicians are warned about potential
 * hallucinations before accepting an AI-suggested prescription.
 *
 * This is NOT a hard reject — it returns warnings alongside the original
 * output. The doctor always has final say.
 */

import { DCI_DRUG_DATABASE } from "@/lib/dci-drug-database";
import { logger } from "@/lib/logger";

// Build a normalised lookup set at module load time for O(1) checks.
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** All known drug names (DCI + brands), normalised. */
const KNOWN_DRUG_NAMES: Set<string> = new Set();
for (const drug of DCI_DRUG_DATABASE) {
  KNOWN_DRUG_NAMES.add(normalize(drug.dci));
  for (const brand of drug.brands) {
    KNOWN_DRUG_NAMES.add(normalize(brand));
  }
}

export interface DrugValidationResult {
  /** Drug names that were NOT found in the Moroccan DCI database. */
  unknownDrugs: string[];
  /** Drug names that matched a known DCI or brand. */
  knownDrugs: string[];
  /** True if all drug names were recognised. */
  allKnown: boolean;
}

/**
 * Validate a list of drug names against the Moroccan DCI database.
 *
 * @param drugNames Array of drug name strings to check
 * @returns Validation result with known/unknown drug lists
 */
export function validateDrugNames(drugNames: string[]): DrugValidationResult {
  const knownDrugs: string[] = [];
  const unknownDrugs: string[] = [];

  for (const name of drugNames) {
    if (!name || name.trim().length === 0) continue;

    const norm = normalize(name);
    // Check exact match first, then prefix match (≥3 chars)
    if (KNOWN_DRUG_NAMES.has(norm) || matchesKnownDrugPrefix(norm)) {
      knownDrugs.push(name);
    } else {
      unknownDrugs.push(name);
    }
  }

  if (unknownDrugs.length > 0) {
    logger.warn("ai.drug_validation.unknown_drugs", {
      context: "ai-drug-validator",
      unknownDrugs,
      total: drugNames.length,
      unknownCount: unknownDrugs.length,
    });
  }

  return {
    unknownDrugs,
    knownDrugs,
    allKnown: unknownDrugs.length === 0,
  };
}

/**
 * Check if a normalised drug name matches any known drug by prefix.
 * Handles cases where the AI might abbreviate or use a slightly
 * different form of the drug name (e.g. "amoxicilline" vs "amoxicillin").
 */
function matchesKnownDrugPrefix(norm: string): boolean {
  if (norm.length < 3) return false;
  for (const known of KNOWN_DRUG_NAMES) {
    if (known.startsWith(norm) || norm.startsWith(known)) {
      return true;
    }
  }
  return false;
}

/**
 * Extract drug names from a structured AI prescription response.
 * Handles common output formats: array of medication objects,
 * or newline-separated text with drug names.
 */
export function extractDrugNamesFromPrescription(response: Record<string, unknown>): string[] {
  const names: string[] = [];

  // Handle { medications: [{ name: "..." }, ...] }
  const medications = response.medications ?? response.medicaments ?? response.drugs;
  if (Array.isArray(medications)) {
    for (const med of medications) {
      if (typeof med === "string") {
        names.push(med);
      } else if (med && typeof med === "object") {
        const obj = med as Record<string, unknown>;
        const name = obj.name ?? obj.nom ?? obj.dci ?? obj.drug ?? obj.medication;
        if (typeof name === "string") {
          names.push(name);
        }
      }
    }
  }

  return names;
}
