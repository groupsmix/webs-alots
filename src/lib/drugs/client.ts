/**
 * Drug Database Client
 *
 * Integrates with OpenFDA (FDA's free public drug database API).
 * Falls back gracefully when the API is unavailable.
 *
 * For production Moroccan clinics, swap `DRUG_DB_PROVIDER` to "vidal"
 * and set VIDAL_API_KEY once a commercial license is obtained.
 *
 * Environment variables:
 *   DRUG_DB_PROVIDER  — "openfda" (default) | "vidal"
 *   VIDAL_API_KEY     — required when DRUG_DB_PROVIDER=vidal
 *
 * @see https://open.fda.gov/apis/drug/
 */

import { logger } from "@/lib/logger";

export interface DrugSearchResult {
  /** Normalized brand or generic name */
  name: string;
  /** Generic (INN) name */
  genericName?: string;
  /** Route of administration */
  route?: string;
  /** Dosage form */
  dosageForm?: string;
  /** Active ingredients */
  activeIngredients?: Array<{ name: string; strength?: string }>;
  /** National Drug Code */
  ndc?: string;
}

export interface DrugInteractionResult {
  severity: "minor" | "moderate" | "major" | "contraindicated";
  description: string;
  drug1: string;
  drug2: string;
}

interface OpenFdaLabel {
  openfda?: {
    brand_name?: string[];
    generic_name?: string[];
    route?: string[];
    dosage_form?: string[];
    substance_name?: string[];
    product_ndc?: string[];
  };
  active_ingredient?: string[];
  drug_interactions?: string[];
}

/**
 * Search for drugs by name (supports auto-complete).
 * Returns up to `limit` results.
 */
export async function searchDrugs(
  query: string,
  limit = 10,
): Promise<DrugSearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  const provider = process.env.DRUG_DB_PROVIDER ?? "openfda";

  if (provider === "vidal") {
    return searchVidalDrugs(q, limit);
  }

  return searchOpenFdaDrugs(q, limit);
}

async function searchOpenFdaDrugs(
  query: string,
  limit: number,
): Promise<DrugSearchResult[]> {
  const encoded = encodeURIComponent(query);
  const url = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${encoded}"+openfda.generic_name:"${encoded}"&limit=${limit}`;

  try {
    const response = await fetch(url, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      if (response.status === 404) return []; // No results
      throw new Error(`OpenFDA responded with ${response.status}`);
    }

    const { results } = (await response.json()) as { results: OpenFdaLabel[] };

    return results.map((item): DrugSearchResult => {
      const ofd = item.openfda ?? {};
      return {
        name: ofd.brand_name?.[0] ?? ofd.generic_name?.[0] ?? "Unknown",
        genericName: ofd.generic_name?.[0],
        route: ofd.route?.[0],
        dosageForm: ofd.dosage_form?.[0],
        ndc: ofd.product_ndc?.[0],
        activeIngredients: ofd.substance_name?.map((s) => ({ name: s })),
      };
    });
  } catch (err) {
    logger.error("OpenFDA drug search failed", { context: "drugs/client", error: err });
    return [];
  }
}

/**
 * Stub for Vidal API integration (requires commercial license).
 * Replace with real Vidal REST API calls once credentials are available.
 */
async function searchVidalDrugs(
  _query: string,
  _limit: number,
): Promise<DrugSearchResult[]> {
  const apiKey = process.env.VIDAL_API_KEY;
  if (!apiKey) {
    throw new Error("VIDAL_API_KEY is not configured");
  }
  // TODO: Implement Vidal REST API integration
  // https://www.vidal.fr/developpeurs/api
  throw new Error("Vidal integration not yet implemented");
}

/**
 * Check for potential drug interactions between two or more drugs.
 * Uses OpenFDA drug labels' drug_interactions section for basic checking.
 *
 * NOTE: This is a heuristic check — for production, use a dedicated
 * interaction database (e.g., DrugBank, Vidal interactions module).
 */
export async function checkDrugInteractions(
  drugNames: string[],
): Promise<DrugInteractionResult[]> {
  if (drugNames.length < 2) return [];

  const interactions: DrugInteractionResult[] = [];

  // Check each pair
  for (let i = 0; i < drugNames.length; i++) {
    for (let j = i + 1; j < drugNames.length; j++) {
      const drug1 = drugNames[i];
      const drug2 = drugNames[j];

      try {
        const encoded = encodeURIComponent(drug1);
        const url = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${encoded}"+openfda.generic_name:"${encoded}"&limit=1`;
        const response = await fetch(url, { signal: AbortSignal.timeout(4000) });

        if (!response.ok) continue;

        const { results } = (await response.json()) as { results: OpenFdaLabel[] };
        const interactionText = results[0]?.drug_interactions?.[0] ?? "";

        if (
          interactionText &&
          interactionText.toLowerCase().includes(drug2.toLowerCase())
        ) {
          interactions.push({
            severity: "moderate",
            description: interactionText.slice(0, 500),
            drug1,
            drug2,
          });
        }
      } catch (err) {
        logger.warn("Drug interaction check failed for pair", {
          context: "drugs/client",
          drug1,
          drug2,
          error: err,
        });
      }
    }
  }

  return interactions;
}
