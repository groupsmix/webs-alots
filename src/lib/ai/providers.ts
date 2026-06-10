/**
 * Provider adapters — AI SDK v6 backed (Task A3).
 *
 * Replaces ~475 lines of hand-rolled fetch adapters with Vercel AI SDK
 * provider packages, unlocking native streaming, tool calling, and
 * structured output.
 *
 * Public interface is UNCHANGED: `callProvider()`, `callProviderStream()`,
 * `ProviderError`, `RateLimitError`, `ProviderResponse`. The router, cost
 * tracking, and fallback logic remain unaware of the implementation swap.
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createMistral } from "@ai-sdk/mistral";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createXai } from "@ai-sdk/xai";
import { generateText, streamText, type LanguageModel, type ToolSet } from "ai";
import { getWorkersAiConfig } from "@/lib/env";
import { logger } from "@/lib/logger";
import { PROVIDER_MODELS } from "./models";
import type { AIProvider, AIRequest } from "./types";

// ── Public types (unchanged) ──

export interface ProviderResponse {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/** Result of `callProviderStream()` for real end-to-end streaming. */
export interface ProviderStreamResult {
  textStream: AsyncIterable<string>;
  usage: PromiseLike<{ inputTokens: number; outputTokens: number }>;
  response: PromiseLike<{ modelId: string }>;
  /** The full streamText result for consumers that need tool calling, etc. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: ReturnType<typeof streamText<any, any>>;
}

// ── Error Types (unchanged) ──

export class RateLimitError extends Error {
  provider: AIProvider;
  retryAfterMs: number;
  constructor(provider: AIProvider, retryAfterMs: number) {
    super(`Rate limited by ${provider}, retry after ${retryAfterMs}ms`);
    this.name = "RateLimitError";
    this.provider = provider;
    this.retryAfterMs = retryAfterMs;
  }
}

export class ProviderError extends Error {
  provider: AIProvider;
  statusCode: number;
  constructor(provider: AIProvider, statusCode: number, detail: string) {
    super(`${provider} error (${statusCode}): ${detail}`);
    this.name = "ProviderError";
    this.provider = provider;
    this.statusCode = statusCode;
  }
}

// ── SDK model factory ──

export function createModel(
  provider: AIProvider,
  apiKey: string | null,
  modelOverride?: string,
): LanguageModel {
  // modelOverride comes from per-task pins (task-config.ts) and is already
  // validated against ALLOWED_MODELS before it reaches this point.
  const modelId = modelOverride ?? PROVIDER_MODELS[provider]?.model ?? "";

  switch (provider) {
    case "openai":
      return createOpenAI({ apiKey: apiKey ?? undefined })(modelId);

    case "anthropic":
      return createAnthropic({ apiKey: apiKey ?? undefined })(modelId);

    case "google":
      return createGoogleGenerativeAI({ apiKey: apiKey ?? undefined })(modelId);

    case "groq":
      return createGroq({ apiKey: apiKey ?? undefined })(modelId);

    case "mistral":
      return createMistral({ apiKey: apiKey ?? undefined })(modelId);

    case "deepseek":
      return createDeepSeek({ apiKey: apiKey ?? undefined })(modelId);

    case "xai":
      return createXai({ apiKey: apiKey ?? undefined })(modelId);

    case "workers_ai": {
      // Workers AI uses the OpenAI-compatible endpoint via @ai-sdk/openai-compatible.
      const { accountId, apiToken } = getWorkersAiConfig();
      const aiToken = apiToken ?? apiKey;

      if (!accountId || !aiToken) {
        throw new ProviderError(
          "workers_ai",
          0,
          "Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_AI_API_TOKEN",
        );
      }
      const workersAI = createOpenAICompatible({
        name: "workers-ai",
        baseURL: `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`,
        headers: { Authorization: `Bearer ${aiToken}` },
      });
      return workersAI(modelId);
    }

    default:
      throw new ProviderError(provider, 0, `Unknown provider: ${provider}`);
  }
}

// ── Error mapping ──

function mapSDKError(provider: AIProvider, err: unknown): never {
  if (err instanceof RateLimitError || err instanceof ProviderError) throw err;

  const message = err instanceof Error ? err.message : String(err);
  const statusCode =
    err && typeof err === "object" && "statusCode" in err
      ? (err as { statusCode: number }).statusCode
      : err && typeof err === "object" && "status" in err
        ? (err as { status: number }).status
        : 0;

  if (statusCode === 429) {
    const retryMs =
      err && typeof err === "object" && "retryAfterMs" in err
        ? (err as { retryAfterMs: number }).retryAfterMs
        : 60_000;
    throw new RateLimitError(provider, retryMs);
  }

  throw new ProviderError(provider, statusCode, message);
}

// ── Buffered call (drop-in replacement) ──

/**
 * Call a specific provider. Throws RateLimitError or ProviderError on failure.
 * Public interface is unchanged from the hand-rolled adapters.
 */
export async function callProvider(
  provider: AIProvider,
  req: AIRequest,
  apiKey: string | null,
  modelOverride?: string,
): Promise<ProviderResponse> {
  logger.debug("Calling AI provider", {
    context: "ai-provider",
    provider,
    task: req.task,
    complexity: req.complexity,
    ...(modelOverride ? { modelOverride } : {}),
  });

  try {
    const model = createModel(provider, apiKey, modelOverride);

    const messages: Array<{ role: "system" | "user"; content: string }> = [];
    if (req.systemPrompt) messages.push({ role: "system", content: req.systemPrompt });
    messages.push({ role: "user", content: req.prompt });

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 30_000);

    try {
      const result = await generateText({
        model,
        messages,
        maxOutputTokens: req.maxTokens ?? 1024,
        temperature: req.temperature ?? 0.7,
        abortSignal: abortController.signal,
      });

      return {
        text: result.text,
        model: result.response?.modelId ?? PROVIDER_MODELS[provider]?.model ?? provider,
        inputTokens: result.usage?.inputTokens ?? 0,
        outputTokens: result.usage?.outputTokens ?? 0,
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    mapSDKError(provider, err);
  }
}

// ── Streaming call (new — Task A3/A4) ──

/**
 * Call a provider with real streaming. Returns the AI SDK `streamText`
 * result wrapped in our `ProviderStreamResult` interface so the router's
 * cost tracking and fallback logic can consume it.
 *
 * Token usage is available after the stream completes via `result.usage`.
 */
export function callProviderStream(
  provider: AIProvider,
  req: AIRequest,
  apiKey: string | null,
  options?: { tools?: ToolSet; maxSteps?: number },
): ProviderStreamResult {
  logger.debug("Streaming AI provider", {
    context: "ai-provider",
    provider,
    task: req.task,
    complexity: req.complexity,
  });

  const model = createModel(provider, apiKey);

  const messages: Array<{ role: "system" | "user"; content: string }> = [];
  if (req.systemPrompt) messages.push({ role: "system", content: req.systemPrompt });
  messages.push({ role: "user", content: req.prompt });

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 30_000);

  const result = streamText({
    model,
    messages,
    maxOutputTokens: req.maxTokens ?? 1024,
    temperature: req.temperature ?? 0.7,
    abortSignal: abortController.signal,
    ...(options?.tools ? { tools: options.tools } : {}),
    ...(options?.maxSteps ? { maxSteps: options.maxSteps } : {}),
    onFinish: () => clearTimeout(timeout),
    onError: () => clearTimeout(timeout),
  });

  const defaultModel = PROVIDER_MODELS[provider]?.model ?? provider;

  return {
    textStream: result.textStream,
    usage: result.usage.then((u) => ({
      inputTokens: u.inputTokens ?? 0,
      outputTokens: u.outputTokens ?? 0,
    })),
    response: result.response.then((r) => ({
      modelId: r.modelId ?? defaultModel,
    })),
    raw: result,
  };
}
