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
  /** Caller context for logging */
  context?: string;
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
  queueWaitMs?: number;
}

/** Provider configuration stored in DB */
export interface ProviderConfig {
  provider: AIProvider;
  displayName: string;
  apiKey: string | null;
  isActive: boolean;
  routingTier: RoutingTier;
  fallbackProvider: AIProvider | null;
  monthlyBudgetCents: number;
  requestsThisMonth: number;
  tokensThisMonth: number;
  lastError: string | null;
}

/** Provider rate limit state (in-memory) */
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
  supportsStreaming: boolean;
  rpmLimit: number; // requests per minute
}

/** Queue status shown to users */
export interface QueueStatus {
  queued: boolean;
  position: number;
  estimatedWaitMs: number;
  provider: AIProvider | null;
}

/** Feature toggle state */
export interface AIFeatureToggle {
  featureKey: string;
  displayName: string;
  description: string | null;
  isEnabled: boolean;
  minTier: RoutingTier;
}
