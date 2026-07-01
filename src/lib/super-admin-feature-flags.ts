import { isAiDisabledByEnv } from "@/lib/env";
import { getKVBinding } from "@/lib/features";
import { logger } from "@/lib/logger";
import { createUntypedAdminClient } from "@/lib/supabase-server";

type SuperAdminFeatureFlagCategory = "core" | "experimental" | "integration";
type SuperAdminFeatureFlagSource = "kv" | "db";

export interface SuperAdminFeatureFlag {
  key: string;
  enabled: boolean;
  description: string;
  category: SuperAdminFeatureFlagCategory;
  locked: boolean;
  lockedReason: string | null;
  source: SuperAdminFeatureFlagSource;
  displayName: string;
  minTier: number | null;
}

export interface SuperAdminFeatureFlagDefinition {
  key: string;
  displayName: string;
  description: string;
  category: SuperAdminFeatureFlagCategory;
  defaultEnabled: boolean;
  isLocked?: () => { locked: boolean; reason: string | null };
}

const FEATURE_FLAG_DEFINITIONS: readonly SuperAdminFeatureFlagDefinition[] = [
  {
    key: "ai.enabled",
    displayName: "Global AI Kill Switch",
    description: "Global kill switch for all AI features and provider spend.",
    category: "core",
    defaultEnabled: true,
    isLocked: () => {
      const locked = isAiDisabledByEnv();
      return {
        locked,
        reason: locked ? "Locked by AI_DISABLED environment override." : null,
      };
    },
  },
] as const;

export function getSuperAdminFeatureFlagDefinition(
  key: string,
): SuperAdminFeatureFlagDefinition | null {
  return FEATURE_FLAG_DEFINITIONS.find((flag) => flag.key === key) ?? null;
}

function categoryForAIToggle(featureKey: string): SuperAdminFeatureFlagCategory {
  if (featureKey.startsWith("support_")) return "integration";
  return "experimental";
}

export async function listSuperAdminFeatureFlags(): Promise<{
  flags: SuperAdminFeatureFlag[];
  kvAvailable: boolean;
}> {
  const kv = await getKVBinding("FEATURE_FLAGS_KV");
  const kvAvailable = !!kv;

  const kvFlags = await Promise.all(
    FEATURE_FLAG_DEFINITIONS.map(async (definition) => {
      const lockState = definition.isLocked?.() ?? { locked: false, reason: null };
      const storedValue = kv ? await kv.get(definition.key, { type: "text" }) : null;
      const kvEnabled =
        typeof storedValue === "string" ? storedValue !== "false" : definition.defaultEnabled;

      return {
        key: definition.key,
        enabled: lockState.locked ? false : kvEnabled,
        description: definition.description,
        category: definition.category,
        locked: lockState.locked,
        lockedReason: lockState.reason,
        source: "kv",
        displayName: definition.displayName,
        minTier: null,
      } satisfies SuperAdminFeatureFlag;
    }),
  );

  const supabase = createUntypedAdminClient("super_admin_feature_flags");
  const { data: aiToggles, error } = await supabase
    .from("ai_feature_toggles")
    .select("feature_key, display_name, description, is_enabled, min_tier")
    .order("feature_key");

  if (error) {
    if (error.code === "42P01" || error.message?.includes("does not exist")) {
      return { flags: kvFlags, kvAvailable };
    }

    logger.error("Failed to load AI feature toggles for super-admin flags page", {
      context: "super-admin-feature-flags",
      error: error.message,
    });
    throw error;
  }

  const dbFlags = (aiToggles ?? []).map((toggle) => ({
    key: toggle.feature_key as string,
    enabled: toggle.is_enabled as boolean,
    displayName: toggle.display_name as string,
    description:
      (toggle.description as string | null) ?? "AI feature toggle managed from platform settings.",
    category: categoryForAIToggle(toggle.feature_key as string),
    locked: false,
    lockedReason: null,
    source: "db" as const,
    minTier: Number(toggle.min_tier ?? 0),
  }));

  return { flags: [...kvFlags, ...dbFlags], kvAvailable };
}
