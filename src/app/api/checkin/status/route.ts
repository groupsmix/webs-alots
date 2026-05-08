import { NextRequest } from "next/server";
import { apiSuccess, apiError, apiInternalError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { createTenantClient } from "@/lib/supabase-server";
import { getTenant } from "@/lib/tenant";

/**
 * GET /api/checkin/status
 *
 * Check whether kiosk mode is enabled for the given clinic.
 *
 * AUDIT F-04: clinicId is now ALWAYS derived from the subdomain via
 * getTenant(). The URL-supplied clinicId fallback has been removed.
 */
export async function GET(request: NextRequest) {
  const urlClinicId = request.nextUrl.searchParams.get("clinicId");

  // AUDIT F-04: Always require subdomain-derived tenant. No fallback to URL param.
  const tenant = await getTenant();
  if (!tenant?.clinicId) {
    return apiError("Clinic context required — use a clinic subdomain", 400);
  }
  const clinicId = tenant.clinicId;

  // If a URL-supplied clinicId is present, it must match the subdomain.
  if (urlClinicId && urlClinicId !== clinicId) {
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
