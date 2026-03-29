/**
 * POST /api/v1/cache/invalidate
 *
 * Invalidates the in-memory subdomain cache for a specific subdomain.
 * Called after a clinic's subdomain is updated to prevent stale routing.
 *
 * Requires admin authentication (clinic_admin or super_admin).
 *
 * Body: { subdomain: string }
 */

import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { apiSuccess, apiError, apiValidationError } from "@/lib/api-response";
import { invalidateSubdomainCache } from "@/lib/subdomain-cache";
import { safeParse } from "@/lib/validations";
import { z } from "zod";
import { logger } from "@/lib/logger";

const cacheInvalidateSchema = z.object({
  subdomain: z.string().min(1).max(100),
});

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const raw = await request.json();
    const parsed = safeParse(cacheInvalidateSchema, raw);
    if (!parsed.success) {
      return apiValidationError(parsed.error);
    }

    invalidateSubdomainCache(parsed.data.subdomain);

    logger.info("Subdomain cache invalidated", {
      context: "cache/invalidate",
      subdomain: parsed.data.subdomain,
    });

    return apiSuccess({ invalidated: parsed.data.subdomain });
  } catch (err) {
    logger.error("Cache invalidation failed", { context: "cache/invalidate", error: err });
    return apiError("Failed to invalidate cache", 500, "INTERNAL_ERROR");
  }
}, ["clinic_admin", "super_admin"]);
