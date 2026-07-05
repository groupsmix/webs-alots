import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase-server";
import {
  buildPriceChanges,
  mapFeatureDefinition,
  mapPriceHistoryRows,
  mapPricingTierRow,
} from "@/lib/super-admin/helpers";
import type {
  FeatureDefinition,
  FeatureToggleRow,
  PriceHistoryEntry,
  PricingTierRow,
} from "@/lib/super-admin/types";

type SuperAdminClient = Awaited<ReturnType<typeof createClient>>;

export async function fetchFeatureDefinitionsImpl(
  supabase: SuperAdminClient,
): Promise<FeatureDefinition[]> {
  const { data, error } = await supabase
    .from("feature_definitions")
    .select("id, name, description, key, category, available_tiers, global_enabled")
    .order("name", { ascending: true });

  if (error || !data) return [];

  return data.map(mapFeatureDefinition);
}

export async function updateFeatureDefinitionImpl(
  supabase: SuperAdminClient,
  featureId: string,
  updates: { globalEnabled?: boolean; availableTiers?: string[] },
): Promise<void> {
  const payload: { global_enabled?: boolean; available_tiers?: string[] } = {};
  if (updates.globalEnabled !== undefined) payload.global_enabled = updates.globalEnabled;
  if (updates.availableTiers !== undefined) payload.available_tiers = updates.availableTiers;
  if (Object.keys(payload).length === 0) return;

  const { data: existing } = await supabase
    .from("feature_definitions")
    .select("id, name")
    .eq("id", featureId)
    .single();

  const { error } = await supabase.from("feature_definitions").update(payload).eq("id", featureId);
  if (error) throw new Error(`Failed to update feature definition: ${error.message}`);

  try {
    await supabase // nosemgrep: semgrep.tenant-scoping — global super-admin audit event (feature catalogue is platform-wide, no clinic context)
      .from("activity_logs")
      .insert({
        action: "feature_definition_updated",
        description: `Feature "${existing?.name ?? featureId}" updated`,
        type: "feature",
        timestamp: new Date().toISOString(),
      });
  } catch (err) {
    logger.warn("Non-blocking audit log failed", {
      context: "super-admin-actions",
      featureId,
      error: err,
    });
  }
}

export async function bulkSetFeatureTierImpl(
  supabase: SuperAdminClient,
  tier: string,
  enabled: boolean,
): Promise<void> {
  const { data: rows, error: readError } = await supabase
    .from("feature_definitions")
    .select("id, available_tiers");
  if (readError) throw new Error(`Failed to read feature definitions: ${readError.message}`);
  if (!rows) return;

  for (const row of rows) {
    const current: string[] = row.available_tiers ?? [];
    const has = current.includes(tier);
    if (enabled === has) continue;

    const next = enabled ? [...current, tier] : current.filter((value) => value !== tier);
    const { error } = await supabase
      .from("feature_definitions")
      .update({ available_tiers: next })
      .eq("id", row.id);

    if (error) throw new Error(`Failed to update feature ${row.id}: ${error.message}`);
  }

  try {
    await supabase // nosemgrep: semgrep.tenant-scoping — global super-admin audit event (feature catalogue is platform-wide, no clinic context)
      .from("activity_logs")
      .insert({
        action: "feature_tier_bulk_update",
        description: `All features ${enabled ? "enabled" : "disabled"} for tier "${tier}"`,
        type: "feature",
        timestamp: new Date().toISOString(),
      });
  } catch (err) {
    logger.warn("Non-blocking audit log failed", {
      context: "super-admin-actions",
      tier,
      error: err,
    });
  }
}

export async function fetchPricingTiersImpl(supabase: SuperAdminClient): Promise<PricingTierRow[]> {
  const { data, error } = await supabase
    .from("pricing_tiers")
    .select("id, slug, name, description, is_popular, pricing, features, limits, created_at")
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return data.map(mapPricingTierRow);
}

export async function updatePricingTierImpl(
  supabase: SuperAdminClient,
  tierId: string,
  updates: {
    name?: string;
    pricing?: Record<string, { monthly: number; yearly: number }>;
    features?: { key: string; label: string; included: boolean; limit?: string }[];
  },
): Promise<void> {
  const payload: {
    name?: string;
    pricing?: Record<string, { monthly: number; yearly: number }>;
    features?: { key: string; label: string; included: boolean; limit?: string }[];
  } = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.pricing !== undefined) payload.pricing = updates.pricing;
  if (updates.features !== undefined) payload.features = updates.features;
  if (Object.keys(payload).length === 0) return;

  const { data: existing } = await supabase
    .from("pricing_tiers")
    .select("id, name, pricing")
    .eq("id", tierId)
    .single();

  const { error } = await supabase.from("pricing_tiers").update(payload).eq("id", tierId);
  if (error) throw new Error(`Failed to update pricing tier: ${error.message}`);

  const priceChanges = buildPriceChanges(
    (existing?.pricing as Record<string, { monthly: number; yearly: number }> | null) ?? {},
    updates.pricing,
  );

  try {
    await supabase // nosemgrep: semgrep.tenant-scoping — global super-admin audit event (pricing catalogue is platform-wide, no clinic context)
      .from("activity_logs")
      .insert({
        action: "pricing_tier_updated",
        description: `Pricing tier "${existing?.name ?? tierId}" updated`,
        type: "billing",
        timestamp: new Date().toISOString(),
        metadata: {
          tierId,
          ...(updates.pricing ? { pricing: updates.pricing, priceChanges } : {}),
        },
      });
  } catch (err) {
    logger.warn("Non-blocking audit log failed", {
      context: "super-admin-actions",
      tierId,
      error: err,
    });
  }
}

export async function fetchPriceHistoryImpl(
  supabase: SuperAdminClient,
): Promise<PriceHistoryEntry[]> {
  const { data, error } = await supabase
    .from("activity_logs")
    .select("timestamp, metadata, description")
    .eq("action", "pricing_tier_updated")
    .order("timestamp", { ascending: false })
    .limit(50);

  if (error || !data) return [];

  return mapPriceHistoryRows(data);
}

export async function fetchFeatureTogglesImpl(
  supabase: SuperAdminClient,
): Promise<FeatureToggleRow[]> {
  const { data, error } = await supabase
    .from("feature_toggles")
    .select("id, key, label, description, category, system_types, tiers, enabled, created_at")
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    key: row.key ?? "",
    label: row.label ?? "",
    description: row.description ?? "",
    category: (row.category ?? "core") as FeatureToggleRow["category"],
    systemTypes: row.system_types ?? [],
    tiers: row.tiers ?? [],
    enabled: row.enabled ?? true,
  }));
}
