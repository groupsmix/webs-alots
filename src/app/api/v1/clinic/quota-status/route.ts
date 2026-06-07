/**
 * GET /api/v1/clinic/quota-status
 *
 * Returns the authenticated clinic's current monthly resource usage
 * vs plan limits. Used by the UsageWidget on the clinic admin dashboard.
 *
 * OWASP A01: withAuth enforces clinic_admin/receptionist access.
 * OWASP A04: All queries scoped to clinicId from authenticated profile.
 */

import { type NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getClinicQuotaStatus } from "@/lib/quota-enforcement";
import { withAuth, type AuthContext } from "@/lib/with-auth";

export const GET = withAuth(
  async (_request: NextRequest, auth: AuthContext) => {
    const { profile, supabase } = auth;
    const clinicId = profile.clinic_id;

    if (!clinicId) {
      return apiError("No clinic associated with this account", 403, "NO_CLINIC");
    }

    // Get clinic tier — scoped to clinicId
    const { data: clinic } = await supabase
      .from("clinics")
      .select("tier")
      .eq("id", clinicId)
      .single();

    const tier = (clinic as { tier?: string } | null)?.tier ?? "free";

    // Get quota status for all resource types
    const quotaStatus = await getClinicQuotaStatus(supabase, clinicId, tier);

    return apiSuccess({
      plan: tier,
      ...quotaStatus,
    });
  },
  ["clinic_admin", "receptionist", "doctor"],
);
