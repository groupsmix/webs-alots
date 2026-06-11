/**
 * Shared types for the AI multi-model routing system.
 */

/** Supported AI providers */
export type AIProvider =
  | "workers_ai"
  | "anthropic"
  | "google"
  | "deepseek"
  | "groq"
  | "openai"
  | "mistral"
  | "xai";

/** Routing tiers — lower = cheaper/faster, higher = smarter/pricier */
export type RoutingTier = 0 | 1 | 2 | 3;

/** Task complexity levels that drive model selection */
export type TaskComplexity = "simple" | "medium" | "complex" | "critical";

/** Task types the router recognizes */
export type AITaskType =
  | "classify"
  | "summarize"
  | "generate"
  | "translate"
  | "analyze"
  | "reason"
  | "code"
  | "conversation";

/** A request to the AI router */
export interface AIRequest {
  task: AITaskType;
  complexity: TaskComplexity;
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  /** Force a specific provider (bypass routing) */
  forceProvider?: AIProvider;
  /** Optional feature key for toggle-gated access (see feature-toggles.ts) */
  featureKey?: string;
  /** Caller context for logging (also stored in ai_usage_logs.context) */
  context?: string;
  /** Clinic ID for tracing (E1) — set by route handlers */
  clinicId?: string;
  /** F-AI-14 / AUDIT P1-11: reproducibility seed, passed to the provider and logged */
  seed?: number;
}

/** Successful AI response */
export interface AIResponse {
  text: string;
  provider: AIProvider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  costCents: number;
  fromFallback: boolean;
}

/** Provider configuration stored in DB */
export interface ProviderConfig {
  provider: AIProvider;
  displayName: string;
  /** Decrypted plaintext API key. Stored encrypted at rest, decrypted on load. */
  apiKey: string | null;
  isActive: boolean;
  routingTier: RoutingTier;
  fallbackProvider: AIProvider | null;
  monthlyBudgetCents: number;
  requestsThisMonth: number;
  /** Total (input + output) tokens this month — kept for backward-compat. */
  tokensThisMonth: number;
  /** Input tokens this month (tracked separately for accurate cost reporting). */
  inputTokensThisMonth: number;
  /** Output tokens this month. */
  outputTokensThisMonth: number;
  /** Actual cost this month in cents (NUMERIC from DB, stored as JS number). */
  costThisMonthCents: number;
  /** Epoch ms when persisted rate limit expires, or null. */
  rateLimitedUntil: number | null;
  lastError: string | null;
}

/** Provider rate limit state (in-memory per instance) */
export interface RateLimitState {
  provider: AIProvider;
  requestsInWindow: number;
  windowResetAt: number;
  isRateLimited: boolean;
  retryAfterMs: number;
}

/** Model definition per provider */
export interface ModelConfig {
  provider: AIProvider;
  model: string;
  maxContextTokens: number;
  costPerInputToken: number; // in cents per 1M tokens
  costPerOutputToken: number; // in cents per 1M tokens
  rpmLimit: number; // requests per minute
}

/** Feature toggle state */
export interface AIFeatureToggle {
  featureKey: string;
  displayName: string;
  description: string | null;
  isEnabled: boolean;
  minTier: RoutingTier;
}
