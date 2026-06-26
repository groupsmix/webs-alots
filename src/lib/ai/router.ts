/**
 * AI Router — Smart model selection with auto-fallback.
 *
 * Rules:
 *   1. Best model first — order driven by the `routing_tier` column the
 *      admin sets in the settings UI (no longer hardcoded).
 *   2. No API key = auto-disabled (skipped in routing).
 *   3. Deactivated by admin = skipped.
 *   4. Rate-limited (persisted in DB) or over budget = skipped, try next.
 *   5. Workers AI is ALWAYS the last resort — free, but still requires
 *      `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_AI_API_TOKEN` to be set.
 *   6. Runtime errors trigger immediate fallback to next provider.
 *
 * Config loading is cached for 30s to keep /api/ai latency low.
 * Per-provider monthly cost uses the actual `cost_this_month_cents`
 * column (not a quadratic estimate of token counts).
 */

import { getWorkerBinding } from "@/lib/cf-bindings";
import { logger } from "@/lib/logger";
import { getCachedConfigs, invalidateConfigCache, setCachedConfigs } from "./config-cache";
import { PROVIDER_MODELS, PROVIDER_PRIORITY, RATE_LIMIT_WINDOW_MS } from "./models";
import { callProvider, ProviderError, RateLimitError } from "./providers";
import { decryptProviderKey } from "./secret-encryption";
import { getTaskPin, type TaskPin } from "./task-config";
import { checkFallbackAlert, recordAITrace, traceFromFailure, traceFromSuccess } from "./tracing";
import type { AIProvider, AIRequest, AIResponse, ProviderConfig, RateLimitState } from "./types";

// ── In-memory rate-limit window (request counting) ──
// The DB column `rate_limited_until` handles persistent cooldown across
// invocations (set when a provider returns 429). The in-memory counter
// here only enforces our own RPM caps within a single instance, as a
// defensive guard against accidental DoS of a provider; the source of
// truth for "is this provider currently 429'd" is the DB.

const rateLimitStates = new Map<AIProvider, RateLimitState>();

function getRateLimitState(provider: AIProvider): RateLimitState {
  const existing = rateLimitStates.get(provider);
  if (existing && Date.now() <= existing.windowResetAt) {
    return existing;
  }
  const fresh: RateLimitState = {
    provider,
    requestsInWindow: 0,
    windowResetAt: Date.now() + RATE_LIMIT_WINDOW_MS,
    isRateLimited: false,
    retryAfterMs: 0,
  };
  rateLimitStates.set(provider, fresh);
  return fresh;
}

function incrementRequests(provider: AIProvider): void {
  const state = getRateLimitState(provider);
  state.requestsInWindow++;
  const modelConfig = PROVIDER_MODELS[provider];
  if (modelConfig && state.requestsInWindow >= modelConfig.rpmLimit) {
    state.isRateLimited = true;
    state.windowResetAt = Date.now() + RATE_LIMIT_WINDOW_MS;
  }
  rateLimitStates.set(provider, state);
}

function markRateLimitedInMemory(provider: AIProvider, retryAfterMs: number): void {
  const state = getRateLimitState(provider);
  state.isRateLimited = true;
  state.retryAfterMs = retryAfterMs;
  state.windowResetAt = Date.now() + retryAfterMs;
  rateLimitStates.set(provider, state);
}

/** Persist a rate-limit cooldown across serverless invocations. */
async function persistRateLimit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  provider: AIProvider,
  retryAfterMs: number,
): Promise<void> {
  const until = new Date(Date.now() + retryAfterMs).toISOString();
  try {
    await supabase.rpc("mark_provider_rate_limited", {
      p_provider: provider,
      p_until: until,
    });
    invalidateConfigCache();
  } catch (err) {
    logger.warn("Failed to persist rate-limit state", {
      context: "ai-router",
      provider,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ── Workers AI environment check ──
// The "always available" fallback isn't actually available if the Cloudflare
// credentials aren't configured. Check at availability-check time, not just
// when the call is attempted, so the router can skip it cleanly.
//
// IMPORTANT: In the Cloudflare Workers runtime (via @opennextjs/cloudflare),
// secrets are stored on getCloudflareContext().env, NOT on process.env.
// Using process.env for secrets always returns undefined in production,
// causing isWorkersAIConfigured() to return false and silently disabling
// the Workers AI fallback for every request. Use getWorkerBinding() instead.

async function isWorkersAIConfigured(): Promise<boolean> {
  // Try CF binding context first (production Workers runtime)
  const accountId = await getWorkerBinding<string>("CLOUDFLARE_ACCOUNT_ID")
    // nosemgrep: semgrep.env-access — fallback for local dev / non-CF runtimes
    ?? process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken =
    (await getWorkerBinding<string>("CLOUDFLARE_AI_API_TOKEN"))
    // nosemgrep: semgrep.env-access — fallback for local dev / non-CF runtimes
    ?? (await getWorkerBinding<string>("CLOUDFLARE_AI_TOKEN"))
    ?? process.env.CLOUDFLARE_AI_API_TOKEN
    ?? process.env.CLOUDFLARE_AI_TOKEN;
  return !!accountId && !!apiToken;
}

// ── Provider availability check ──

interface ProviderAvailability {
  available: boolean;
  reason?: string;
}

async function checkProviderAvailable(
  provider: AIProvider,
  configs: Map<AIProvider, ProviderConfig>,
): Promise<ProviderAvailability> {
  if (provider === "workers_ai") {
    if (!(await isWorkersAIConfigured())) {
      return { available: false, reason: "cloudflare_not_configured" };
    }
    return { available: true };
  }

  const config = configs.get(provider);

  if (!config) return { available: false, reason: "not_configured" };
  if (!config.isActive) return { available: false, reason: "deactivated" };
  if (!config.apiKey) return { available: false, reason: "no_api_key" };

  // Budget check uses the real cost_this_month_cents, not an estimate.
  if (config.monthlyBudgetCents > 0 && config.costThisMonthCents >= config.monthlyBudgetCents) {
    return { available: false, reason: "budget_exceeded" };
  }

  // Persistent rate limit (set by a previous 429)
  if (config.rateLimitedUntil && config.rateLimitedUntil > Date.now()) {
    return { available: false, reason: "rate_limited_persisted" };
  }

  // In-memory rate limit (this instance's window counter)
  const rlState = getRateLimitState(provider);
  if (rlState.isRateLimited && Date.now() < rlState.windowResetAt) {
    return { available: false, reason: "rate_limited" };
  }

  return { available: true };
}

// ── Dynamic priority by routing_tier ──
// Higher routing_tier = better model. Within the same tier, fall back to
// the hardcoded PROVIDER_PRIORITY (which roughly matches model quality).

function buildPriorityList(configs: Map<AIProvider, ProviderConfig>): AIProvider[] {
  const sorted = [...PROVIDER_PRIORITY].sort((a, b) => {
    const tierA = configs.get(a)?.routingTier ?? -1;
    const tierB = configs.get(b)?.routingTier ?? -1;
    if (tierA !== tierB) return tierB - tierA; // higher tier first
    return PROVIDER_PRIORITY.indexOf(a) - PROVIDER_PRIORITY.indexOf(b);
  });

  // Workers AI always last regardless of tier — it's the free safety net
  return [...sorted.filter((p) => p !== "workers_ai"), "workers_ai"];
}

/**
 * Select the first available provider in routing-tier order — the exact
 * ordering and availability rules `routeAIRequest()` applies (admin tier,
 * active flag, API key presence, monthly budget ceiling, persisted and
 * in-memory rate-limit cooldowns).
 *
 * Task A1: exported so the legacy `resolveAIConfig()` compatibility wrapper
 * resolves through this single path instead of maintaining a parallel
 * selection system. `isEligible` lets callers restrict candidates (e.g. to
 * OpenAI-wire-compatible providers).
 */
export async function selectAvailableProvider(
  configs: Map<AIProvider, ProviderConfig>,
  isEligible: (provider: AIProvider) => boolean = () => true,
): Promise<AIProvider | null> {
  for (const provider of buildPriorityList(configs)) {
    if (!isEligible(provider)) continue;
    if ((await checkProviderAvailable(provider, configs)).available) return provider;
  }
  return null;
}

// ── Router ──

export async function routeAIRequest(
  request: AIRequest,
  configs: Map<AIProvider, ProviderConfig>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase?: any,
): Promise<AIResponse> {
  // F-AI-14 / AUDIT P1-11: default a reproducibility seed so every routed
  // request is replayable. It is passed to the provider (providers.ts) and
  // logged with the success log line below.
  if (request.seed === undefined) {
    request = { ...request, seed: Date.now() };
  }

  if (request.forceProvider) {
    return tryProviderWithFallback(request, request.forceProvider, configs, supabase);
  }

  const startTime = Date.now();
  const errors: string[] = [];
  const fallbackChain: Array<{ provider: string; error?: string }> = [];
  let fromFallback = false;

  // Per-task pin (dashboard-managed, ai_task_configs): the pinned provider
  // is tried FIRST, but the normal priority order stays as fallback — a pin
  // must never reduce availability. Fail-open: any error here means auto.
  let taskPin: TaskPin | null = null;
  try {
    taskPin = await getTaskPin(request.task, supabase);
  } catch {
    taskPin = null;
  }

  const priority = buildPriorityList(configs);
  if (taskPin?.provider) {
    const idx = priority.indexOf(taskPin.provider);
    if (idx > 0) {
      priority.splice(idx, 1);
      priority.unshift(taskPin.provider);
    }
    logger.debug("Task pin applied", {
      context: "ai-router",
      task: request.task,
      pinnedProvider: taskPin.provider,
      pinnedModel: taskPin.model ?? "(provider default)",
    });
  }

  for (const provider of priority) {
    const availability = await checkProviderAvailable(provider, configs);

    if (!availability.available) {
      logger.debug("AI provider skipped", {
        context: "ai-router",
        provider,
        reason: availability.reason,
      });
      continue;
    }

    try {
      const config = configs.get(provider);
      const apiKey = provider === "workers_ai" ? null : (config?.apiKey ?? null);
      const providerStart = Date.now();
      // Apply the task's model pin only when calling the pinned provider —
      // fallback providers always use their own registry default.
      const modelOverride =
        taskPin?.provider === provider && taskPin.model ? taskPin.model : undefined;
      const result = await callProvider(provider, request, apiKey, modelOverride);

      incrementRequests(provider);

      const latencyMs = Date.now() - providerStart;
      const model = PROVIDER_MODELS[provider];
      const costCents = model
        ? (result.inputTokens * model.costPerInputToken +
            result.outputTokens * model.costPerOutputToken) /
          1_000_000
        : 0;

      logger.info("AI request completed", {
        context: "ai-router",
        provider,
        model: result.model,
        latencyMs,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costCents: Math.round(costCents * 10000) / 10000,
        fromFallback,
        task: request.task,
        // F-AI-14 / AUDIT P1-11: logged so outputs can be reproduced
        seed: request.seed,
      });

      // E1: Record successful trace
      recordAITrace(
        traceFromSuccess(request.task ?? "unknown", {
          clinicId: request.clinicId,
          provider,
          model: result.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          latencyMs,
          costCents,
          fromFallback,
          fallbackChain: fallbackChain.length > 0 ? fallbackChain : undefined,
        }),
      );

      checkFallbackAlert(provider, fromFallback, request.clinicId);

      return {
        text: result.text,
        provider,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        latencyMs,
        costCents,
        fromFallback,
      };
    } catch (err) {
      fromFallback = true;

      if (err instanceof RateLimitError) {
        markRateLimitedInMemory(provider, err.retryAfterMs);
        if (supabase) await persistRateLimit(supabase, provider, err.retryAfterMs);
        errors.push(`${provider}: rate limited (${err.retryAfterMs}ms)`);
        fallbackChain.push({ provider, error: `rate_limited (${err.retryAfterMs}ms)` });
        logger.warn("AI provider rate limited, falling back", {
          context: "ai-router",
          provider,
          retryAfterMs: err.retryAfterMs,
        });
        continue;
      }

      if (err instanceof ProviderError) {
        errors.push(`${provider}: ${err.message}`);
        fallbackChain.push({ provider, error: err.message });
        logger.warn("AI provider error, falling back", {
          context: "ai-router",
          provider,
          status: err.statusCode,
          error: err.message,
        });
        continue;
      }

      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${provider}: ${msg}`);
      fallbackChain.push({ provider, error: msg });
      logger.error("AI provider unexpected error", {
        context: "ai-router",
        provider,
        error: msg,
      });
      continue;
    }
  }

  const totalMs = Date.now() - startTime;
  logger.error("All AI providers failed", {
    context: "ai-router",
    errors,
    totalMs,
    task: request.task,
  });

  // E1: Record failure trace
  recordAITrace(
    traceFromFailure(request.task ?? "unknown", {
      clinicId: request.clinicId,
      latencyMs: totalMs,
      fallbackChain,
    }),
  );

  throw new AllProvidersFailedError(errors);
}

async function tryProviderWithFallback(
  request: AIRequest,
  provider: AIProvider,
  configs: Map<AIProvider, ProviderConfig>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase?: any,
): Promise<AIResponse> {
  const availability = await checkProviderAvailable(provider, configs);

  if (availability.available) {
    try {
      const config = configs.get(provider);
      const apiKey = provider === "workers_ai" ? null : (config?.apiKey ?? null);
      const providerStart = Date.now();
      const result = await callProvider(provider, request, apiKey);
      incrementRequests(provider);

      const latencyMs = Date.now() - providerStart;
      const model = PROVIDER_MODELS[provider];
      const costCents = model
        ? (result.inputTokens * model.costPerInputToken +
            result.outputTokens * model.costPerOutputToken) /
          1_000_000
        : 0;

      return {
        text: result.text,
        provider,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        latencyMs,
        costCents,
        fromFallback: false,
      };
    } catch (err) {
      if (err instanceof RateLimitError) {
        markRateLimitedInMemory(provider, err.retryAfterMs);
        if (supabase) await persistRateLimit(supabase, provider, err.retryAfterMs);
      }
      logger.warn("Forced provider failed, falling back to workers_ai", {
        context: "ai-router",
        provider,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Fallback to Workers AI — only if configured
  if (provider !== "workers_ai" && (await isWorkersAIConfigured())) {
    const providerStart = Date.now();
    const result = await callProvider("workers_ai", request, null);
    const latencyMs = Date.now() - providerStart;

    return {
      text: result.text,
      provider: "workers_ai",
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      latencyMs,
      costCents: 0,
      fromFallback: true,
    };
  }

  throw new AllProvidersFailedError([
    `Forced provider '${provider}' failed and Workers AI is not configured`,
  ]);
}

// ── Load provider configs from DB (cached) ──

export async function loadProviderConfigs(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  options: { forceRefresh?: boolean } = {},
): Promise<Map<AIProvider, ProviderConfig>> {
  if (!options.forceRefresh) {
    const cached = getCachedConfigs();
    if (cached) return cached;
  }

  const configs = new Map<AIProvider, ProviderConfig>();

  const { data, error } = await supabase // nosemgrep: semgrep.tenant-scoping
    .from("ai_provider_configs")
    .select(
      "provider, display_name, api_key_encrypted, is_active, routing_tier, fallback_provider, monthly_budget_cents, requests_this_month, tokens_this_month, input_tokens_this_month, output_tokens_this_month, cost_this_month_cents, rate_limited_until, last_error",
    )
    .order("routing_tier", { ascending: false });

  if (error || !data) {
    logger.error("Failed to load AI provider configs", {
      context: "ai-router",
      error,
    });
    return configs;
  }

  for (const row of data) {
    const provider = row.provider as AIProvider;
    const apiKey = await decryptProviderKey(row.api_key_encrypted as string | null);
    const isActive = row.is_active as boolean;

    const effectiveActive = provider === "workers_ai" ? true : isActive && !!apiKey;

    configs.set(provider, {
      provider,
      displayName: row.display_name as string,
      apiKey,
      isActive: effectiveActive,
      routingTier: row.routing_tier as 0 | 1 | 2 | 3,
      fallbackProvider: row.fallback_provider as AIProvider | null,
      monthlyBudgetCents: row.monthly_budget_cents as number,
      requestsThisMonth: (row.requests_this_month as number) ?? 0,
      tokensThisMonth: (row.tokens_this_month as number) ?? 0,
      inputTokensThisMonth: (row.input_tokens_this_month as number) ?? 0,
      outputTokensThisMonth: (row.output_tokens_this_month as number) ?? 0,
      costThisMonthCents: Number(row.cost_this_month_cents ?? 0),
      rateLimitedUntil: row.rate_limited_until
        ? new Date(row.rate_limited_until as string).getTime()
        : null,
      lastError: row.last_error as string | null,
    });
  }

  setCachedConfigs(configs);
  return configs;
}

// ── Errors ──

export class AllProvidersFailedError extends Error {
  constructor(public readonly errors: string[]) {
    super(`All AI providers failed: ${errors.join("; ")}`);
    this.name = "AllProvidersFailedError";
  }
}

// ── Health report (for admin dashboard) ──

export function getProviderHealth(configs: Map<AIProvider, ProviderConfig>): Array<{
  provider: AIProvider;
  displayName: string;
  isActive: boolean;
  hasApiKey: boolean;
  isRateLimited: boolean;
  budgetUsedPercent: number;
  requestsThisMonth: number;
}> {
  return PROVIDER_PRIORITY.map((provider) => {
    const config = configs.get(provider);
    const rlState = rateLimitStates.get(provider);
    const isLimited =
      (rlState?.isRateLimited && Date.now() < (rlState?.windowResetAt ?? 0)) ||
      (config?.rateLimitedUntil != null && config.rateLimitedUntil > Date.now());

    if (!config) {
      return {
        provider,
        displayName: provider,
        isActive: provider === "workers_ai",
        hasApiKey: provider === "workers_ai",
        isRateLimited: !!isLimited,
        budgetUsedPercent: 0,
        requestsThisMonth: 0,
      };
    }

    const budgetPct =
      config.monthlyBudgetCents > 0
        ? Math.round((config.costThisMonthCents / config.monthlyBudgetCents) * 100)
        : 0;

    return {
      provider,
      displayName: config.displayName,
      isActive: config.isActive,
      hasApiKey: provider === "workers_ai" || !!config.apiKey,
      isRateLimited: !!isLimited,
      budgetUsedPercent: budgetPct,
      requestsThisMonth: config.requestsThisMonth,
    };
  });
}
