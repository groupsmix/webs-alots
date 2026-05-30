/**
 * Unified AI endpoint — all AI features call this single route.
 *
 * Accepts a task + prompt, routes to the best available model via the
 * AI router, logs usage, and returns the response.
 *
 * Super admin only (for now — can be extended to clinic_admin later).
 */

import { NextRequest } from "next/server";
import { routeAIRequest, loadProviderConfigs, AllProvidersFailedError } from "@/lib/ai/router";
import type { AIRequest, AITaskType, TaskComplexity, AIProvider } from "@/lib/ai/types";
import { apiSuccess, apiError, apiValidationError } from "@/lib/api-response";
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

  const aiRequest: AIRequest = {
    task: task as AITaskType,
    complexity: complexity as TaskComplexity,
    prompt: prompt.trim(),
    systemPrompt: (body.system_prompt as string) ?? undefined,
    maxTokens: typeof body.max_tokens === "number" ? body.max_tokens : undefined,
    temperature: typeof body.temperature === "number" ? body.temperature : undefined,
    forceProvider: (body.force_provider as AIProvider) ?? undefined,
    context: (body.context as string) ?? undefined,
  };

  // Load provider configs from DB
  const supabase = createUntypedAdminClient("ai-route");
  const configs = await loadProviderConfigs(supabase);

  try {
    const response = await routeAIRequest(aiRequest, configs);

    // Log usage asynchronously (don't block response)
    logUsage(supabase, response, aiRequest).catch((err) =>
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
): Promise<void> {
  // nosemgrep: semgrep.tenant-scoping
  await supabase.from("ai_usage_logs").insert({
    provider: response.provider,
    model: response.model,
    task_type: request.task,
    input_tokens: response.inputTokens,
    output_tokens: response.outputTokens,
    latency_ms: response.latencyMs,
    cost_cents: response.costCents,
    success: true,
  });

  // Update provider stats
  // nosemgrep: semgrep.tenant-scoping
  const { data: current } = await supabase
    .from("ai_provider_configs")
    .select("requests_this_month, tokens_this_month")
    .eq("provider", response.provider)
    .single();

  if (current) {
    const newRequests = ((current.requests_this_month as number) || 0) + 1;
    const newTokens =
      ((current.tokens_this_month as number) || 0) + response.inputTokens + response.outputTokens;
    // nosemgrep: semgrep.tenant-scoping
    await supabase
      .from("ai_provider_configs")
      .update({
        requests_this_month: newRequests,
        tokens_this_month: newTokens,
        last_used_at: new Date().toISOString(),
      })
      .eq("provider", response.provider);
  }
}

export const POST = withAuth(handlePost, ["super_admin"]);
