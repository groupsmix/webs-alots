/**
 * GET /api/admin/referrals — List all patient referrals across clinics
 *
 * Requires super_admin role.
 */

import { type NextRequest } from "next/server";
import { apiSuccess, apiInternalError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { createUntypedAdminClient } from "@/lib/supabase-server";
import type { UserRole } from "@/lib/types/database";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const ALLOWED_ROLES: UserRole[] = ["super_admin"];

async function handleGet(_request: NextRequest, _auth: AuthContext) {
  try {
    // nosemgrep: tenant-scoping
    const supabase = createUntypedAdminClient("super_admin");

    const { data, error } = await supabase
      .from("referrals")
      .select(
        "id, clinic_id, referring_doctor_id, referred_to_doctor_id, patient_id, reason, status, created_at, clinics(name)",
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      logger.error("Failed to fetch referrals", { context: "referrals-api", error });
      return apiInternalError("Failed to fetch referrals");
    }

    return apiSuccess({ referrals: data ?? [] });
  } catch (err) {
    logger.error("Unexpected error fetching referrals", { context: "referrals-api", error: err });
    return apiInternalError("Failed to fetch referrals");
  }
}

export const GET = withAuth(handleGet, ALLOWED_ROLES);
