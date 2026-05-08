import { NextRequest } from "next/server";
import { apiError, apiInternalError, apiNotFound, apiSuccess } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase-server";
import { withAuthAnyRole } from "@/lib/with-auth";
/**
 * GET /api/clinic-features?type_key=general_medicine
 *
 * Returns the features_config for a given clinic type key.
 * S4: Protected — requires authentication.
 */
export const GET = withAuthAnyRole(async (request: NextRequest) => {
  try {
    const typeKey = request.nextUrl.searchParams.get("type_key");

    if (!typeKey) {
      return apiError("type_key query parameter is required");
    }

    const supabase = await createClient();

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
});
