/**
 * GDPR Art.18 / Art.21 enforcement helpers.
 *
 * A62-F1: Art.18 — Restriction of processing.
 *   When a patient sets `processing_restricted = true`, non-essential
 *   processing (AI summaries, legitimate-interest notifications) MUST be
 *   skipped. The restriction is lifted by the patient or after DPO review.
 *
 * A62-F2: Art.21 — Objection to legitimate-interest processing.
 *   When a patient sets `processing_objection_active = true`, the specific
 *   activities in `processing_objection_activities` MUST be skipped.
 *
 * Usage in route handlers (example — AI route):
 *
 *   const enforcement = await getProcessingEnforcement(supabase, profile.id);
 *   if (enforcement.restricted) {
 *     return apiError("Processing restricted under GDPR Art.18", 403, "PROCESSING_RESTRICTED");
 *   }
 *   if (enforcement.objectsTo("ai_summaries")) {
 *     return apiError("Processing objected under GDPR Art.21", 403, "PROCESSING_OBJECTED");
 *   }
 *
 * Usage in cron / batch jobs:
 *
 *   const enf = await getProcessingEnforcement(supabase, userId);
 *   if (enf.restricted || enf.objectsTo("whatsapp_reminders")) continue;
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

/**
 * Processing activity identifiers used throughout the system.
 * Add new values here when adding new processing activities.
 */
type ProcessingActivity =
  | "ai_summaries"
  | "ai_drug_interactions"
  | "ai_prescription_suggestions"
  | "ai_receptionist"
  | "whatsapp_reminders"
  | "whatsapp_marketing"
  | "analytics"
  | "all";

export interface ProcessingEnforcement {
  /** Art.18: blanket restriction on all non-essential processing */
  restricted: boolean;
  /** Art.21: whether the user objects to a specific activity */
  objectsTo(activity: ProcessingActivity): boolean;
  /** Raw list of objected activities (for logging/audit) */
  objectedActivities: string[];
}

/**
 * Fetch the current GDPR processing enforcement state for a user.
 * Returns a safe default (no restrictions) on error so callers do not
 * need to handle lookup failures (fail-open for availability).
 */
export async function getProcessingEnforcement(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProcessingEnforcement> {
  try {
    const { data, error } = await supabase
      .from("users") // nosemgrep: semgrep.tenant-scoping — per-user GDPR flag lookup scoped by .eq("id", userId); clinic_id does not apply (cross-tenant patients allowed)
      .select("processing_restricted, processing_objection_active, processing_objection_activities")
      .eq("id", userId)
      .single();

    if (error || !data) {
      logger.warn("gdpr-enforcement: could not fetch user flags — failing open", {
        context: "gdpr-enforcement",
        userId,
        error,
      });
      return makeEnforcement(false, false, []);
    }

    const restricted = (data as Record<string, unknown>).processing_restricted === true;
    const objectionActive = (data as Record<string, unknown>).processing_objection_active === true;
    const objectedActivities: string[] = Array.isArray(
      (data as Record<string, unknown>).processing_objection_activities,
    )
      ? ((data as Record<string, unknown>).processing_objection_activities as string[])
      : [];

    return makeEnforcement(restricted, objectionActive, objectedActivities);
  } catch (err) {
    logger.warn("gdpr-enforcement: unexpected error — failing open", {
      context: "gdpr-enforcement",
      userId,
      error: err,
    });
    return makeEnforcement(false, false, []);
  }
}

function makeEnforcement(
  restricted: boolean,
  objectionActive: boolean,
  objectedActivities: string[],
): ProcessingEnforcement {
  return {
    restricted,
    objectedActivities,
    objectsTo(activity: ProcessingActivity): boolean {
      if (!objectionActive) return false;
      return objectedActivities.includes("all") || objectedActivities.includes(activity);
    },
  };
}

/**
 * Quick guard: returns a 403 error response string if Art.18 restriction applies.
 * Import in route handlers that perform non-essential processing.
 */
