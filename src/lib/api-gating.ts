/**
 * API-level feature gating for Architecture-B (clinical/PHI) route groups.
 *
 * Centralizes the Lane-A decision: operational API groups are always allowed,
 * gated API groups require a feature flag, and deleted non-healthcare groups
 * remain permanently blocked until explicitly re-enabled.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getVerticalForApiGroup, isApiGroupEnabled } from "@/lib/config/verticals";
import { mergeFeaturesConfig, type FeaturesConfig } from "@/lib/features";
import { logger } from "@/lib/logger";
import type { Database } from "@/lib/types/database";

/**
 * Extract the first path segment under `/api/`.
 * `/api/prescriptions/123` -> `prescriptions`
 * `/api/prescriptions` -> `prescriptions`
 * `/api/admin/users` -> `admin`
 */
function getApiGroupFromPathname(pathname: string): string | undefined {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length < 2 || parts[0] !== "api") return undefined;
  return parts[1];
}

/**
 * Fetch the merged features config for a clinic type.
 * Returns `DEFAULT_FEATURES` if the type is unknown or inactive.
 */
async function getClinicFeaturesConfig(
  supabase: SupabaseClient<Database>,
  typeKey: string,
): Promise<FeaturesConfig> {
  try {
    const { data, error } = await supabase
      .from("clinic_types")
      .select("features_config")
      .eq("type_key", typeKey)
      .eq("is_active", true)
      .single();

    if (error || !data) {
      logger.warn("Failed to fetch clinic type features_config, using defaults", {
        context: "api-gating",
        typeKey,
        error: error?.message,
      });
      return mergeFeaturesConfig(null);
    }

    return mergeFeaturesConfig(data.features_config as FeaturesConfig | null);
  } catch (err) {
    logger.warn("Exception fetching clinic type features_config, using defaults", {
      context: "api-gating",
      typeKey,
      error: err instanceof Error ? err.message : String(err),
    });
    return mergeFeaturesConfig(null);
  }
}

/**
 * Check whether a request to an API group is allowed for the current clinic.
 * Returns `true` for operational (ungated) groups and `false` for gated groups
 * that are not enabled. Does NOT throw.
 */
export async function isApiGroupAllowed(
  supabase: SupabaseClient<Database>,
  pathname: string,
  typeKey: string | undefined,
): Promise<boolean> {
  const apiGroup = getApiGroupFromPathname(pathname);
  if (!apiGroup) return true;

  const vertical = getVerticalForApiGroup(apiGroup);
  if (!vertical) return true;

  if (!typeKey) return false;

  const features = await getClinicFeaturesConfig(supabase, typeKey);
  return isApiGroupEnabled(apiGroup, features);
}
