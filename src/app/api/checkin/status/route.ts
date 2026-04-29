import { NextRequest } from "next/server";
import { apiSuccess, apiError, apiInternalError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { createTenantClient } from "@/lib/supabase-server";
import { getTenant } from "@/lib/tenant";

/**
 * GET /api/checkin/status
 *
 * Check whether kiosk mode is enabled for the current clinic.
 *
 * S-02: clinicId is derived from the subdomain via getTenant() — it is
 * never read from the URL. A legacy `clinicId` query param is accepted
 * only if it matches the subdomain-resolved tenant; otherwise the request
 * is rejected to prevent unauthenticated cross-tenant probing.
 */
export async function GET(request: NextRequest) {
  const tenant = await getTenant();
  if (!tenant?.clinicId) {
    return apiError("Tenant context is required", 400, "TENANT_REQUIRED");
  }
  const clinicId = tenant.clinicId;

  const suppliedClinicId = request.nextUrl.searchParams.get("clinicId");
  if (suppliedClinicId && suppliedClinicId !== clinicId) {
    logger.warn("Rejected check-in status with mismatched clinicId", {
      context: "api/checkin/status",
      tenantClinicId: clinicId,
      suppliedClinicId,
    });
    return apiError("clinicId mismatch", 403, "TENANT_MISMATCH");
  }

  try {
    const supabase = await createTenantClient(clinicId);
    // kiosk_mode_enabled is added by migration 00055 — cast through unknown
    // until Supabase types are regenerated.
    const { data, error } = await supabase
      .from("clinics")
      .select("kiosk_mode_enabled")
      .eq("id", clinicId)
      .single();

    if (error || !data) {
      return apiSuccess({ enabled: false });
    }

    const row = data as unknown as { kiosk_mode_enabled?: boolean };
    return apiSuccess({ enabled: row.kiosk_mode_enabled ?? false });
  } catch (err) {
    logger.error("Failed to check kiosk status", { context: "api/checkin/status", error: err });
    return apiInternalError("Failed to check kiosk status");
  }
}
