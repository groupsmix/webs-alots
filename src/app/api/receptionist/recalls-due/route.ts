/**
 * GET /api/receptionist/recalls-due — Count of due patient recalls.
 *
 * Front-desk staff (receptionist or clinic_admin) see how many recurring
 * recalls are due (pending, due_date <= today) so the reception dashboard can
 * surface "rappels dus" as an actionable item. Returns only an aggregate count
 * — no patient data — and is always scoped to the caller's clinic.
 *
 * `patient_recalls` is not yet in the generated Supabase types, so this uses
 * the untyped admin client (same pattern as the recalls cron). Tenant
 * isolation is enforced by the explicit `.eq("clinic_id", clinicId)` filter.
 */

import { type NextRequest } from "next/server";
import { apiSuccess, apiError, apiInternalError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { createUntypedAdminClient } from "@/lib/supabase-server";
import type { UserRole } from "@/lib/types/database";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const ALLOWED_ROLES: UserRole[] = ["clinic_admin", "receptionist"];

async function handleGet(_req: NextRequest, auth: AuthContext) {
  const clinicId = auth.profile.clinic_id;
  if (!clinicId) return apiError("No clinic context", 400, "NO_CLINIC");

  try {
    const supabase = createUntypedAdminClient("recall-dashboard", clinicId);
    const today = new Date().toISOString().slice(0, 10);

    const { count, error } = await supabase
      .from("patient_recalls")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("status", "pending")
      .lte("due_date", today);

    if (error) {
      logger.warn("Failed to count due recalls", {
        context: "receptionist/recalls-due",
        error: error.message,
      });
      return apiInternalError("Failed to count due recalls");
    }

    return apiSuccess({ count: count ?? 0 });
  } catch (err) {
    logger.error("Unexpected error in GET /api/receptionist/recalls-due", { error: err });
    return apiInternalError("Failed to count due recalls");
  }
}

export const GET = withAuth(handleGet, ALLOWED_ROLES);
