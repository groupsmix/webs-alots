import { NextRequest } from "next/server";
import { apiSuccess, apiError, apiInternalError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { createTenantClient } from "@/lib/supabase-server";
import { getTenant } from "@/lib/tenant";

/**
 * GET /api/checkin/status?clinicId=...
 *
 * Check whether kiosk mode is enabled for the given clinic.
 *
 * S-02: clinicId is derived from the subdomain via `getTenant()`.
 */
export async function GET(request: NextRequest) {
  const urlClinicId = request.nextUrl.searchParams.get("clinicId");
  const tenant = await getTenant();
  const clinicId = tenant?.clinicId ?? urlClinicId;
  if (!clinicId) {
    return apiError("Missing clinicId", 400);
  }
  // S-02: Reject if URL-supplied clinicId disagrees with subdomain.
  if (urlClinicId && tenant?.clinicId && urlClinicId !== tenant.clinicId) {
    return apiError("clinicId does not match subdomain", 403);
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
