/**
 * GET /api/admin/marketplace — List all feature definitions (add-ons/integrations)
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
      .from("feature_definitions")
      .select("id, name, description, key, category, available_tiers, global_enabled")
      .order("name");

    if (error) {
      logger.error("Failed to fetch marketplace features", { context: "marketplace-api", error });
      return apiInternalError("Failed to fetch marketplace data");
    }

    // Count how many clinics have each feature enabled (via feature_overrides)
    const { data: overrides } = await supabase
      .from("clinic_feature_overrides")
      .select("feature_key");

    const installCounts: Record<string, number> = {};
    if (overrides) {
      for (const o of overrides) {
        const fkey = o.feature_key as string;
        installCounts[fkey] = (installCounts[fkey] ?? 0) + 1;
      }
    }

    const features = (data ?? []).map((f) => ({
      id: f.id as string,
      name: f.name as string,
      description: f.description as string | null,
      key: f.key as string,
      category: f.category as string | null,
      available_tiers: f.available_tiers as string[],
      global_enabled: f.global_enabled as boolean,
      installs: installCounts[f.key as string] ?? 0,
    }));

    return apiSuccess({ features });
  } catch (err) {
    logger.error("Unexpected error fetching marketplace", {
      context: "marketplace-api",
      error: err,
    });
    return apiInternalError("Failed to fetch marketplace data");
  }
}

export const GET = withAuth(handleGet, ALLOWED_ROLES);
