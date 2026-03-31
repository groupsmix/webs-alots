import { NextRequest } from "next/server";
import { createTenantClient } from "@/lib/supabase-server";
import { apiSuccess, apiError, apiInternalError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

/**
 * GET /api/checkin/status?clinicId=...
 *
 * Check whether kiosk mode is enabled for the given clinic.
 */
export async function GET(request: NextRequest) {
  const clinicId = request.nextUrl.searchParams.get("clinicId");
  if (!clinicId) {
    return apiError("Missing clinicId", 400);
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
