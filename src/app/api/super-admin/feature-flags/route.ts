import { type NextRequest } from "next/server";
import { z } from "zod";
import {
  apiError,
  apiSuccess,
  apiValidationError,
  logAndReturnInternalError,
} from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { getKVBinding } from "@/lib/features";
import { logger } from "@/lib/logger";
import { createUntypedAdminClient } from "@/lib/supabase-server";
import {
  getSuperAdminFeatureFlagDefinition,
  listSuperAdminFeatureFlags,
} from "@/lib/super-admin-feature-flags";
import { withAuth, type AuthContext } from "@/lib/with-auth";

export const dynamic = "force-dynamic";

const updateFeatureFlagSchema = z.object({
  key: z.string().min(1, "key is required"),
  enabled: z.boolean(),
});

export const GET = withAuth(
  async (_request: NextRequest) => {
    try {
      const { flags, kvAvailable } = await listSuperAdminFeatureFlags();
      return apiSuccess({ flags, kvAvailable });
    } catch (error) {
      return logAndReturnInternalError(error, "super-admin-feature-flags:get");
    }
  },
  ["super_admin"],
);

export const PUT = withAuth(
  async (request: NextRequest, auth: AuthContext) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiValidationError("Invalid JSON body");
    }

    const parsed = updateFeatureFlagSchema.safeParse(body);
    if (!parsed.success) {
      return apiValidationError(
        parsed.error.issues.map((issue: { message: string }) => issue.message).join(", "),
      );
    }

    const definition = getSuperAdminFeatureFlagDefinition(parsed.data.key);
    if (definition) {
      const lockState = definition.isLocked?.() ?? { locked: false, reason: null };
      if (parsed.data.enabled && lockState.locked) {
        return apiError(lockState.reason ?? "This feature flag is locked", 409, "FLAG_LOCKED");
      }

      const kv = await getKVBinding("FEATURE_FLAGS_KV");
      if (!kv) {
        return apiError(
          "Feature flag storage (FEATURE_FLAGS_KV) is not available in this environment.",
          503,
          "KV_UNAVAILABLE",
        );
      }

      try {
        await kv.put(definition.key, parsed.data.enabled ? "true" : "false");
      } catch (error) {
        logger.error("Failed to update feature flag in KV", {
          context: "super-admin-feature-flags",
          key: definition.key,
          error,
        });
        return apiError("Failed to update feature flag", 500, "KV_WRITE_FAILED");
      }
    } else {
      const supabase = createUntypedAdminClient("super_admin_feature_flags");
      const { data, error } = await supabase
        .from("ai_feature_toggles")
        .update({
          is_enabled: parsed.data.enabled,
          updated_at: new Date().toISOString(),
        })
        .eq("feature_key", parsed.data.key)
        .select("feature_key")
        .maybeSingle();

      if (error) {
        logger.error("Failed to update database-backed feature flag", {
          context: "super-admin-feature-flags",
          key: parsed.data.key,
          error: error.message,
        });
        return apiError("Failed to update feature flag", 500, "DB_WRITE_FAILED");
      }

      if (!data) {
        return apiValidationError("Unknown feature flag key");
      }
    }

    await logAuditEvent({
      supabase: auth.supabase,
      action: "feature_flag_updated",
      type: "config",
      clinicId: "system",
      actor: auth.profile.id,
      description: `Feature flag ${parsed.data.key} ${parsed.data.enabled ? "enabled" : "disabled"} by super_admin ${auth.profile.id}`,
      metadata: {
        key: parsed.data.key,
        enabled: parsed.data.enabled,
        source: definition ? "kv" : "db",
      },
    });

    return apiSuccess({
      key: parsed.data.key,
      enabled: parsed.data.enabled,
    });
  },
  ["super_admin"],
);
