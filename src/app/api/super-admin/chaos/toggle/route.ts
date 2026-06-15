import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getWorkerBinding } from "@/lib/cf-bindings";
import { logger } from "@/lib/logger";
import { withAuth } from "@/lib/with-auth";

// POST /api/super-admin/chaos/toggle — Enable/disable chaos experiments
export const POST = withAuth(
  async (req: NextRequest, { user }) => {
    try {
      const body = await req.json();
      const enabled = Boolean(body.enabled);

      // Store chaos state in KV (per-environment)
      const kv = await getWorkerBinding<KVNamespace>("FEATURE_FLAGS_KV");
      if (!kv) {
        return apiError("KV binding unavailable", 503, "KV_UNAVAILABLE");
      }
      await kv.put("chaos_enabled", JSON.stringify({ enabled }));

      logger.warn("Chaos experiments toggled", {
        context: "chaos-engine",
        enabled,
        triggeredBy: user.id,
      });

      return apiSuccess({ enabled });
    } catch (_err) {
      return apiError("Failed to toggle chaos mode", 500);
    }
  },
  ["super_admin"],
);
