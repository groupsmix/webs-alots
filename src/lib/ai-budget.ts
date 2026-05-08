/**
 * AI Token Budget Enforcement
 *
 * A1-01: Prevents unbounded AI token consumption by enforcing per-tenant
 * monthly token limits based on user role. Protects against:
 * - Token exhaustion attacks (malicious users draining clinic budgets)
 * - Accidental over-consumption (bugs, infinite loops)
 * - Financial losses (uncontrolled OpenAI API costs)
 *
 * Token limits are role-based:
 * - patient: 10,000 tokens/month (basic queries)
 * - receptionist: 20,000 tokens/month (moderate usage)
 * - doctor: 50,000 tokens/month (clinical decision support)
 * - clinic_admin: 100,000 tokens/month (management queries)
 * - super_admin: 1,000,000 tokens/month (system-wide access)
 *
 * Usage tracking:
 * - Stored in `clinics.ai_monthly_tokens` (atomic increment via RPC)
 * - Reset monthly via `clinics.ai_tokens_reset_at` timestamp
 * - Checked before AI API calls (fail-fast to avoid wasted requests)
 * - Incremented after successful AI responses (actual token count)
 *
 * @example
 *   const { allowed, remaining } = await checkAiTokenBudget(
 *     supabase,
 *     clinicId,
 *     profile.role,
 *     estimatedTokens,
 *   );
 *   if (!allowed) {
 *     return apiError(`AI budget exceeded. ${remaining} tokens remaining.`, 429);
 *   }
 *   // ... make AI call ...
 *   await incrementAiTokenUsage(supabase, clinicId, actualTokensUsed);
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "./logger";
import type { UserRole } from "./types/database";

/**
 * Monthly token limits per role.
 *
 * These limits are conservative estimates based on typical usage patterns:
 * - 1 token ≈ 4 characters of English text
 * - Average chat message: 100-200 tokens
 * - Average prescription generation: 300-500 tokens
 * - Average patient summary: 500-1000 tokens
 *
 * Limits can be adjusted per-clinic via database override (future enhancement).
 */
export const AI_TOKEN_LIMITS: Record<UserRole, number> = {
  patient: 10_000,        // ~50 chat messages or 20 prescriptions
  receptionist: 20_000,   // ~100 chat messages or 40 prescriptions
  doctor: 50_000,         // ~250 chat messages or 100 prescriptions
  clinic_admin: 100_000,  // ~500 chat messages or 200 prescriptions
  super_admin: 1_000_000, // System-wide access, no practical limit
};

/**
 * Rough token estimation heuristic: 1 token ≈ 4 characters.
 *
 * This is a conservative estimate for English text. Actual token counts
 * vary by language, vocabulary, and tokenizer (GPT-3.5/4 use tiktoken).
 * We intentionally overestimate to avoid budget exhaustion.
 *
 * @param text - Input text to estimate tokens for
 * @returns Estimated token count (rounded up)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Check if a clinic has sufficient AI token budget for a request.
 *
 * This function:
 * 1. Retrieves current month's token usage from the database
 * 2. Checks if monthly reset is needed (first day of new month)
 * 3. Compares current usage + estimated tokens against role limit
 * 4. Returns whether the request is allowed and remaining budget
 *
 * @param supabase - Authenticated Supabase client
 * @param clinicId - Clinic UUID
 * @param role - User role (determines token limit)
 * @param estimatedTokens - Estimated tokens for this request
 * @returns Object with `allowed` boolean and `remaining` token count
 *
 * @example
 *   const { allowed, remaining } = await checkAiTokenBudget(
 *     supabase,
 *     "clinic-uuid",
 *     "doctor",
 *     500,
 *   );
 *   if (!allowed) {
 *     return apiError(`Budget exceeded. ${remaining} tokens left.`, 429);
 *   }
 */
export async function checkAiTokenBudget(
  supabase: SupabaseClient,
  clinicId: string,
  role: UserRole,
  estimatedTokens: number,
): Promise<{ allowed: boolean; remaining: number }> {
  // Get role-based limit (default to patient limit if role not found)
  const limit = AI_TOKEN_LIMITS[role] ?? AI_TOKEN_LIMITS.patient;

  // Query current usage from clinic config
  const { data: clinic, error } = await supabase
    .from("clinics")
    .select("ai_monthly_tokens, ai_tokens_reset_at")
    .eq("id", clinicId)
    .single();

  if (error || !clinic) {
    logger.error("Failed to fetch AI token budget", {
      context: "ai-budget/check",
      clinicId,
      role,
      error,
    });
    // Fail-closed: deny request if we can't verify budget
    return { allowed: false, remaining: 0 };
  }

  // Check if monthly reset is needed (first day of new month)
  const now = new Date();
  const resetAt = clinic.ai_tokens_reset_at ? new Date(clinic.ai_tokens_reset_at) : null;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const shouldReset = !resetAt || resetAt < monthStart;

  // Reset counter if month boundary crossed
  let currentUsage = shouldReset ? 0 : (clinic.ai_monthly_tokens ?? 0);

  if (shouldReset) {
    // Reset usage counter for new month
    const { error: resetError } = await supabase
      .from("clinics")
      .update({
        ai_monthly_tokens: 0,
        ai_tokens_reset_at: monthStart.toISOString(),
      })
      .eq("id", clinicId);

    if (resetError) {
      logger.error("Failed to reset AI token counter", {
        context: "ai-budget/reset",
        clinicId,
        error: resetError,
      });
      // Continue with old usage value (fail-safe)
    } else {
      currentUsage = 0;
      logger.info("AI token budget reset for new month", {
        context: "ai-budget/reset",
        clinicId,
        role,
        limit,
      });
    }
  }

  // Check if request would exceed limit
  const projectedUsage = currentUsage + estimatedTokens;
  const remaining = Math.max(0, limit - currentUsage);

  if (projectedUsage > limit) {
    logger.warn("AI token budget exceeded", {
      context: "ai-budget/check",
      clinicId,
      role,
      currentUsage,
      limit,
      estimatedTokens,
      remaining,
    });
    return { allowed: false, remaining };
  }

  return { allowed: true, remaining: remaining - estimatedTokens };
}

/**
 * Increment AI token usage after a successful AI API call.
 *
 * This function atomically increments the clinic's monthly token counter
 * using a database RPC to avoid race conditions. Should be called after
 * receiving the AI response with the actual token count from the API.
 *
 * @param supabase - Authenticated Supabase client
 * @param clinicId - Clinic UUID
 * @param tokensUsed - Actual tokens consumed by the AI API call
 *
 * @example
 *   const response = await openai.chat.completions.create({ ... });
 *   const tokensUsed = response.usage?.total_tokens ?? 0;
 *   await incrementAiTokenUsage(supabase, clinicId, tokensUsed);
 */
export async function incrementAiTokenUsage(
  supabase: SupabaseClient,
  clinicId: string,
  tokensUsed: number,
): Promise<void> {
  if (tokensUsed <= 0) {
    // No tokens used, nothing to increment
    return;
  }

  const { error } = await supabase.rpc("increment_ai_tokens", {
    p_clinic_id: clinicId,
    p_tokens: tokensUsed,
  });

  if (error) {
    logger.error("Failed to increment AI token usage", {
      context: "ai-budget/increment",
      clinicId,
      tokensUsed,
      error,
    });
    // Don't throw - token tracking failure shouldn't break the AI response
    // The user already got their answer, we just failed to bill them
  } else {
    logger.info("AI token usage incremented", {
      context: "ai-budget/increment",
      clinicId,
      tokensUsed,
    });
  }
}

/**
 * Get current AI token usage and limit for a clinic.
 *
 * Useful for displaying budget information in admin dashboards.
 *
 * @param supabase - Authenticated Supabase client
 * @param clinicId - Clinic UUID
 * @param role - User role (determines limit)
 * @returns Object with current usage, limit, and remaining tokens
 */
export async function getAiTokenBudgetStatus(
  supabase: SupabaseClient,
  clinicId: string,
  role: UserRole,
): Promise<{
  usage: number;
  limit: number;
  remaining: number;
  resetAt: string | null;
}> {
  const limit = AI_TOKEN_LIMITS[role] ?? AI_TOKEN_LIMITS.patient;

  const { data: clinic } = await supabase
    .from("clinics")
    .select("ai_monthly_tokens, ai_tokens_reset_at")
    .eq("id", clinicId)
    .single();

  if (!clinic) {
    return { usage: 0, limit, remaining: limit, resetAt: null };
  }

  const usage = clinic.ai_monthly_tokens ?? 0;
  const remaining = Math.max(0, limit - usage);

  return {
    usage,
    limit,
    remaining,
    resetAt: clinic.ai_tokens_reset_at,
  };
}

/**
 * A42.3: Per-clinic concurrent AI request limiting.
 *
 * Prevents botnet abuse by limiting the number of in-flight LLM calls per
 * clinic. This protects against:
 * - Distributed attacks where multiple IPs from the same clinic flood AI endpoints
 * - Accidental infinite loops that spawn concurrent AI requests
 * - Cost exhaustion from parallel request storms
 *
 * The limit is enforced using KV as a distributed counter:
 * - Key: `ai-concurrent:${clinicId}`
 * - Value: Current number of in-flight requests
 * - TTL: 60 seconds (auto-cleanup for stuck requests)
 *
 * Maximum concurrent requests per clinic: 5
 *
 * @param kv - Cloudflare KV namespace binding (RATE_LIMIT_KV)
 * @param clinicId - Clinic UUID
 * @returns Object with `allowed` boolean and `current` concurrent request count
 *
 * @example
 *   const { allowed, current } = await checkConcurrentAiRequests(env.RATE_LIMIT_KV, clinicId);
 *   if (!allowed) {
 *     return apiError(`Too many concurrent AI requests. ${current}/5 in progress.`, 429);
 *   }
 *   // ... make AI call ...
 *   await decrementConcurrentAiRequests(env.RATE_LIMIT_KV, clinicId);
 */
export async function checkConcurrentAiRequests(
  kv: KVNamespace | undefined,
  clinicId: string,
): Promise<{ allowed: boolean; current: number }> {
  // If KV is not available (local dev), allow all requests
  if (!kv) {
    logger.warn("KV namespace not available, skipping concurrent AI request check", {
      context: "ai-budget/concurrent-check",
      clinicId,
    });
    return { allowed: true, current: 0 };
  }

  const MAX_CONCURRENT = 5;
  const key = `ai-concurrent:${clinicId}`;

  try {
    // Get current concurrent request count
    const currentStr = await kv.get(key);
    const current = currentStr ? parseInt(currentStr, 10) : 0;

    if (current >= MAX_CONCURRENT) {
      logger.warn("Concurrent AI request limit exceeded", {
        context: "ai-budget/concurrent-check",
        clinicId,
        current,
        limit: MAX_CONCURRENT,
      });
      return { allowed: false, current };
    }

    // Increment counter with 60-second TTL (auto-cleanup for stuck requests)
    await kv.put(key, String(current + 1), { expirationTtl: 60 });

    return { allowed: true, current: current + 1 };
  } catch (error) {
    logger.error("Failed to check concurrent AI requests", {
      context: "ai-budget/concurrent-check",
      clinicId,
      error,
    });
    // Fail-open: allow request if KV check fails (avoid blocking legitimate users)
    return { allowed: true, current: 0 };
  }
}

/**
 * Decrement the concurrent AI request counter after a request completes.
 *
 * Should be called in a finally block to ensure the counter is decremented
 * even if the AI request fails.
 *
 * @param kv - Cloudflare KV namespace binding (RATE_LIMIT_KV)
 * @param clinicId - Clinic UUID
 *
 * @example
 *   try {
 *     const response = await openai.chat.completions.create({ ... });
 *     return apiSuccess({ response });
 *   } finally {
 *     await decrementConcurrentAiRequests(env.RATE_LIMIT_KV, clinicId);
 *   }
 */
export async function decrementConcurrentAiRequests(
  kv: KVNamespace | undefined,
  clinicId: string,
): Promise<void> {
  if (!kv) return;

  const key = `ai-concurrent:${clinicId}`;

  try {
    const currentStr = await kv.get(key);
    const current = currentStr ? parseInt(currentStr, 10) : 0;

    if (current > 0) {
      // Decrement counter, keep TTL to auto-cleanup
      await kv.put(key, String(current - 1), { expirationTtl: 60 });
    } else {
      // Counter is already 0, delete the key
      await kv.delete(key);
    }
  } catch (error) {
    logger.error("Failed to decrement concurrent AI requests", {
      context: "ai-budget/concurrent-decrement",
      clinicId,
      error,
    });
    // Don't throw - counter cleanup failure shouldn't break the response
  }
}

// Type definition for Cloudflare KV namespace (for TypeScript)
interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}
