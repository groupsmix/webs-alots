/**
 * Model configurations for each AI provider.
 *
 * Pricing is in cents per 1M tokens. RPM limits are conservative defaults;
 * actual limits depend on the user's API tier.
 */

import type { AIProvider, ModelConfig, TaskComplexity, RoutingTier } from "./types";

/** Default model per provider */
export const PROVIDER_MODELS: Record<string, ModelConfig> = {
  workers_ai: {
    provider: "workers_ai",
    model: "@cf/meta/llama-3.1-8b-instruct",
    maxContextTokens: 8192,
    costPerInputToken: 0,
    costPerOutputToken: 0,
    supportsStreaming: true,
    rpmLimit: 300,
  },
  groq: {
    provider: "groq",
    model: "llama-3.1-70b-versatile",
    maxContextTokens: 131072,
    costPerInputToken: 59,
    costPerOutputToken: 79,
    supportsStreaming: true,
    rpmLimit: 30,
  },
  deepseek: {
    provider: "deepseek",
    model: "deepseek-chat",
    maxContextTokens: 65536,
    costPerInputToken: 14,
    costPerOutputToken: 28,
    supportsStreaming: true,
    rpmLimit: 300,
  },
  google: {
    provider: "google",
    model: "gemini-2.0-flash",
    maxContextTokens: 1048576,
    costPerInputToken: 15,
    costPerOutputToken: 60,
    supportsStreaming: true,
    rpmLimit: 1500,
  },
  mistral: {
    provider: "mistral",
    model: "mistral-small-latest",
    maxContextTokens: 32768,
    costPerInputToken: 10,
    costPerOutputToken: 30,
    supportsStreaming: true,
    rpmLimit: 120,
  },
  openai: {
    provider: "openai",
    model: "gpt-4.1-mini",
    maxContextTokens: 1047576,
    costPerInputToken: 40,
    costPerOutputToken: 160,
    supportsStreaming: true,
    rpmLimit: 500,
  },
  anthropic: {
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    maxContextTokens: 200000,
    costPerInputToken: 300,
    costPerOutputToken: 1500,
    supportsStreaming: true,
    rpmLimit: 50,
  },
  xai: {
    provider: "xai",
    model: "grok-3-mini",
    maxContextTokens: 131072,
    costPerInputToken: 30,
    costPerOutputToken: 50,
    supportsStreaming: true,
    rpmLimit: 60,
  },
};

/** Map complexity to minimum routing tier */
export const COMPLEXITY_TO_TIER: Record<TaskComplexity, RoutingTier> = {
  simple: 0,
  medium: 1,
  complex: 2,
  critical: 3,
};

/**
 * Global quality-first priority order.
 * Best models first → free fallback last.
 * The router walks this list, skipping providers that are:
 *   - inactive
 *   - missing an API key (auto-disabled)
 *   - rate-limited
 *   - over monthly budget
 * Workers AI is always last — free, never disabled, always available.
 */
export const PROVIDER_PRIORITY: AIProvider[] = [
  "anthropic", // best quality (Claude Sonnet 4)
  "openai", // GPT-4.1-mini
  "google", // Gemini 2.0 Flash
  "xai", // Grok 3 Mini
  "mistral", // Mistral Small
  "deepseek", // DeepSeek Chat
  "groq", // Fast inference (Llama 70B)
  "workers_ai", // free fallback — always available
];

/** Max retry attempts before giving up */
export const MAX_FALLBACK_ATTEMPTS = 4;

/** Queue timeout — max wait before returning error (ms) */
export const QUEUE_TIMEOUT_MS = 30_000;

/** Rate limit window duration (ms) */
export const RATE_LIMIT_WINDOW_MS = 60_000;
