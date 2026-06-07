/**
 * GET /api/super-admin/subscription-history?clinicId=UUID
 *
 * Returns subscription history for a specific clinic (super admin only).
 *
 * OWASP A01: super_admin only.
 * OWASP A03: clinicId validated as UUID.
 */

import { z } from "zod";
import { type NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const querySchema = z.object({
  clinicId: z.string().uuid("Invalid clinic ID"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const GET = withAuth(
  async (request: NextRequest, auth: AuthContext) => {
    const { supabase } = auth;
    const { searchParams } = new URL(request.url);

    const parsed = querySchema.safeParse({
      clinicId: searchParams.get("clinicId"),
      limit: searchParams.get("limit"),
    });
    if (!parsed.success) {
      return apiError("Invalid parameters", 400, "INVALID_PARAMS");
    }
    const { clinicId, limit } = parsed.data;

    try {
      // nosemgrep: semgrep.tenant-scoping — super_admin intentional cross-tenant read
      const { data: history, error } = await supabase
        .from("subscription_history")
        .select(
          "id, event_type, from_plan_slug, to_plan_slug, amount_centimes, currency, notes, created_at",
        )
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        logger.warn("Failed to fetch subscription history", {
          context: "api/super-admin/subscription-history",
          clinicId,
          error,
        });
        return apiError("Failed to fetch subscription history", 500, "DB_ERROR");
      }

      return apiSuccess({ history: history ?? [] });
    } catch (err) {
      logger.error("subscription-history fetch failed", {
        context: "api/super-admin/subscription-history",
        error: err instanceof Error ? err.message : String(err),
      });
      return apiError("Internal error", 500, "INTERNAL_ERROR");
    }
  },
  ["super_admin"],
);
