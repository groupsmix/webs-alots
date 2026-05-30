/**
 * AI Router — Smart model selection with auto-fallback.
 *
 * Rules:
 * 1. Best model first (Claude → OpenAI → Gemini → ... → Workers AI)
 * 2. No API key = auto-disabled (skipped in routing)
 * 3. Deactivated by admin = skipped
 * 4. Rate limited / over budget = skipped, try next
 * 5. Workers AI is ALWAYS the last resort (free, never disabled)
 * 6. Runtime errors trigger immediate fallback to next provider
 */

import { logger } from "@/lib/logger";
import { PROVIDER_MODELS, PROVIDER_PRIORITY, RATE_LIMIT_WINDOW_MS } from "./models";
import { callProvider, RateLimitError, ProviderError } from "./providers";
import type { AIProvider, AIRequest, AIResponse, ProviderConfig, RateLimitState } from "./types";

// ── In-memory rate limit tracking ──

const rateLimitStates = new Map<AIProvider, RateLimitState>();

function getRateLimitState(provider: AIProvider): RateLimitState {
  const existing = rateLimitStates.get(provider);
  if (existing) {
    if (Date.now() > existing.windowResetAt) {
      const reset: RateLimitState = {
        provider,
        requestsInWindow: 0,
        windowResetAt: Date.now() + RATE_LIMIT_WINDOW_MS,
        isRateLimited: false,
        retryAfterMs: 0,
      };
      rateLimitStates.set(provider, reset);
      return reset;
    }
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

function markRateLimited(provider: AIProvider, retryAfterMs: number): void {
  const state = getRateLimitState(provider);
  state.isRateLimited = true;
  state.retryAfterMs = retryAfterMs;
  state.windowResetAt = Date.now() + retryAfterMs;
  rateLimitStates.set(provider, state);
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

// ── Provider availability check ──

interface ProviderAvailability {
  available: boolean;
  reason?: string;
}

function checkProviderAvailable(
  provider: AIProvider,
  configs: Map<AIProvider, ProviderConfig>,
): ProviderAvailability {
  // Workers AI is always available
  if (provider === "workers_ai") {
    return { available: true };
  }

  const config = configs.get(provider);

  // No config in DB
  if (!config) {
    return { available: false, reason: "not_configured" };
  }

  // Admin deactivated
  if (!config.isActive) {
    return { available: false, reason: "deactivated" };
  }

  // No API key = auto-disabled
  if (!config.apiKey) {
    return { available: false, reason: "no_api_key" };
  }

  // Over monthly budget
  if (config.monthlyBudgetCents > 0) {
    const estimatedSpent = estimateMonthlySpend(config);
    if (estimatedSpent >= config.monthlyBudgetCents) {
      return { available: false, reason: "budget_exceeded" };
    }
  }

  // Rate limited
  const rlState = getRateLimitState(provider);
  if (rlState.isRateLimited && Date.now() < rlState.windowResetAt) {
    return { available: false, reason: "rate_limited" };
  }

  return { available: true };
}

function estimateMonthlySpend(config: ProviderConfig): number {
  const model = PROVIDER_MODELS[config.provider];
  if (!model) return 0;
  const avgTokensPerReq = 500;
  const inputCost = (config.tokensThisMonth * model.costPerInputToken) / 1_000_000;
  const outputCost =
    (config.tokensThisMonth * avgTokensPerReq * model.costPerOutputToken) / 1_000_000;
  return Math.round(inputCost + outputCost);
}

// ── Router ──

/**
 * Route an AI request to the best available provider.
 *
 * Walks the priority list (best → worst), skipping providers that are
 * unavailable (no key, deactivated, rate-limited, over budget).
 * Always falls back to Workers AI as the last resort.
 */
export async function routeAIRequest(
  request: AIRequest,
  configs: Map<AIProvider, ProviderConfig>,
): Promise<AIResponse> {
  // If user forced a specific provider, try only that one + Workers AI fallback
  if (request.forceProvider) {
    return tryProviderWithFallback(request, request.forceProvider, configs);
  }

  const startTime = Date.now();
  const errors: string[] = [];
  let fromFallback = false;

  // Walk priority list: best model first
  for (const provider of PROVIDER_PRIORITY) {
    const availability = checkProviderAvailable(provider, configs);

    if (!availability.available) {
      logger.debug("AI provider skipped", {
        context: "ai-router",
        provider,
        reason: availability.reason,
      });
      continue;
    }

    // Try this provider
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
      });

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
        markRateLimited(provider, err.retryAfterMs);
        errors.push(`${provider}: rate limited (${err.retryAfterMs}ms)`);
        logger.warn("AI provider rate limited, falling back", {
          context: "ai-router",
          provider,
          retryAfterMs: err.retryAfterMs,
        });
        continue;
      }

      if (err instanceof ProviderError) {
        errors.push(`${provider}: ${err.message}`);
        logger.warn("AI provider error, falling back", {
          context: "ai-router",
          provider,
          status: err.statusCode,
          error: err.message,
        });
        continue;
      }

      // Unknown error — still fall back
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${provider}: ${msg}`);
      logger.error("AI provider unexpected error", {
        context: "ai-router",
        provider,
        error: msg,
      });
      continue;
    }
  }

  // All providers failed
  const totalMs = Date.now() - startTime;
  logger.error("All AI providers failed", {
    context: "ai-router",
    errors,
    totalMs,
    task: request.task,
  });

  throw new AllProvidersFailedError(errors);
}

/**
 * Try a specific provider, falling back to Workers AI if it fails.
 */
async function tryProviderWithFallback(
  request: AIRequest,
  provider: AIProvider,
  configs: Map<AIProvider, ProviderConfig>,
): Promise<AIResponse> {
  const availability = checkProviderAvailable(provider, configs);

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
        markRateLimited(provider, err.retryAfterMs);
      }
      logger.warn("Forced provider failed, falling back to workers_ai", {
        context: "ai-router",
        provider,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Fallback to Workers AI
  if (provider !== "workers_ai") {
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

  throw new AllProvidersFailedError(["Forced provider and Workers AI both failed"]);
}

// ── Load provider configs from DB ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadProviderConfigs(supabase: any): Promise<Map<AIProvider, ProviderConfig>> {
  const configs = new Map<AIProvider, ProviderConfig>();

  // nosemgrep: semgrep.tenant-scoping
  const { data, error } = await supabase
    .from("ai_provider_configs")
    .select(
      "provider, display_name, api_key_encrypted, is_active, routing_tier, fallback_provider, monthly_budget_cents, requests_this_month, tokens_this_month, last_error",
    )
    .order("routing_tier");

  if (error || !data) {
    logger.error("Failed to load AI provider configs", {
      context: "ai-router",
      error,
    });
    return configs;
  }

  for (const row of data) {
    const provider = row.provider as AIProvider;
    const apiKey = row.api_key_encrypted as string | null;
    const isActive = row.is_active as boolean;

    // Rule: No API key = auto-disabled (except Workers AI)
    const effectiveActive = provider === "workers_ai" ? true : isActive && !!apiKey;

    configs.set(provider, {
      provider,
      displayName: row.display_name as string,
      apiKey,
      isActive: effectiveActive,
      routingTier: row.routing_tier as 0 | 1 | 2 | 3,
      fallbackProvider: row.fallback_provider as AIProvider | null,
      monthlyBudgetCents: row.monthly_budget_cents as number,
      requestsThisMonth: row.requests_this_month as number,
      tokensThisMonth: row.tokens_this_month as number,
      lastError: row.last_error as string | null,
    });
  }

  return configs;
}

// ── Error types ──

export class AllProvidersFailedError extends Error {
  errors: string[];
  constructor(errors: string[]) {
    super(`All AI providers failed: ${errors.join("; ")}`);
    this.name = "AllProvidersFailedError";
    this.errors = errors;
  }
}

// ── Status helpers (for settings page) ──

export function getProviderStatuses(configs: Map<AIProvider, ProviderConfig>): {
  provider: AIProvider;
  displayName: string;
  isActive: boolean;
  hasApiKey: boolean;
  isRateLimited: boolean;
  budgetUsedPercent: number;
  requestsThisMonth: number;
}[] {
  return PROVIDER_PRIORITY.map((provider) => {
    const config = configs.get(provider);
    const rlState = getRateLimitState(provider);
    const isLimited = rlState.isRateLimited && Date.now() < rlState.windowResetAt;

    if (!config) {
      return {
        provider,
        displayName: provider,
        isActive: provider === "workers_ai",
        hasApiKey: provider === "workers_ai",
        isRateLimited: isLimited,
        budgetUsedPercent: 0,
        requestsThisMonth: 0,
      };
    }

    const spent = estimateMonthlySpend(config);
    const budgetPct =
      config.monthlyBudgetCents > 0 ? Math.round((spent / config.monthlyBudgetCents) * 100) : 0;

    return {
      provider,
      displayName: config.displayName,
      isActive: config.isActive,
      hasApiKey: provider === "workers_ai" || !!config.apiKey,
      isRateLimited: isLimited,
      budgetUsedPercent: budgetPct,
      requestsThisMonth: config.requestsThisMonth,
    };
  });
}
