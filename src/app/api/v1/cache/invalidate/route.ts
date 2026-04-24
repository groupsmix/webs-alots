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
import { apiSuccess } from "@/lib/api-response";
import { invalidateSubdomainCache } from "@/lib/subdomain-cache";
import { withAuthValidation } from "@/lib/api-validate";
import { z } from "zod";
import { logger } from "@/lib/logger";

const cacheInvalidateSchema = z.object({
  subdomain: z.string().min(1).max(100),
});

export const POST = withAuthValidation(cacheInvalidateSchema, async (data, _request: NextRequest) => {
    invalidateSubdomainCache(data.subdomain);

    logger.info("Subdomain cache invalidated", {
      context: "cache/invalidate",
      subdomain: data.subdomain,
    });

    return apiSuccess({ invalidated: data.subdomain });
}, ["clinic_admin", "super_admin"]);
