import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { withAuth } from "@/lib/with-auth";
import { logger } from "@/lib/logger";
import { apiError, apiInternalError, apiNotFound, apiSuccess } from "@/lib/api-response";
/**
 * GET /api/clinic-features?type_key=general_medicine
 *
 * Returns the features_config for a given clinic type key.
 * Protected — requires authentication.
 * MED-14: Only returns features for the authenticated user's own clinic type.
 */
export const GET = withAuth(async (request: NextRequest, { supabase, profile }) => {
  try {
    const typeKey = request.nextUrl.searchParams.get("type_key");

    if (!typeKey) {
      return apiError("type_key query parameter is required");
    }

    // MED-14: Validate the requested type_key matches the authenticated user's
    // clinic type. Prevents cross-clinic feature enumeration.
    if (profile.role !== "super_admin" && profile.clinic_id) {
      const { data: clinic } = await supabase
        .from("clinics")
        .select("clinic_type_key")
        .eq("id", profile.clinic_id)
        .single();

      if (clinic?.clinic_type_key && clinic.clinic_type_key !== typeKey) {
        return apiError("Cannot query features for a different clinic type", 403);
      }
    }

    const { data, error } = await supabase
      .from("clinic_types")
      .select("features_config")
      .eq("type_key", typeKey)
      .eq("is_active", true)
      .single();

    if (error || !data) {
      return apiNotFound("Clinic type not found");
    }

    return apiSuccess({
      type_key: typeKey,
      features_config: data.features_config,
    });
  } catch (err) {
    logger.warn("Operation failed", { context: "clinic-features", error: err });
    return apiInternalError("Failed to fetch clinic features");
  }
}, null);
