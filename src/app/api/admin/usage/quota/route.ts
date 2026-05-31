/**
 * GET /api/admin/usage/quota — Per-clinic quota status and metered usage.
 *
 * Query params:
 *   ?clinic_id=<uuid>  — single clinic quota + usage breakdown
 *   (no param)         — all clinics metered usage summary (super_admin)
 *
 * Requires super_admin or clinic_admin role.
 */

import { type NextRequest } from "next/server";
import { apiSuccess, apiError, apiInternalError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { getClinicQuotaStatus } from "@/lib/quota-enforcement";
import { createUntypedAdminClient } from "@/lib/supabase-server";
import { getMonthlyUsage, getAllClinicsMonthlyUsage } from "@/lib/tenant-metering";
import type { UserRole } from "@/lib/types/database";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const ALLOWED_ROLES: UserRole[] = ["super_admin", "clinic_admin"];

async function handleGet(request: NextRequest, auth: AuthContext) {
  try {
    const { searchParams } = new URL(request.url);
    const clinicId = searchParams.get("clinic_id");
    // nosemgrep: tenant-scoping
    const supabase = createUntypedAdminClient("super_admin");

    // Single clinic: return quota status + usage breakdown
    if (clinicId) {
      // Clinic admins can only view their own clinic
      if (auth.profile.role !== "super_admin" && auth.profile.clinic_id !== clinicId) {
        return apiError("Forbidden", 403, "FORBIDDEN");
      }

      // Resolve clinic tier
      const { data: clinic } = await supabase
        .from("clinics") // nosemgrep: semgrep.tenant-scoping
        .select("tier")
        .eq("id", clinicId)
        .single();

      const tier = (clinic?.tier as string) ?? "free";

      const [quotaStatus, usage] = await Promise.all([
        getClinicQuotaStatus(supabase, clinicId, tier),
        getMonthlyUsage(supabase, clinicId),
      ]);

      return apiSuccess({ clinicId, tier, quota: quotaStatus, usage });
    }

    // All clinics (super_admin only)
    if (auth.profile.role !== "super_admin") {
      return apiError("Forbidden", 403, "FORBIDDEN");
    }

    const allUsage = await getAllClinicsMonthlyUsage(supabase);
    return apiSuccess({ usage: allUsage });
  } catch (err) {
    logger.error("quota-api: unexpected error", { context: "quota-api", error: err });
    return apiInternalError("Failed to fetch quota data");
  }
}

export const GET = withAuth(handleGet, ALLOWED_ROLES);
