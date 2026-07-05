/**
 * ADR 0013: Scope-gate enforcement helper for API route handlers.
 *
 * Provides a single-call guard that route handlers in gated API groups
 * (clinical, ADT, restaurant, veterinary) invoke to enforce the
 * operations-first scope policy.
 *
 * Usage in a route handler:
 *   const denied = await assertScopeGate(supabase, clinicId, "prescriptions");
 *   if (denied) return denied;
 *
 * @see docs/adr/0013-operations-first-scope.md
 * @see src/lib/config/verticals.ts — VERTICAL_SCOPES
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { isApiGroupEnabled } from "@/lib/config/verticals";
import type { FeaturesConfig } from "@/lib/features";
import { logger } from "@/lib/logger";

/**
 * Check whether the clinic is allowed to access the given API group.
 * Returns an apiError(403) Response if denied, or `null` if allowed.
 *
 * Queries the clinic's type and its features_config from the database,
 * then delegates to `isApiGroupEnabled()` from the capability matrix.
 */
export async function assertScopeGate(
  supabase: SupabaseClient,
  clinicId: string,
  apiGroup: string,
): Promise<NextResponse | null> {
  try {
    // Fetch clinic's type_id, then the type's features_config
    const { data: clinic } = await supabase
      .from("clinics")
      .select("clinic_type_id")
      .eq("id", clinicId)
      .maybeSingle();

    if (!clinic?.clinic_type_id) {
      // No type assigned — deny by default (operations-first)
      return apiError(
        `Vertical "${apiGroup}" is not enabled for this clinic`,
        403,
        "SCOPE_GATE_DENIED",
      );
    }

    const { data: clinicType } = await supabase
      .from("clinic_types")
      .select("features_config")
      .eq("id", clinic.clinic_type_id)
      .maybeSingle();

    const featuresConfig = (clinicType?.features_config ?? null) as FeaturesConfig | null;

    if (!isApiGroupEnabled(apiGroup, featuresConfig)) {
      logger.info("Scope gate denied", {
        context: "scope-gate",
        clinicId,
        apiGroup,
        clinicTypeId: clinic.clinic_type_id,
      });
      return apiError(
        `Vertical "${apiGroup}" is not enabled for this clinic`,
        403,
        "SCOPE_GATE_DENIED",
      );
    }

    return null; // Access allowed
  } catch (err) {
    logger.error("Scope gate check failed", {
      context: "scope-gate",
      error: err,
      clinicId,
      apiGroup,
    });
    // Fail-closed: deny on error
    return apiError("Scope verification failed", 500, "SCOPE_GATE_ERROR");
  }
}
