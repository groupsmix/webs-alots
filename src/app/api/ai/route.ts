/**
 * Unified AI endpoint — all AI features call this single route.
 *
 * Accepts a task + prompt, optionally a feature_key for toggle-gating,
 * routes to the best available model via the AI router, logs usage via
 * an atomic Postgres RPC, and returns the response.
 *
 * Super admin only (for now — can be extended to clinic_admin later).
 *
 * Changes vs the original:
 *   1. Feature key gating — if `feature_key` is sent, the request is
 *      blocked when the matching toggle row is disabled.
 *   2. Atomic counter increments via `increment_ai_usage` RPC. The old
 *      read-modify-write pattern lost concurrent increments.
 *   3. Provider configs are loaded through a 30s in-memory cache to save
 *      a round-trip on every request.
 */

import { NextRequest } from "next/server";
import { isAIFeatureEnabled, loadFeatureToggles } from "@/lib/ai/feature-toggles";
import { routeAIRequest, loadProviderConfigs, AllProvidersFailedError } from "@/lib/ai/router";
import type { AIRequest, AITaskType, TaskComplexity, AIProvider } from "@/lib/ai/types";
import { apiSuccess, apiError, apiValidationError } from "@/lib/api-response";
import { isAIEnabled } from "@/lib/features";
import { logger } from "@/lib/logger";
import { createUntypedAdminClient } from "@/lib/supabase-server";
import { withAuth } from "@/lib/with-auth";
import type { AuthContext } from "@/lib/with-auth";

const VALID_TASKS: AITaskType[] = [
  "classify",
  "summarize",
  "generate",
  "translate",
  "analyze",
  "reason",
  "code",
  "conversation",
];

const VALID_COMPLEXITIES: TaskComplexity[] = ["simple", "medium", "complex", "critical"];

async function handlePost(req: NextRequest, auth: AuthContext) {
  // F-AI-01: Early kill switch — fail fast before processing
  if (!(await isAIEnabled())) {
    return apiError("AI features are disabled", 503, "AI_DISABLED");
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiValidationError("Invalid JSON body");
  }

  // Validate required fields
  const task = body.task as string | undefined;
  const prompt = body.prompt as string | undefined;

  if (!task || !VALID_TASKS.includes(task as AITaskType)) {
    return apiValidationError(`task is required and must be one of: ${VALID_TASKS.join(", ")}`);
  }

  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    return apiValidationError("prompt is required and must be a non-empty string");
  }

  if (prompt.length > 100_000) {
    return apiValidationError("prompt exceeds maximum length of 100,000 characters");
  }

  const complexity = (body.complexity as string) ?? "medium";
  if (!VALID_COMPLEXITIES.includes(complexity as TaskComplexity)) {
    return apiValidationError(`complexity must be one of: ${VALID_COMPLEXITIES.join(", ")}`);
  }

  const featureKey = (body.feature_key as string) ?? undefined;

  const aiRequest: AIRequest = {
    task: task as AITaskType,
    complexity: complexity as TaskComplexity,
    prompt: prompt.trim(),
    systemPrompt: (body.system_prompt as string) ?? undefined,
    maxTokens: typeof body.max_tokens === "number" ? body.max_tokens : undefined,
    temperature: typeof body.temperature === "number" ? body.temperature : undefined,
    forceProvider: (body.force_provider as AIProvider) ?? undefined,
    featureKey,
    context: (body.context as string) ?? undefined,
  };

  const supabase = createUntypedAdminClient("ai-route");

  // ── Feature toggle gate ──
  // Only enforced when the caller passes a feature_key. Unknown keys are
  // allowed by default (opt-in gating).
  if (featureKey) {
    const toggles = await loadFeatureToggles(supabase);
    const check = isAIFeatureEnabled(featureKey, toggles);
    if (!check.allowed) {
      logger.info("AI request blocked by feature toggle", {
        context: "ai-route",
        featureKey,
        reason: check.reason,
        userId: auth.user.id,
      });
      return apiError(check.reason ?? "Feature disabled", 403, "FEATURE_DISABLED");
    }
  }

  const configs = await loadProviderConfigs(supabase);

  try {
    const response = await routeAIRequest(aiRequest, configs, supabase);

    // Log usage in the background — don't block the response on it.
    logUsage(supabase, response, aiRequest, auth).catch((err) =>
      logger.error("Failed to log AI usage", {
        context: "ai-route",
        error: err instanceof Error ? err.message : String(err),
      }),
    );

    return apiSuccess({
      text: response.text,
      provider: response.provider,
      model: response.model,
      input_tokens: response.inputTokens,
      output_tokens: response.outputTokens,
      latency_ms: response.latencyMs,
      cost_cents: Math.round(response.costCents * 10000) / 10000,
      from_fallback: response.fromFallback,
    });
  } catch (err) {
    if (err instanceof AllProvidersFailedError) {
      logger.error("All AI providers failed for request", {
        context: "ai-route",
        task,
        complexity,
        errors: err.errors,
        userId: auth.user.id,
      });
      return apiError(
        "AI service temporarily unavailable. All providers are either down, rate-limited, or not configured. Please check your AI settings.",
        503,
        "AI_UNAVAILABLE",
      );
    }

    logger.error("Unexpected AI route error", {
      context: "ai-route",
      error: err instanceof Error ? err.message : String(err),
    });
    return apiError("Internal AI error", 500);
  }
}

/**
 * Log a successful AI call.
 *
 * Two writes:
 *   1. Insert into ai_usage_logs (per-request audit trail)
 *   2. Call increment_ai_usage() RPC — atomic update of monthly counters
 *      and last_used_at. Replaces the racy read-modify-write that the
 *      original code had.
 */
async function logUsage(
  supabase: ReturnType<typeof createUntypedAdminClient>,
  response: {
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
    costCents: number;
  },
  request: AIRequest,
  auth: AuthContext,
): Promise<void> {
  await supabase.from("ai_usage_logs").insert({
    provider: response.provider,
    model: response.model,
    task_type: request.task,
    feature_key: request.featureKey ?? null,
    input_tokens: response.inputTokens,
    output_tokens: response.outputTokens,
    latency_ms: response.latencyMs,
    cost_cents: response.costCents,
    success: true,
    user_id: auth.user.id,
  }); // nosemgrep: semgrep.tenant-scoping — ai_usage_logs is a global admin table (no clinic_id column); super-admin-only API, full RLS defined in migration

  // Atomic counter increment. Auto-resets at month boundary.
  const { error } = await supabase.rpc("increment_ai_usage", {
    p_provider: response.provider,
    p_input_tokens: response.inputTokens,
    p_output_tokens: response.outputTokens,
    p_cost_cents: response.costCents,
  });

  if (error) {
    logger.warn("increment_ai_usage RPC failed", {
      context: "ai-route",
      provider: response.provider,
      error: error.message,
    });
  }
}

export const POST = withAuth(handlePost, ["super_admin"]);
