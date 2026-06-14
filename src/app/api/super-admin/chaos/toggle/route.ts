import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

// POST /api/super-admin/chaos/toggle — Enable/disable chaos experiments
export const POST = withAuth(async (req: NextRequest, { user, env }) => {
  try {
    const body = await req.json();
    const enabled = Boolean(body.enabled);
    
    // Store chaos state in KV (per-environment)
    await env.FEATURE_FLAGS_KV.put("chaos_enabled", JSON.stringify({ enabled }));
    
    logger.warn("Chaos experiments toggled", {
      context: "chaos-engine",
      enabled,
      triggeredBy: user.id,
    });
    
    return apiSuccess({ enabled });
  } catch (err) {
    return apiError("Failed to toggle chaos mode", 500);
  }
}, ["super_admin"]);