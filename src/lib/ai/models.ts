/**
 * Model configurations for each AI provider.
 *
 * Pricing is in cents per 1M tokens. RPM limits are conservative defaults;
 * actual limits depend on the user's API tier.
 *
 * Task A2: model IDs and pricing verified against official provider
 * documentation on 2026-06-10 (Groq console docs, Google AI pricing,
 * Anthropic models overview, OpenAI platform pricing, xAI models page,
 * DeepSeek pricing, Mistral model cards). Superseded IDs are mapped in
 * `DEPRECATED_MODEL_ALIASES` below so stale operator pins auto-resolve to
 * their replacement instead of failing at the provider.
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
    // llama-3.1-70b-versatile was decommissioned; 3.3 is Groq's drop-in replacement.
    model: "llama-3.3-70b-versatile",
    maxContextTokens: 131072,
    costPerInputToken: 59, // $0.59 / 1M
    costPerOutputToken: 79, // $0.79 / 1M
    rpmLimit: 30,
  },
  deepseek: {
    provider: "deepseek",
    // deepseek-chat retires 2026-07-24; V4 Flash is its designated successor.
    model: "deepseek-v4-flash",
    maxContextTokens: 1_000_000,
    costPerInputToken: 14, // $0.14 / 1M (cache miss)
    costPerOutputToken: 28, // $0.28 / 1M
    rpmLimit: 300,
  },
  google: {
    provider: "google",
    // gemini-2.0-flash is shut down; 3.5 Flash is the current stable Flash tier.
    model: "gemini-3.5-flash",
    maxContextTokens: 1048576,
    costPerInputToken: 150, // $1.50 / 1M (standard paid tier)
    costPerOutputToken: 900, // $9.00 / 1M (incl. thinking tokens)
    rpmLimit: 1500,
  },
  mistral: {
    provider: "mistral",
    // Replaces the floating "mistral-small-latest" alias (W8-S-03) with the
    // dated Mistral Small 4 snapshot (v26.03).
    model: "mistral-small-2603",
    maxContextTokens: 262144,
    costPerInputToken: 15, // $0.15 / 1M
    costPerOutputToken: 60, // $0.60 / 1M
    rpmLimit: 120,
  },
  openai: {
    provider: "openai",
    // gpt-4.1-mini is superseded; 5.4 mini is the current mini-tier model.
    model: "gpt-5.4-mini",
    maxContextTokens: 400000,
    costPerInputToken: 75, // $0.75 / 1M
    costPerOutputToken: 450, // $4.50 / 1M
    rpmLimit: 500,
  },
  anthropic: {
    provider: "anthropic",
    // claude-sonnet-4-20250514 retires 2026-06-15. Sonnet 4.6 IDs are
    // dateless but still pinned snapshots per Anthropic's versioning docs.
    model: "claude-sonnet-4-6",
    maxContextTokens: 1_000_000,
    costPerInputToken: 300, // $3.00 / 1M
    costPerOutputToken: 1500, // $15.00 / 1M
    rpmLimit: 50,
  },
  xai: {
    provider: "xai",
    // grok-3-mini is superseded; grok-4.3 is xAI's current general model.
    model: "grok-4.3",
    maxContextTokens: 1_000_000,
    costPerInputToken: 125, // $1.25 / 1M
    costPerOutputToken: 250, // $2.50 / 1M
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
  "anthropic", // best quality (Claude Sonnet 4.6)
  "openai", // GPT-5.4 mini
  "google", // Gemini 3.5 Flash
  "xai", // Grok 4.3
  "mistral", // Mistral Small 4
  "deepseek", // DeepSeek V4 Flash
  "groq", // Fast inference (Llama 3.3 70B)
  "workers_ai", // free fallback — always last
];

/** Rate limit window duration (ms) */
export const RATE_LIMIT_WINDOW_MS = 60_000;

// ── Single-registry model allowlist (Tasks A1 + A2) ──

/**
 * W8-S-03: Additional pinned model IDs that operators may select via
 * `OPENAI_MODEL` beyond the per-provider defaults above. OpenAI's current
 * 5.x version IDs are pinned releases (no dated public snapshots are
 * published for this line). Floating aliases (e.g. "gpt-4o-mini",
 * "chat-latest") are still rejected to prevent silent safety regressions.
 */
export const PINNED_SNAPSHOT_MODELS: readonly string[] = ["gpt-5.5", "gpt-5.4", "gpt-5.4-nano"];

/**
 * F-AI-07 / W8-S-03: The model allowlist, generated from the single provider
 * registry plus explicitly pinned snapshot IDs. Previously a hand-maintained
 * duplicate set inside config.ts (the dual-config problem, Task A1).
 */
export const ALLOWED_MODELS: ReadonlySet<string> = new Set<string>([
  ...Object.values(PROVIDER_MODELS).map((m) => m.model),
  ...PINNED_SNAPSHOT_MODELS,
]);

// ── Deprecated alias resolution (Task A2) ──

/**
 * Decommissioned or superseded model IDs mapped to their current
 * replacement. When an operator-saved pin (e.g. `OPENAI_MODEL` set before a
 * registry refresh) references one of these, it auto-resolves to the
 * replacement — with a logged warning — instead of 404ing at the provider.
 *
 * Deliberately NOT included: floating aliases that were never allowed
 * (e.g. "gpt-4o-mini"). Those must keep failing the allowlist (W8-S-03).
 * Targets must always be members of `ALLOWED_MODELS` and must never appear
 * as keys themselves (no alias chains) — enforced by unit tests.
 */
export const DEPRECATED_MODEL_ALIASES: Readonly<Record<string, string>> = {
  // Groq decommissioned the 3.1 70B; 3.3 70B is its documented replacement.
  "llama-3.1-70b-versatile": "llama-3.3-70b-versatile",
  // Google shut down the Gemini 2.0 family.
  "gemini-2.0-flash": "gemini-3.5-flash",
  // Anthropic retires Claude Sonnet 4 on 2026-06-15.
  "claude-sonnet-4-20250514": "claude-sonnet-4-6",
  // OpenAI 4.x line superseded by the 5.4 family (former registry default
  // and former PINNED_SNAPSHOT_MODELS entries).
  "gpt-4.1-mini": "gpt-5.4-mini",
  "gpt-4o-mini-2024-07-18": "gpt-5.4-mini",
  "gpt-4o-2024-08-06": "gpt-5.4",
  "gpt-4o-2024-11-20": "gpt-5.4",
  // DeepSeek retires deepseek-chat / deepseek-reasoner on 2026-07-24.
  "deepseek-chat": "deepseek-v4-flash",
  "deepseek-reasoner": "deepseek-v4-flash",
  // Former floating registry default (W8-S-03) and retiring dated versions.
  "mistral-small-latest": "mistral-small-2603",
  "mistral-small-2506": "mistral-small-2603",
  "mistral-small-2503": "mistral-small-2603",
  // xAI superseded the grok-3 line.
  "grok-3-mini": "grok-4.3",
};

/** Result of resolving a (possibly deprecated) model ID. */
export interface ModelAliasResolution {
  /** The ID to actually send to the provider. */
  model: string;
  /** True when the input was a deprecated ID rewritten to its replacement. */
  deprecated: boolean;
  /** The original deprecated ID, present when `deprecated` is true. */
  original?: string;
}

/**
 * Resolve a model ID through the deprecated-alias map. Unknown IDs pass
 * through untouched (and will then fail the `ALLOWED_MODELS` check as
 * before — this function never widens the allowlist). Callers are
 * responsible for logging a warning when `deprecated` is true.
 */
export function resolveModelAlias(model: string): ModelAliasResolution {
  const replacement = DEPRECATED_MODEL_ALIASES[model];
  if (replacement) {
    return { model: replacement, deprecated: true, original: model };
  }
  return { model, deprecated: false };
}

/**
 * Providers whose chat APIs are OpenAI-wire-compatible, with their base URLs.
 *
 * Legacy `resolveAIConfig()` consumers POST raw OpenAI-format JSON to
 * `${baseUrl}/chat/completions` (including `response_format: json_object`),
 * so the compatibility wrapper may only select these providers. `anthropic`
 * and `google` use native adapters (providers.ts) and stay reachable through
 * `routeAIRequest()` until the AI SDK migration (Task A3). `workers_ai` is
 * also OpenAI-compatible but its base URL depends on the Cloudflare account
 * ID, so it is assembled in config.ts.
 */
export const OPENAI_COMPAT_BASE_URLS: Partial<Record<AIProvider, string>> = {
  openai: "https://api.openai.com/v1",
  groq: "https://api.groq.com/openai/v1",
  deepseek: "https://api.deepseek.com",
  mistral: "https://api.mistral.ai/v1",
  xai: "https://api.x.ai/v1",
};
