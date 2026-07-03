/**
 * Admin AI Configuration API
 *
 * GET  — list provider configs, feature toggles, and usage stats
 * PATCH — update a provider config (API key, active state, budget)
 * POST — update feature toggles
 *
 * GET is readable by super_admin and clinic_admin, but the response is
 * role-scoped to prevent clinic admins from seeing platform financials:
 *
 *   super_admin  — full provider configs (budgets, usage, operational
 *                  metadata, has_api_key) + feature toggles + usage aggregates.
 *   clinic_admin — minimal provider listing (id, display_name, is_active,
 *                  routing_tier only; no budgets, costs, or key metadata) +
 *                  feature toggles. usage is always {}.
 *
 * Writes (PATCH/POST) stay super_admin only because provider configs and
 * feature toggles are platform-global, not per-clinic.
 *
 * API keys are encrypted with AES-256-GCM (PHI_ENCRYPTION_KEY)
 * before insert/update via `encryptProviderKey`. Keys are never returned in
 * the GET response — only a `has_api_key` boolean (super_admin only).
 *
 * Any write invalidates the in-memory config cache so the next /api/ai call
 * picks up the new state immediately on the same instance.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { invalidateConfigCache, invalidateFeatureToggleCache } from "@/lib/ai/config-cache";
import { encryptProviderKey, isProviderKeyEncrypted } from "@/lib/ai/secret-encryption";
import { apiSuccess, apiError, apiValidationError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { createUntypedAdminClient } from "@/lib/supabase-server";
import { withAuth } from "@/lib/with-auth";
import type { AuthContext } from "@/lib/with-auth";

// ── GET: List AI configs (role-scoped) ──

async function handleGet(_req: NextRequest, auth: AuthContext) {
  const supabase = createUntypedAdminClient("ai-config-list");
  const isClinicAdmin = auth.profile.role === "clinic_admin";

  // ── Feature toggles — returned to both roles ──
  const { data: toggles, error: toggleErr } = await supabase // nosemgrep: semgrep.tenant-scoping
    .from("ai_feature_toggles")
    .select("id, feature_key, display_name, description, is_enabled, min_tier")
    .order("feature_key");

  if (toggleErr && toggleErr.code !== "42P01" && !toggleErr.message?.includes("does not exist")) {
    logger.error("Failed to fetch AI feature toggles", {
      context: "ai-config",
      error: toggleErr.message,
    });
    return apiError("Failed to fetch feature toggles", 500);
  }

  // ── clinic_admin: minimal provider listing, no platform financials ──
  if (isClinicAdmin) {
    const { data: providers, error: provErr } = await supabase // nosemgrep: semgrep.tenant-scoping
      .from("ai_provider_configs")
      .select("id, provider, display_name, is_active, routing_tier")
      .order("routing_tier", { ascending: false });

    if (provErr) {
      if (provErr.code === "42P01" || provErr.message?.includes("does not exist")) {
        return apiSuccess({ providers: [], toggles: toggles ?? [], usage: {} });
      }
      logger.error("Failed to fetch AI provider configs", {
        context: "ai-config",
        error: provErr.message,
      });
      return apiError("Failed to fetch AI configurations", 500);
    }

    return apiSuccess({ providers: providers ?? [], toggles: toggles ?? [], usage: {} });
  }

  // ── super_admin: full response including platform financials ──
  const { data: providers, error: provErr } = await supabase // nosemgrep: semgrep.tenant-scoping
    .from("ai_provider_configs")
    .select(
      "id, provider, display_name, api_key_encrypted, is_active, routing_tier, fallback_provider, monthly_budget_cents, requests_this_month, tokens_this_month, input_tokens_this_month, output_tokens_this_month, cost_this_month_cents, rate_limited_until, last_error, last_used_at, created_at, updated_at",
    )
    .order("routing_tier", { ascending: false });

  if (provErr) {
    // Table may not exist yet if migration hasn't run
    if (provErr.code === "42P01" || provErr.message?.includes("does not exist")) {
      return apiSuccess({ providers: [], toggles: toggles ?? [], usage: {} });
    }
    logger.error("Failed to fetch AI provider configs", {
      context: "ai-config",
      error: provErr.message,
    });
    return apiError("Failed to fetch AI configurations", 500);
  }

  // Aggregate per-provider usage stats for the current month from logs.
  // Kept as a separate query so the admin UI's "this month" panel keeps
  // working as it did before.
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: usageLogs } = await supabase // nosemgrep: semgrep.tenant-scoping
    .from("ai_usage_logs")
    .select("provider, input_tokens, output_tokens, cost_cents, success")
    .gte("created_at", startOfMonth.toISOString());

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

  // Mask API keys — only expose presence + encryption status, never the value
  const maskedProviders = (providers ?? []).map((p: Record<string, unknown>) => {
    const stored = p.api_key_encrypted as string | null;
    return {
      ...p,
      has_api_key: !!stored,
      api_key_is_encrypted: isProviderKeyEncrypted(stored),
      api_key_encrypted: undefined,
    };
  });

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

  const patchSchema = z.object({
    provider: z.string({ message: "provider is required" }).min(1, "provider is required"),
    api_key: z.string().nullable().optional(),
    is_active: z.boolean().optional(),
    base_url: z.string().nullable().optional(),
    monthly_budget_cents: z.number().nonnegative().optional(),
    routing_tier: z.number().int().min(0).max(3).optional(),
  });

  const parsedResult = patchSchema.safeParse(body);
  if (!parsedResult.success) {
    return apiValidationError(parsedResult.error.issues[0].message);
  }
  const parsed = parsedResult.data;

  const provider = parsed.provider;
  const supabase = createUntypedAdminClient("ai-config-update");

  // Build update object — only include fields that were sent
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if ("api_key" in parsed) {
    const apiKey = parsed.api_key;
    // ENCRYPT the API key before storage. encryptProviderKey returns null
    // when the input is null/empty.
    update.api_key_encrypted = await encryptProviderKey(apiKey ?? null);
    if (!apiKey && provider !== "workers_ai") {
      update.is_active = false;
    }
  }

  if ("is_active" in parsed) {
    const isActive = parsed.is_active;
    if (isActive && provider !== "workers_ai") {
      const { data: existing } = await supabase // nosemgrep: semgrep.tenant-scoping
        .from("ai_provider_configs")
        .select("api_key_encrypted")
        .eq("provider", provider)
        .single();

      const hasKey =
        !!(existing?.api_key_encrypted as string | null) || !!("api_key" in parsed && parsed.api_key);
      if (!hasKey) {
        return apiError("Cannot activate provider without an API key", 400, "NO_API_KEY");
      }
    }
    update.is_active = isActive;
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

  // Invalidate the in-memory cache so the next /api/ai call on this instance
  // sees fresh state. Other instances will pick up the change after TTL.
  invalidateConfigCache();

  // Don't log which fields changed if the API key was rotated — keep that
  // out of structured logs entirely.
  const loggedFields = Object.keys(update).filter(
    (k) => k !== "updated_at" && k !== "api_key_encrypted",
  );
  const rotatedKey = "api_key" in body;

  logger.info("AI provider config updated", {
    context: "ai-config",
    provider,
    updatedFields: loggedFields,
    apiKeyRotated: rotatedKey,
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

  const postSchema = z.object({
    feature_key: z.string({ message: "feature_key is required" }),
    is_enabled: z.boolean({ message: "is_enabled is required" }),
  });

  const parsedResult = postSchema.safeParse(body);
  if (!parsedResult.success) {
    return apiValidationError(parsedResult.error.issues[0].message);
  }
  const parsed = parsedResult.data as Record<string, unknown>;

  const featureKey = parsed.feature_key as string | undefined;
  const isEnabled = parsed.is_enabled as boolean | undefined;

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

  invalidateFeatureToggleCache();

  return apiSuccess({ updated: true, feature_key: featureKey, is_enabled: isEnabled });
}

export const GET = withAuth((req, auth) => handleGet(req, auth), ["super_admin", "clinic_admin"]);

export const PATCH = withAuth((req, auth) => handlePatch(req, auth), ["super_admin"]);

export const POST = withAuth((req, auth) => handlePost(req, auth), ["super_admin"]);
