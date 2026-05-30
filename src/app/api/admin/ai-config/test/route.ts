/**
 * Connection-test endpoint for AI providers.
 *
 * Super admin only. Given a `provider` (and optionally `api_key` for a
 * dry-run before saving), makes a tiny round-trip to confirm credentials
 * and reachability. Returns latency, the model that responded, and any
 * provider-side error.
 *
 * Used by the /super-admin/settings/ai UI test button.
 *
 *   POST { provider, api_key?: string }
 *   → { ok: true, latency_ms, model, response_preview }
 *   → { ok: false, status, message }
 */

import { NextRequest } from "next/server";
import { PROVIDER_MODELS } from "@/lib/ai/models";
import { callProvider, ProviderError, RateLimitError } from "@/lib/ai/providers";
import { loadProviderConfigs } from "@/lib/ai/router";
import type { AIProvider, AIRequest } from "@/lib/ai/types";
import { apiSuccess, apiError, apiValidationError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { createUntypedAdminClient } from "@/lib/supabase-server";
import { withAuth } from "@/lib/with-auth";
import type { AuthContext } from "@/lib/with-auth";

const VALID_PROVIDERS: AIProvider[] = [
  "anthropic",
  "openai",
  "google",
  "xai",
  "mistral",
  "deepseek",
  "groq",
  "workers_ai",
];

const TEST_REQUEST: AIRequest = {
  task: "classify",
  complexity: "simple",
  prompt: "Reply with exactly the word OK.",
  maxTokens: 10,
  temperature: 0,
};

async function handlePost(req: NextRequest, auth: AuthContext) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiValidationError("Invalid JSON body");
  }

  const provider = body.provider as AIProvider | undefined;
  if (!provider || !VALID_PROVIDERS.includes(provider)) {
    return apiValidationError(
      `provider is required and must be one of: ${VALID_PROVIDERS.join(", ")}`,
    );
  }

  // Resolve which API key to test with:
  //   1. `api_key` from the request body (dry-run for a not-yet-saved key)
  //   2. The currently saved key for that provider
  //   3. null for workers_ai (uses env)
  let apiKey: string | null = null;
  if (typeof body.api_key === "string" && body.api_key.length > 0) {
    apiKey = body.api_key;
  } else if (provider !== "workers_ai") {
    const supabase = createUntypedAdminClient("ai-config-test");
    const configs = await loadProviderConfigs(supabase, { forceRefresh: true });
    apiKey = configs.get(provider)?.apiKey ?? null;
    if (!apiKey) {
      return apiError(
        `No API key configured for ${provider}. Save one first or include api_key in the request.`,
        400,
        "NO_API_KEY",
      );
    }
  }

  logger.info("AI provider connection test started", {
    context: "ai-config-test",
    provider,
    initiatedBy: auth.user.id,
  });

  const startedAt = Date.now();

  try {
    const result = await callProvider(provider, TEST_REQUEST, apiKey);
    const latencyMs = Date.now() - startedAt;

    return apiSuccess({
      ok: true,
      provider,
      model: result.model || PROVIDER_MODELS[provider]?.model,
      latency_ms: latencyMs,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
      response_preview: result.text.slice(0, 100),
    });
  } catch (err) {
    const latencyMs = Date.now() - startedAt;

    if (err instanceof RateLimitError) {
      return apiSuccess({
        ok: false,
        provider,
        status: 429,
        message: `Rate limited — retry in ${Math.round(err.retryAfterMs / 1000)}s`,
        latency_ms: latencyMs,
      });
    }

    if (err instanceof ProviderError) {
      return apiSuccess({
        ok: false,
        provider,
        status: err.statusCode,
        message: err.message.slice(0, 500),
        latency_ms: latencyMs,
      });
    }

    const msg = err instanceof Error ? err.message : String(err);
    logger.error("AI provider connection test failed unexpectedly", {
      context: "ai-config-test",
      provider,
      error: msg,
    });
    return apiSuccess({
      ok: false,
      provider,
      status: 0,
      message: msg.slice(0, 500),
      latency_ms: latencyMs,
    });
  }
}

export const POST = withAuth(handlePost, ["super_admin"]);
