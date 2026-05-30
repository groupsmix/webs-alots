/**
 * Admin AI Configuration API
 *
 * GET  — list all provider configs, feature toggles, and usage stats
 * PATCH — update a provider config (API key, active state, budget)
 * POST — update feature toggles
 *
 * Super admin only. API keys are stored encrypted in the database.
 * Keys without a value auto-disable the provider.
 */

import { NextRequest } from "next/server";
import { apiSuccess, apiError, apiValidationError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { createUntypedAdminClient } from "@/lib/supabase-server";
import { withAuth } from "@/lib/with-auth";
import type { AuthContext } from "@/lib/with-auth";

// ── GET: List all AI configs ──

async function handleGet(_req: NextRequest, _auth: AuthContext) {
  const supabase = createUntypedAdminClient("ai-config-list");

  const { data: providers, error: provErr } = await supabase // nosemgrep: semgrep.tenant-scoping
    .from("ai_provider_configs")
    .select(
      "id, provider, display_name, is_active, routing_tier, fallback_provider, monthly_budget_cents, requests_this_month, tokens_this_month, last_error, last_used_at, created_at, updated_at",
    )
    .order("routing_tier", { ascending: true });

  if (provErr) {
    logger.error("Failed to fetch AI provider configs", {
      context: "ai-config",
      error: provErr.message,
    });
    return apiError("Failed to fetch AI configurations", 500);
  }

  const { data: toggles, error: toggleErr } = await supabase // nosemgrep: semgrep.tenant-scoping
    .from("ai_feature_toggles")
    .select("id, feature_key, display_name, description, is_enabled, min_tier")
    .order("feature_key");

  if (toggleErr) {
    logger.error("Failed to fetch AI feature toggles", {
      context: "ai-config",
      error: toggleErr.message,
    });
    return apiError("Failed to fetch feature toggles", 500);
  }

  // Get usage stats for current month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: usageLogs } = await supabase // nosemgrep: semgrep.tenant-scoping
    .from("ai_usage_logs")
    .select("provider, input_tokens, output_tokens, cost_cents, success")
    .gte("created_at", startOfMonth.toISOString());

  // Aggregate usage per provider
  const usageByProvider: Record<
    string,
    { requests: number; tokens: number; costCents: number; errors: number }
  > = {};

  if (usageLogs) {
    for (const log of usageLogs) {
      const p = log.provider as string;
      if (!usageByProvider[p]) {
        usageByProvider[p] = { requests: 0, tokens: 0, costCents: 0, errors: 0 };
      }
      usageByProvider[p].requests++;
      usageByProvider[p].tokens += (log.input_tokens as number) + (log.output_tokens as number);
      usageByProvider[p].costCents += Number(log.cost_cents);
      if (!(log.success as boolean)) usageByProvider[p].errors++;
    }
  }

  // Mask API keys — only show whether they exist
  const maskedProviders = (providers ?? []).map((p: Record<string, unknown>) => ({
    ...p,
    has_api_key: !!(p.api_key_encrypted as string | null),
    api_key_encrypted: undefined,
  }));

  return apiSuccess({
    providers: maskedProviders,
    toggles: toggles ?? [],
    usage: usageByProvider,
  });
}

// ── PATCH: Update provider config ──

async function handlePatch(req: NextRequest, auth: AuthContext) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiValidationError("Invalid JSON body");
  }

  const provider = body.provider as string | undefined;
  if (!provider) {
    return apiValidationError("provider is required");
  }

  const supabase = createUntypedAdminClient("ai-config-update");

  // Build update object — only include fields that were sent
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if ("api_key" in body) {
    const apiKey = body.api_key as string | null;
    update.api_key_encrypted = apiKey || null;
    // Auto-disable if key removed (except workers_ai)
    if (!apiKey && provider !== "workers_ai") {
      update.is_active = false;
    }
  }

  if ("is_active" in body) {
    const isActive = body.is_active as boolean;
    // Can't activate without an API key (except workers_ai)
    if (isActive && provider !== "workers_ai") {
      const { data: existing } = await supabase // nosemgrep: semgrep.tenant-scoping
        .from("ai_provider_configs")
        .select("api_key_encrypted")
        .eq("provider", provider)
        .single();

      const hasKey =
        !!(existing?.api_key_encrypted as string | null) || !!("api_key" in body && body.api_key);
      if (!hasKey) {
        return apiError("Cannot activate provider without an API key", 400, "NO_API_KEY");
      }
    }
    update.is_active = isActive;
  }

  if ("monthly_budget_cents" in body) {
    const budget = body.monthly_budget_cents as number;
    if (typeof budget !== "number" || budget < 0) {
      return apiValidationError("monthly_budget_cents must be a non-negative number");
    }
    update.monthly_budget_cents = budget;
  }

  if ("routing_tier" in body) {
    const tier = body.routing_tier as number;
    if (typeof tier !== "number" || tier < 0 || tier > 3) {
      return apiValidationError("routing_tier must be 0-3");
    }
    update.routing_tier = tier;
  }

  const { error } = await supabase // nosemgrep: semgrep.tenant-scoping
    .from("ai_provider_configs")
    .update(update)
    .eq("provider", provider);

  if (error) {
    logger.error("Failed to update AI provider config", {
      context: "ai-config",
      provider,
      error: error.message,
    });
    return apiError("Failed to update configuration", 500);
  }

  logger.info("AI provider config updated", {
    context: "ai-config",
    provider,
    updatedFields: Object.keys(update).filter((k) => k !== "updated_at"),
    updatedBy: auth.user.id,
  });

  return apiSuccess({ updated: true, provider });
}

// ── POST: Update feature toggles ──

async function handlePost(req: NextRequest, _auth: AuthContext) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiValidationError("Invalid JSON body");
  }

  const featureKey = body.feature_key as string | undefined;
  const isEnabled = body.is_enabled as boolean | undefined;

  if (!featureKey || typeof isEnabled !== "boolean") {
    return apiValidationError("feature_key (string) and is_enabled (boolean) are required");
  }

  const supabase = createUntypedAdminClient("ai-feature-toggle");

  const { error } = await supabase // nosemgrep: semgrep.tenant-scoping
    .from("ai_feature_toggles")
    .update({ is_enabled: isEnabled, updated_at: new Date().toISOString() })
    .eq("feature_key", featureKey);

  if (error) {
    logger.error("Failed to update AI feature toggle", {
      context: "ai-config",
      featureKey,
      error: error.message,
    });
    return apiError("Failed to update feature toggle", 500);
  }

  return apiSuccess({ updated: true, feature_key: featureKey, is_enabled: isEnabled });
}

export const GET = withAuth((req, auth) => handleGet(req, auth), ["super_admin"]);

export const PATCH = withAuth((req, auth) => handlePatch(req, auth), ["super_admin"]);

export const POST = withAuth((req, auth) => handlePost(req, auth), ["super_admin"]);
