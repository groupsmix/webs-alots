/**
 * Shared AI configuration — centralises kill-switch, URL allowlist,
 * model version pinning, and disclaimer injection.
 *
 * Task A1 (unified config): `resolveAIConfig()` is a thin compatibility
 * wrapper over the DB-backed router. Provider/model selection delegates to
 * `loadProviderConfigs()` + `selectAvailableProvider()` — the exact ordering
 * and availability rules `routeAIRequest()` uses (admin routing tier, active
 * flag, monthly budget ceiling, persisted 429 cooldowns). There is no longer
 * a parallel env-driven resolution path: the `OPENAI_API_KEY` environment
 * variable is registered as a fallback credential for the `openai` provider
 * when the admin has not configured a usable key in `ai_provider_configs`.
 *
 * Because legacy callers POST raw OpenAI wire format to
 * `${baseUrl}/chat/completions`, only providers with OpenAI-compatible
 * endpoints are eligible here (see OPENAI_COMPAT_BASE_URLS in models.ts).
 * `anthropic`/`google` remain reachable through `routeAIRequest()` and join
 * the unified path with the AI SDK migration (Task A3).
 *
 * Findings addressed:
 *   F-AI-01: Kill switch enforcement across all AI routes
 *   F-AI-05: Base-URL allowlist (prevents operator-overridable exfil)
 *   F-AI-07 / W8-S-03: Model version pinning via the shared allowlist
 *   F-AI-14: Per-request seed for reproducibility
 *   F-A199:  AI medical-advice disclaimer in response payloads
 */

import {
  assertAICircuitBreakerAllowsRequests,
  getAICircuitBreakerSnapshot,
} from "@/lib/ai/circuit-breaker";
import { AI_DISCLAIMER_FR } from "@/lib/ai-disclaimer";
import { isAIEnabled } from "@/lib/features";
import { logger } from "@/lib/logger";
import { createUntypedAdminClient } from "@/lib/supabase-server";
import {
  ALLOWED_MODELS,
  OPENAI_COMPAT_BASE_URLS,
  PROVIDER_MODELS,
  resolveModelAlias,
} from "./models";
import { loadProviderConfigs, selectAvailableProvider } from "./router";
import type { AIProvider, ProviderConfig } from "./types";

// ── URL Allowlist (F-AI-05) ──

/**
 * Only these base URLs are permitted for OpenAI-compatible chat calls.
 * Prevents an operator from redirecting AI calls to a rogue endpoint
 * that could exfiltrate PHI sent in prompts. Seeded from the single
 * provider registry so the allowlist cannot drift from the router.
 */
const ALLOWED_AI_BASE_URLS = new Set<string>([
  "https://api.openai.com",
  ...Object.values(OPENAI_COMPAT_BASE_URLS),
]);

// W8-S-02: Pin Azure OpenAI to an explicit resource name rather than
// accepting any *.openai.azure.com subdomain. Set AZURE_OPENAI_RESOURCE_NAME
// in env (e.g. "oltigo-prod") to allowlist only that resource.
function isAllowedBaseUrl(url: string): boolean {
  if (ALLOWED_AI_BASE_URLS.has(url)) return true;
  // Workers AI OpenAI-compatible endpoint
  if (url.startsWith("https://api.cloudflare.com/client/v4/accounts/") && url.endsWith("/ai/v1"))
    return true;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith(".openai.azure.com")) {
      // nosemgrep: semgrep.env-access — pinned Azure resource name, validated at boot
      const resourceName = process.env.AZURE_OPENAI_RESOURCE_NAME;
      if (!resourceName) return false;
      const expected = `${resourceName}.openai.azure.com`;
      return parsed.hostname === expected;
    }
  } catch {
    return false;
  }
  return false;
}

// ── Pinned Model Version (F-AI-07) ──

/**
 * Default model for the legacy OpenAI path (Task A2: reconciled with the
 * router's registry default — single source of truth in models.ts).
 */
const DEFAULT_MODEL = PROVIDER_MODELS.openai.model;

const NOT_CONFIGURED_REASON =
  "AI service not configured. Set OPENAI_API_KEY or configure a provider in the admin dashboard.";

// ── Public API ──

export interface AIConfig {
  /** Provider the unified router selected for this request. */
  provider: AIProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  /** F-AI-14: Per-request seed for reproducibility. Log with audit events. */
  seed: number;
}

/**
 * Resolve and validate AI configuration.
 *
 * Resolution order (single path — Task A1):
 *   1. F-AI-01: Global kill-switch (KV + env)
 *   2. Load provider configs from `ai_provider_configs` via the router's
 *      `loadProviderConfigs()` (30s cache). On DB failure, continue with an
 *      empty set so the env fallback below still works.
 *   3. Register `OPENAI_API_KEY` as the `openai` provider's fallback
 *      credential when no usable admin-managed key exists.
 *   4. `selectAvailableProvider()` picks the best available
 *      OpenAI-wire-compatible provider using the router's tier/budget/
 *      cooldown rules. Workers AI stays the always-last free fallback.
 *   5. F-AI-05 base-URL allowlist + F-AI-07/W8-S-03 model allowlist
 *      validation on the selected provider.
 */
export async function resolveAIConfig(): Promise<
  { ok: true; config: AIConfig } | { ok: false; reason: string; statusCode: number }
> {
  // F-AI-01: Kill switch
  if (!(await isAIEnabled())) {
    return { ok: false, reason: "AI features are disabled", statusCode: 503 };
  }

  const circuit = await assertAICircuitBreakerAllowsRequests();
  if (!circuit.ok) {
    return { ok: false, reason: circuit.reason, statusCode: circuit.statusCode };
  }

  const configs = await loadEffectiveConfigs();

  // One selection path: same rules as routeAIRequest(), restricted to
  // providers the legacy OpenAI-wire-format callers can actually talk to.
  const provider = selectAvailableProvider(
    configs,
    (p) => p === "workers_ai" || p in OPENAI_COMPAT_BASE_URLS,
  );

  if (!provider) {
    return { ok: false, reason: NOT_CONFIGURED_REASON, statusCode: 503 };
  }

  return buildProviderConfig(provider, configs);
}

/**
 * Load admin-managed provider configs and overlay the environment fallback.
 *
 * The returned map is a copy — never mutate the router's shared 30s cache.
 */
async function loadEffectiveConfigs(): Promise<Map<AIProvider, ProviderConfig>> {
  let configs: Map<AIProvider, ProviderConfig>;
  try {
    const supabase = createUntypedAdminClient("ai-config-resolve");
    configs = await loadProviderConfigs(supabase);
  } catch (err) {
    logger.warn("Failed to load AI provider configs from database, using env fallback", {
      context: "ai-config",
      error: err instanceof Error ? err.message : String(err),
    });
    configs = new Map();
  }

  const effective = new Map(configs);

  // Router-registered provider credential fallback: when the admin has not
  // configured a usable OpenAI key, the environment key keeps legacy
  // deployments working. This is the only place the env secret is read.
  const dbOpenAI = effective.get("openai");
  if (!dbOpenAI?.isActive || !dbOpenAI.apiKey) {
    // nosemgrep: semgrep.env-access — secret read at runtime; registered as the openai provider's fallback credential
    const envKey = process.env.OPENAI_API_KEY;
    if (envKey) {
      effective.set("openai", {
        provider: "openai",
        displayName: dbOpenAI?.displayName ?? "OpenAI (env fallback)",
        apiKey: envKey,
        isActive: true,
        routingTier: dbOpenAI?.routingTier ?? 0,
        fallbackProvider: dbOpenAI?.fallbackProvider ?? null,
        monthlyBudgetCents: dbOpenAI?.monthlyBudgetCents ?? 0,
        requestsThisMonth: dbOpenAI?.requestsThisMonth ?? 0,
        tokensThisMonth: dbOpenAI?.tokensThisMonth ?? 0,
        inputTokensThisMonth: dbOpenAI?.inputTokensThisMonth ?? 0,
        outputTokensThisMonth: dbOpenAI?.outputTokensThisMonth ?? 0,
        costThisMonthCents: dbOpenAI?.costThisMonthCents ?? 0,
        rateLimitedUntil: dbOpenAI?.rateLimitedUntil ?? null,
        lastError: dbOpenAI?.lastError ?? null,
      });
    }
  }

  return effective;
}

/** Build the validated AIConfig for the provider the router selected. */
function buildProviderConfig(
  provider: AIProvider,
  configs: Map<AIProvider, ProviderConfig>,
): { ok: true; config: AIConfig } | { ok: false; reason: string; statusCode: number } {
  // F-AI-14: Per-request seed for OpenAI-compatible reproducibility.
  // Callers should pass this as `seed` in the API request and log it in
  // audit events so any problematic output can be reproduced.
  const seed = Date.now();

  if (provider === "workers_ai") {
    // Free always-last fallback via the Workers AI OpenAI-compatible endpoint.
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID; // nosemgrep: semgrep.env-access — runtime cred for Workers AI fallback
    const aiToken = process.env.CLOUDFLARE_AI_API_TOKEN ?? process.env.CLOUDFLARE_AI_TOKEN; // nosemgrep: semgrep.env-access — runtime cred for Workers AI fallback
    if (!accountId || !aiToken) {
      // selectAvailableProvider() only returns workers_ai when configured;
      // this guards against env changes between check and build.
      return { ok: false, reason: NOT_CONFIGURED_REASON, statusCode: 503 };
    }
    logger.debug("AI config resolved (workers_ai fallback)", { context: "ai-config" });
    return {
      ok: true,
      config: {
        provider,
        apiKey: aiToken,
        baseUrl: `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`,
        model: PROVIDER_MODELS.workers_ai.model,
        seed,
      },
    };
  }

  const config = configs.get(provider);
  if (!config?.apiKey) {
    return { ok: false, reason: NOT_CONFIGURED_REASON, statusCode: 503 };
  }

  // Base URL comes from the single registry. The OPENAI_BASE_URL override is
  // kept for the openai provider (Azure / approved proxy deployments) and
  // remains allowlist-validated (F-AI-05).
  let baseUrl = OPENAI_COMPAT_BASE_URLS[provider];
  if (provider === "openai") {
    // nosemgrep: semgrep.env-access — operator-configurable base URL, validated below
    baseUrl = process.env.OPENAI_BASE_URL || baseUrl;
  }
  if (!baseUrl || !isAllowedBaseUrl(baseUrl)) {
    logger.error("AI base URL is not in the allowlist", {
      context: "ai-config",
      provider,
      baseUrl,
    });
    return { ok: false, reason: "AI service configuration error", statusCode: 500 };
  }

  // F-AI-07 / W8-S-03: Model pinning against the generated allowlist.
  // Rejects floating aliases and models outside the single registry.
  let model: string | undefined = PROVIDER_MODELS[provider]?.model;
  if (provider === "openai") {
    // nosemgrep: semgrep.env-access — operator-configurable model, validated below against allowlist
    model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  }
  // Task A2: a stale-but-previously-valid operator pin auto-resolves to its
  // current replacement (with a warning) instead of 404ing at the provider.
  // Never-allowed floating aliases are not in the map and still fail below.
  if (model) {
    const resolution = resolveModelAlias(model);
    if (resolution.deprecated) {
      logger.warn("Deprecated AI model auto-resolved to its replacement", {
        context: "ai-config",
        provider,
        original: resolution.original,
        model: resolution.model,
      });
    }
    model = resolution.model;
  }
  if (!model || !ALLOWED_MODELS.has(model)) {
    logger.error("AI model is not in the allowlist", {
      context: "ai-config",
      provider,
      model,
    });
    return { ok: false, reason: "AI model configuration error", statusCode: 500 };
  }

  logger.debug("AI config resolved", { context: "ai-config", provider, model });
  return { ok: true, config: { provider, apiKey: config.apiKey, baseUrl, model, seed } };
}

export async function getAIAvailabilityStatus(): Promise<{
  enabled: boolean;
  circuit: Awaited<ReturnType<typeof getAICircuitBreakerSnapshot>>;
}> {
  const [enabled, circuit] = await Promise.all([isAIEnabled(), getAICircuitBreakerSnapshot()]);
  return { enabled, circuit };
}

/**
 * F-A199 / A109-01: Standard disclaimer is now served via `getAIDisclaimer()`
 * from `@/lib/ai-disclaimer`. All AI routes include it in their responses.
 * This const is retained for backwards compatibility with any consumer that
 * may import it via the config module.
 */
export const AI_RESPONSE_DISCLAIMER = {
  disclaimer: AI_DISCLAIMER_FR,
  aiGenerated: true,
} as const;

/**
 * A200: Log when AI processes data for a minor patient.
 *
 * Clinical AI (summaries, prescriptions, drug checks) is permitted for
 * minors under medical-necessity, but behavioural profiling is blocked.
 * Every invocation is logged for GDPR-K / Law 09-08 audit trail.
 */
export function logMinorAIProcessing(patientId: string, clinicId: string, feature: string): void {
  logger.info("ai.minor_patient_processing", {
    context: "ai-minor-guard",
    patientId,
    clinicId,
    feature,
    note: "Clinical AI permitted under medical-necessity; no behavioural profiling applied",
  });
}
