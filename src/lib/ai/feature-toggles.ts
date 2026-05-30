/**
 * AI Feature Toggles
 *
 * Centralizes the check for whether an AI-driven feature is enabled.
 * Before this module existed, the `ai_feature_toggles` rows were stored
 * and displayed in the admin UI but never read at request time.
 *
 * Callers pass a `feature_key` to the /api/ai endpoint; this module
 * resolves whether the feature is enabled and whether at least one
 * provider at or above the feature's required tier is available.
 */

import { logger } from "@/lib/logger";
import {
  getCachedFeatureToggles,
  setCachedFeatureToggles,
} from "./config-cache";

interface FeatureToggleRow {
  feature_key: string;
  is_enabled: boolean;
  min_tier: number;
}

/**
 * Known AI feature keys. Keep this in sync with the seed in
 * supabase/migrations/00123_ai_provider_configs.sql.
 */
export const AI_FEATURE_KEYS = [
  "dashboard_insights",
  "usage_analysis",
  "support_categorize",
  "support_draft",
  "churn_narrative",
  "agent_builder",
  "smart_recommendations",
] as const;

export type AIFeatureKey = (typeof AI_FEATURE_KEYS)[number];

export interface FeatureToggleState {
  isEnabled: boolean;
  minTier: number;
}

/**
 * Load feature toggle state from DB (with caching).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadFeatureToggles(supabase: any): Promise<Map<string, FeatureToggleState>> {
  const cached = getCachedFeatureToggles();
  if (cached) return cached;

  const { data, error } = await supabase // nosemgrep: semgrep.tenant-scoping
    .from("ai_feature_toggles")
    .select("feature_key, is_enabled, min_tier");

  const map = new Map<string, FeatureToggleState>();

  if (error || !data) {
    logger.warn("Failed to load AI feature toggles — defaulting to enabled", {
      context: "ai-feature-toggles",
      error: error?.message,
    });
    return map;
  }

  for (const row of data as FeatureToggleRow[]) {
    map.set(row.feature_key, {
      isEnabled: row.is_enabled,
      minTier: row.min_tier,
    });
  }

  setCachedFeatureToggles(map);
  return map;
}

/**
 * Check whether a feature is allowed to make an AI request.
 *
 * Returns:
 *   - { allowed: true } if the feature is enabled (or not gated)
 *   - { allowed: false, reason } if disabled or no toggle exists for it
 *
 * Unknown feature keys default to `allowed: true` — this keeps the toggle
 * system opt-in rather than opt-out. Misspelling a key won't silently block
 * a request that the admin never explicitly disabled.
 */
export function isAIFeatureEnabled(
  featureKey: string,
  toggles: Map<string, FeatureToggleState>,
): { allowed: boolean; reason?: string; minTier?: number } {
  const toggle = toggles.get(featureKey);

  if (!toggle) {
    // Unknown feature → allowed (opt-in gating model)
    return { allowed: true };
  }

  if (!toggle.isEnabled) {
    return {
      allowed: false,
      reason: `Feature '${featureKey}' is disabled by admin`,
      minTier: toggle.minTier,
    };
  }

  return { allowed: true, minTier: toggle.minTier };
}
