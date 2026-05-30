/**
 * Model configurations for each AI provider.
 *
 * Pricing is in cents per 1M tokens. RPM limits are conservative defaults;
 * actual limits depend on the user's API tier.
 */

import type { AIProvider, ModelConfig } from "./types";

/** Default model per provider */
export const PROVIDER_MODELS: Record<string, ModelConfig> = {
  workers_ai: {
    provider: "workers_ai",
    model: "@cf/meta/llama-3.1-8b-instruct",
    maxContextTokens: 8192,
    costPerInputToken: 0,
    costPerOutputToken: 0,
    rpmLimit: 300,
  },
  groq: {
    provider: "groq",
    model: "llama-3.1-70b-versatile",
    maxContextTokens: 131072,
    costPerInputToken: 59,
    costPerOutputToken: 79,
    rpmLimit: 30,
  },
  deepseek: {
    provider: "deepseek",
    model: "deepseek-chat",
    maxContextTokens: 65536,
    costPerInputToken: 14,
    costPerOutputToken: 28,
    rpmLimit: 300,
  },
  google: {
    provider: "google",
    model: "gemini-2.0-flash",
    maxContextTokens: 1048576,
    costPerInputToken: 15,
    costPerOutputToken: 60,
    rpmLimit: 1500,
  },
  mistral: {
    provider: "mistral",
    model: "mistral-small-latest",
    maxContextTokens: 32768,
    costPerInputToken: 10,
    costPerOutputToken: 30,
    rpmLimit: 120,
  },
  openai: {
    provider: "openai",
    model: "gpt-4.1-mini",
    maxContextTokens: 1047576,
    costPerInputToken: 40,
    costPerOutputToken: 160,
    rpmLimit: 500,
  },
  anthropic: {
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    maxContextTokens: 200000,
    costPerInputToken: 300,
    costPerOutputToken: 1500,
    rpmLimit: 50,
  },
  xai: {
    provider: "xai",
    model: "grok-3-mini",
    maxContextTokens: 131072,
    costPerInputToken: 30,
    costPerOutputToken: 50,
    rpmLimit: 60,
  },
};

/**
 * Quality-first baseline order. The router sorts dynamically by the
 * `routing_tier` column from `ai_provider_configs` so admins can re-rank
 * providers from the settings UI — this list is the fallback when two
 * providers share the same tier. Workers AI is always pinned last.
 */
export const PROVIDER_PRIORITY: AIProvider[] = [
  "anthropic", // best quality (Claude Sonnet 4)
  "openai", // GPT-4.1-mini
  "google", // Gemini 2.0 Flash
  "xai", // Grok 3 Mini
  "mistral", // Mistral Small
  "deepseek", // DeepSeek Chat
  "groq", // Fast inference (Llama 70B)
  "workers_ai", // free fallback — always last
];

/** Rate limit window duration (ms) */
export const RATE_LIMIT_WINDOW_MS = 60_000;
