/**
 * Provider adapters — unified interface for calling each AI API.
 *
 * Each adapter normalizes the provider's response into a common shape
 * so the router doesn't need to know provider-specific details.
 */

import { logger } from "@/lib/logger";
import { PROVIDER_MODELS } from "./models";
import type { AIProvider, AIRequest } from "./types";

export interface ProviderResponse {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

interface CallOptions {
  apiKey: string | null;
  model?: string;
}

/** HTTP call helper with timeout */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 30_000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Parse provider-specific rate limit headers */
export function parseRateLimitHeaders(res: Response): { limited: boolean; retryAfterMs: number } {
  if (res.status === 429) {
    const retryAfter = res.headers.get("retry-after");
    const retryMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 60_000;
    return { limited: true, retryAfterMs: retryMs };
  }
  return { limited: false, retryAfterMs: 0 };
}

// ── Anthropic ──

async function callAnthropic(req: AIRequest, opts: CallOptions): Promise<ProviderResponse> {
  const model = opts.model ?? PROVIDER_MODELS.anthropic.model;
  const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": opts.apiKey ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: req.maxTokens ?? 1024,
      temperature: req.temperature ?? 0.7,
      system: req.systemPrompt ?? "You are a helpful assistant.",
      messages: [{ role: "user", content: req.prompt }],
    }),
  });

  if (!res.ok) {
    const rl = parseRateLimitHeaders(res);
    if (rl.limited) throw new RateLimitError("anthropic", rl.retryAfterMs);
    const errBody = await res.text().catch(() => "Unknown error");
    throw new ProviderError("anthropic", res.status, errBody);
  }

  const json = (await res.json()) as {
    content: { text: string }[];
    model: string;
    usage: { input_tokens: number; output_tokens: number };
  };

  return {
    text: json.content[0]?.text ?? "",
    model: json.model,
    inputTokens: json.usage.input_tokens,
    outputTokens: json.usage.output_tokens,
  };
}

// ── Google Gemini ──

async function callGoogle(req: AIRequest, opts: CallOptions): Promise<ProviderResponse> {
  const model = opts.model ?? PROVIDER_MODELS.google.model;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${opts.apiKey}`;
  const contents = [];
  if (req.systemPrompt) {
    contents.push({ role: "user", parts: [{ text: req.systemPrompt }] });
    contents.push({ role: "model", parts: [{ text: "Understood." }] });
  }
  contents.push({ role: "user", parts: [{ text: req.prompt }] });

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      generationConfig: {
        maxOutputTokens: req.maxTokens ?? 1024,
        temperature: req.temperature ?? 0.7,
      },
    }),
  });

  if (!res.ok) {
    const rl = parseRateLimitHeaders(res);
    if (rl.limited) throw new RateLimitError("google", rl.retryAfterMs);
    const errBody = await res.text().catch(() => "Unknown error");
    throw new ProviderError("google", res.status, errBody);
  }

  const json = (await res.json()) as {
    candidates: { content: { parts: { text: string }[] } }[];
    usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number };
  };

  return {
    text: json.candidates?.[0]?.content?.parts?.[0]?.text ?? "",
    model,
    inputTokens: json.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: json.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

// ── OpenAI ──

async function callOpenAI(req: AIRequest, opts: CallOptions): Promise<ProviderResponse> {
  const model = opts.model ?? PROVIDER_MODELS.openai.model;
  const messages: { role: string; content: string }[] = [];
  if (req.systemPrompt) messages.push({ role: "system", content: req.systemPrompt });
  messages.push({ role: "user", content: req.prompt });

  const res = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: req.maxTokens ?? 1024,
      temperature: req.temperature ?? 0.7,
    }),
  });

  if (!res.ok) {
    const rl = parseRateLimitHeaders(res);
    if (rl.limited) throw new RateLimitError("openai", rl.retryAfterMs);
    const errBody = await res.text().catch(() => "Unknown error");
    throw new ProviderError("openai", res.status, errBody);
  }

  const json = (await res.json()) as {
    choices: { message: { content: string } }[];
    model: string;
    usage: { prompt_tokens: number; completion_tokens: number };
  };

  return {
    text: json.choices[0]?.message?.content ?? "",
    model: json.model,
    inputTokens: json.usage.prompt_tokens,
    outputTokens: json.usage.completion_tokens,
  };
}

// ── DeepSeek (OpenAI-compatible) ──

async function callDeepSeek(req: AIRequest, opts: CallOptions): Promise<ProviderResponse> {
  const model = opts.model ?? PROVIDER_MODELS.deepseek.model;
  const messages: { role: string; content: string }[] = [];
  if (req.systemPrompt) messages.push({ role: "system", content: req.systemPrompt });
  messages.push({ role: "user", content: req.prompt });

  const res = await fetchWithTimeout("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: req.maxTokens ?? 1024,
      temperature: req.temperature ?? 0.7,
    }),
  });

  if (!res.ok) {
    const rl = parseRateLimitHeaders(res);
    if (rl.limited) throw new RateLimitError("deepseek", rl.retryAfterMs);
    const errBody = await res.text().catch(() => "Unknown error");
    throw new ProviderError("deepseek", res.status, errBody);
  }

  const json = (await res.json()) as {
    choices: { message: { content: string } }[];
    model: string;
    usage: { prompt_tokens: number; completion_tokens: number };
  };

  return {
    text: json.choices[0]?.message?.content ?? "",
    model: json.model,
    inputTokens: json.usage.prompt_tokens,
    outputTokens: json.usage.completion_tokens,
  };
}

// ── Groq (OpenAI-compatible) ──

async function callGroq(req: AIRequest, opts: CallOptions): Promise<ProviderResponse> {
  const model = opts.model ?? PROVIDER_MODELS.groq.model;
  const messages: { role: string; content: string }[] = [];
  if (req.systemPrompt) messages.push({ role: "system", content: req.systemPrompt });
  messages.push({ role: "user", content: req.prompt });

  const res = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: req.maxTokens ?? 1024,
      temperature: req.temperature ?? 0.7,
    }),
  });

  if (!res.ok) {
    const rl = parseRateLimitHeaders(res);
    if (rl.limited) throw new RateLimitError("groq", rl.retryAfterMs);
    const errBody = await res.text().catch(() => "Unknown error");
    throw new ProviderError("groq", res.status, errBody);
  }

  const json = (await res.json()) as {
    choices: { message: { content: string } }[];
    model: string;
    usage: { prompt_tokens: number; completion_tokens: number };
  };

  return {
    text: json.choices[0]?.message?.content ?? "",
    model: json.model,
    inputTokens: json.usage.prompt_tokens,
    outputTokens: json.usage.completion_tokens,
  };
}

// ── Mistral (OpenAI-compatible) ──

async function callMistral(req: AIRequest, opts: CallOptions): Promise<ProviderResponse> {
  const model = opts.model ?? PROVIDER_MODELS.mistral.model;
  const messages: { role: string; content: string }[] = [];
  if (req.systemPrompt) messages.push({ role: "system", content: req.systemPrompt });
  messages.push({ role: "user", content: req.prompt });

  const res = await fetchWithTimeout("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: req.maxTokens ?? 1024,
      temperature: req.temperature ?? 0.7,
    }),
  });

  if (!res.ok) {
    const rl = parseRateLimitHeaders(res);
    if (rl.limited) throw new RateLimitError("mistral", rl.retryAfterMs);
    const errBody = await res.text().catch(() => "Unknown error");
    throw new ProviderError("mistral", res.status, errBody);
  }

  const json = (await res.json()) as {
    choices: { message: { content: string } }[];
    model: string;
    usage: { prompt_tokens: number; completion_tokens: number };
  };

  return {
    text: json.choices[0]?.message?.content ?? "",
    model: json.model,
    inputTokens: json.usage.prompt_tokens,
    outputTokens: json.usage.completion_tokens,
  };
}

// ── xAI / Grok (OpenAI-compatible) ──

async function callXAI(req: AIRequest, opts: CallOptions): Promise<ProviderResponse> {
  const model = opts.model ?? PROVIDER_MODELS.xai.model;
  const messages: { role: string; content: string }[] = [];
  if (req.systemPrompt) messages.push({ role: "system", content: req.systemPrompt });
  messages.push({ role: "user", content: req.prompt });

  const res = await fetchWithTimeout("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: req.maxTokens ?? 1024,
      temperature: req.temperature ?? 0.7,
    }),
  });

  if (!res.ok) {
    const rl = parseRateLimitHeaders(res);
    if (rl.limited) throw new RateLimitError("xai", rl.retryAfterMs);
    const errBody = await res.text().catch(() => "Unknown error");
    throw new ProviderError("xai", res.status, errBody);
  }

  const json = (await res.json()) as {
    choices: { message: { content: string } }[];
    model: string;
    usage: { prompt_tokens: number; completion_tokens: number };
  };

  return {
    text: json.choices[0]?.message?.content ?? "",
    model: json.model,
    inputTokens: json.usage.prompt_tokens,
    outputTokens: json.usage.completion_tokens,
  };
}

// ── Workers AI (Cloudflare) ──

async function callWorkersAI(req: AIRequest, opts: CallOptions): Promise<ProviderResponse> {
  const model = opts.model ?? PROVIDER_MODELS.workers_ai.model;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_AI_TOKEN ?? opts.apiKey;

  if (!accountId || !apiToken) {
    throw new ProviderError(
      "workers_ai",
      0,
      "Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_AI_TOKEN",
    );
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;

  const messages: { role: string; content: string }[] = [];
  if (req.systemPrompt) messages.push({ role: "system", content: req.systemPrompt });
  messages.push({ role: "user", content: req.prompt });

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify({
      messages,
      max_tokens: req.maxTokens ?? 512,
      temperature: req.temperature ?? 0.7,
    }),
  });

  if (!res.ok) {
    const rl = parseRateLimitHeaders(res);
    if (rl.limited) throw new RateLimitError("workers_ai", rl.retryAfterMs);
    const errBody = await res.text().catch(() => "Unknown error");
    throw new ProviderError("workers_ai", res.status, errBody);
  }

  const json = (await res.json()) as {
    result: { response: string };
    success: boolean;
  };

  const text = json.result?.response ?? "";
  const estimatedInputTokens = Math.ceil(req.prompt.length / 4);
  const estimatedOutputTokens = Math.ceil(text.length / 4);

  return {
    text,
    model,
    inputTokens: estimatedInputTokens,
    outputTokens: estimatedOutputTokens,
  };
}

// ── Error Types ──

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

// ── Dispatch ──

type ProviderCaller = (req: AIRequest, opts: CallOptions) => Promise<ProviderResponse>;

const CALLERS: Record<AIProvider, ProviderCaller> = {
  workers_ai: callWorkersAI,
  anthropic: callAnthropic,
  google: callGoogle,
  openai: callOpenAI,
  deepseek: callDeepSeek,
  groq: callGroq,
  mistral: callMistral,
  xai: callXAI,
};

/**
 * Call a specific provider. Throws RateLimitError or ProviderError on failure.
 */
export async function callProvider(
  provider: AIProvider,
  req: AIRequest,
  apiKey: string | null,
): Promise<ProviderResponse> {
  const caller = CALLERS[provider];
  if (!caller) throw new ProviderError(provider, 0, `Unknown provider: ${provider}`);

  logger.debug("Calling AI provider", {
    context: "ai-provider",
    provider,
    task: req.task,
    complexity: req.complexity,
  });

  return caller(req, { apiKey });
}
