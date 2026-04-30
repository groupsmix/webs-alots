/**
 * Basic sanctions screening utility.
 *
 * A160: Provides a framework for screening entities (clinics, patients)
 * against sanctions lists (OFAC SDN, EU, UK HMT, UN). This implementation
 * provides the interface and a stub that logs screening requests. When a
 * sanctions-screening provider (e.g. ComplyAdvantage, Chainalysis, or a
 * direct OFAC SDN list download) is integrated, the `screenEntity` function
 * should be updated to call the provider's API.
 *
 * Feature flag: `SANCTIONS_SCREENING_ENABLED` (default: "false").
 * When enabled, screening is performed at clinic onboarding and can be
 * extended to patient creation and periodic re-screening.
 *
 * Environment variables:
 *   SANCTIONS_API_KEY     -- API key for the screening provider
 *   SANCTIONS_API_URL     -- Base URL for the screening provider API
 *   SANCTIONS_SCREENING_ENABLED -- "true" to enable screening
 */

import { logger } from "@/lib/logger";

export type EntityType = "individual" | "organization";

export type ScreeningStatus = "clear" | "match" | "potential_match" | "error" | "skipped";

export interface ScreeningRequest {
  /** Full legal name of the entity. */
  name: string;
  /** Type of entity being screened. */
  entityType: EntityType;
  /** ISO 3166-1 alpha-2 country code (e.g. "MA" for Morocco). */
  country?: string;
  /** Date of birth (individuals) or incorporation date (organizations). */
  dateOfBirth?: string;
  /** National ID or registration number. */
  nationalId?: string;
  /** Internal reference ID (e.g. clinic_id, patient_id). */
  referenceId: string;
  /** Which operation triggered the screening. */
  context: "clinic_onboarding" | "patient_create" | "periodic_rescreen";
}

export interface ScreeningResult {
  status: ScreeningStatus;
  /** Unique screening reference for audit trail. */
  screeningId: string;
  /** Number of matches found (0 if clear). */
  matchCount: number;
  /** Summary of matches if any. */
  matches: ScreeningMatch[];
  /** When the screening was performed. */
  screenedAt: string;
  /** Whether the screening was actually performed against a real provider. */
  providerUsed: boolean;
}

export interface ScreeningMatch {
  /** Name on the sanctions list. */
  listedName: string;
  /** Which list the match was found on. */
  listSource: string;
  /** Match confidence score (0-100). */
  score: number;
  /** Sanctions list entry ID. */
  listEntryId?: string;
}

function isEnabled(): boolean {
  return process.env.SANCTIONS_SCREENING_ENABLED === "true";
}

/**
 * Screen an entity against sanctions lists.
 *
 * When `SANCTIONS_SCREENING_ENABLED` is "false" (default), returns a
 * "skipped" result immediately. When enabled but no provider is configured,
 * logs a warning and returns "error".
 *
 * When a provider is configured, calls the provider API and returns the
 * result. The provider integration point is marked with a TODO.
 */
export async function screenEntity(
  request: ScreeningRequest,
): Promise<ScreeningResult> {
  const screeningId = `scr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const screenedAt = new Date().toISOString();

  if (!isEnabled()) {
    return {
      status: "skipped",
      screeningId,
      matchCount: 0,
      matches: [],
      screenedAt,
      providerUsed: false,
    };
  }

  const apiKey = process.env.SANCTIONS_API_KEY;
  const apiUrl = process.env.SANCTIONS_API_URL;

  if (!apiKey || !apiUrl) {
    logger.warn("Sanctions screening enabled but no provider configured", {
      context: "sanctions-screening",
      referenceId: request.referenceId,
      entityType: request.entityType,
      screeningContext: request.context,
    });
    return {
      status: "error",
      screeningId,
      matchCount: 0,
      matches: [],
      screenedAt,
      providerUsed: false,
    };
  }

  try {
    // Provider integration point.
    // Replace this block with the actual provider API call.
    // Example providers: ComplyAdvantage, Refinitiv World-Check, Dow Jones Risk.
    const response = await fetch(`${apiUrl}/screen`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: request.name,
        entity_type: request.entityType,
        country: request.country,
        date_of_birth: request.dateOfBirth,
        national_id: request.nationalId,
        reference_id: request.referenceId,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      logger.error("Sanctions screening provider returned error", {
        context: "sanctions-screening",
        status: response.status,
        referenceId: request.referenceId,
      });
      return {
        status: "error",
        screeningId,
        matchCount: 0,
        matches: [],
        screenedAt,
        providerUsed: true,
      };
    }

    const data = (await response.json()) as {
      matches?: Array<{
        listed_name: string;
        list_source: string;
        score: number;
        list_entry_id?: string;
      }>;
    };

    const matches: ScreeningMatch[] = (data.matches ?? []).map((m) => ({
      listedName: m.listed_name,
      listSource: m.list_source,
      score: m.score,
      listEntryId: m.list_entry_id,
    }));

    const status: ScreeningStatus =
      matches.length === 0
        ? "clear"
        : matches.some((m) => m.score >= 90)
          ? "match"
          : "potential_match";

    logger.info("Sanctions screening completed", {
      context: "sanctions-screening",
      screeningId,
      referenceId: request.referenceId,
      status,
      matchCount: matches.length,
    });

    return {
      status,
      screeningId,
      matchCount: matches.length,
      matches,
      screenedAt,
      providerUsed: true,
    };
  } catch (err) {
    logger.error("Sanctions screening failed", {
      context: "sanctions-screening",
      referenceId: request.referenceId,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      status: "error",
      screeningId,
      matchCount: 0,
      matches: [],
      screenedAt,
      providerUsed: false,
    };
  }
}

/**
 * Log a sanctions screening result to the audit trail.
 * Should be called after every screening, regardless of result.
 */
export async function logScreeningResult(
  supabase: { from: (table: string) => { insert: (row: Record<string, unknown>) => Promise<{ error: unknown }> } },
  request: ScreeningRequest,
  result: ScreeningResult,
): Promise<void> {
  try {
    await supabase.from("sanctions_screenings").insert({
      screening_id: result.screeningId,
      reference_id: request.referenceId,
      entity_type: request.entityType,
      entity_name: request.name,
      country: request.country ?? null,
      context: request.context,
      status: result.status,
      match_count: result.matchCount,
      matches: result.matches,
      provider_used: result.providerUsed,
      screened_at: result.screenedAt,
    });
  } catch (err) {
    logger.error("Failed to log sanctions screening result", {
      context: "sanctions-screening",
      screeningId: result.screeningId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
