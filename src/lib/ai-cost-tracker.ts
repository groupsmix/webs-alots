/**
 * A62-G1: AI Cost Tracking and Budget Monitoring
 *
 * Problem:
 *   No tracking of AI API spending. Without visibility:
 *   - Cost overruns go undetected until monthly bill arrives
 *   - Clinics can't be billed fairly for their AI usage
 *   - Runaway requests (e.g., loops calling patient-summary) exhaust budget silently
 *
 * Solution:
 *   - Log every AI request to ai_cost_log table with token counts and estimated cost
 *   - Provide helper to check month-to-date spending for budget alerts
 *   - Cost model defaults for GPT-4, GPT-3.5, Claude-3 (update as pricing changes)
 */

import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cost per token (in USD) for each AI model.
 * Update these values when provider pricing changes.
 */
export const AI_MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 0.00005, output: 0.00015 }, // GPT-4o (latest)
  "gpt-4": { input: 0.00003, output: 0.00006 }, // GPT-4 (standard)
  "gpt-3.5-turbo": { input: 0.0005, output: 0.0015 }, // GPT-3.5 (cheap)
  "claude-3-opus": { input: 0.015, output: 0.075 }, // Claude-3 Opus (smart)
  "claude-3-sonnet": { input: 0.003, output: 0.015 }, // Claude-3 Sonnet (balanced)
  "claude-3-haiku": { input: 0.00025, output: 0.00125 }, // Claude-3 Haiku (fast)
  "google-gemini-pro": { input: 0.0005, output: 0.0015 }, // Gemini Pro
};

/**
 * Log an AI request to the cost tracking table.
 * Called after every AI API invocation.
 *
 * @param supabase Authenticated Supabase client
 * @param clinicId Clinic ID for cost attribution
 * @param route API route used (e.g., /api/v1/ai/patient-summary)
 * @param model AI model name (must be in AI_MODEL_COSTS)
 * @param inputTokens Number of input tokens sent to the model
 * @param outputTokens Number of output tokens returned
 * @param durationMs Request duration in milliseconds (for latency tracking)
 */
export async function logAICost(
  supabase: SupabaseClient,
  clinicId: string,
  route: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  durationMs?: number,
): Promise<void> {
  try {
    const costs = AI_MODEL_COSTS[model] || { input: 0, output: 0 };
    const estimatedCostUsd = inputTokens * costs.input + outputTokens * costs.output;

    await supabase.from("ai_cost_log").insert({
      clinic_id: clinicId,
      route,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      estimated_cost_usd: estimatedCostUsd,
      duration_ms: durationMs,
    });
  } catch (err) {
    // Non-fatal — log but don't crash the AI request
    console.error("ai-cost-tracker: failed to log cost", { clinicId, route, model, error: err });
  }
}

/**
 * Get total AI spending for a clinic in the last 30 days.
 * Used for budget alerts and clinic billing.
 *
 * @param supabase Authenticated Supabase client
 * @param clinicId Clinic ID
 * @returns Total estimated cost in USD
 */
export async function getAICostLast30Days(
  supabase: SupabaseClient,
  clinicId: string,
): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("ai_cost_log")
    .select("estimated_cost_usd")
    .eq("clinic_id", clinicId)
    .gte("created_at", thirtyDaysAgo);

  if (error) {
    console.error("ai-cost-tracker: failed to fetch costs", { clinicId, error });
    return 0;
  }

  return (data || []).reduce(
    (sum: number, row: { estimated_cost_usd: number | null }) =>
      sum + (row.estimated_cost_usd || 0),
    0,
  );
}

/**
 * Get AI spending breakdown by route for a clinic (last 30 days).
 * Used for per-feature cost analysis and optimization.
 *
 * @param supabase Authenticated Supabase client
 * @param clinicId Clinic ID
 * @returns Array of {route, total_cost, request_count}
 */
export async function getAICostByRoute(
  supabase: SupabaseClient,
  clinicId: string,
): Promise<Array<{ route: string; total_cost: number; request_count: number }>> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("ai_cost_log")
    .select("route, estimated_cost_usd")
    .eq("clinic_id", clinicId)
    .gte("created_at", thirtyDaysAgo);

  if (error) {
    console.error("ai-cost-tracker: failed to fetch costs by route", { clinicId, error });
    return [];
  }

  const costByRoute: Record<string, { total: number; count: number }> = {};
  for (const row of data || []) {
    if (!costByRoute[row.route]) {
      costByRoute[row.route] = { total: 0, count: 0 };
    }
    costByRoute[row.route].total += row.estimated_cost_usd || 0;
    costByRoute[row.route].count += 1;
  }

  return Object.entries(costByRoute).map(([route, { total, count }]) => ({
    route,
    total_cost: total,
    request_count: count,
  }));
}

/**
 * Example: How to use in an AI route.
 *
 * ```ts
 * import { logAICost } from "@/lib/ai-cost-tracker";
 *
 * export const POST = async (req: NextRequest) => {
 *   const startMs = Date.now();
 *
 *   // ... call AI model
 *   const response = await openai.chat.completions.create({...});
 *   const inputTokens = response.usage.prompt_tokens;
 *   const outputTokens = response.usage.completion_tokens;
 *   const durationMs = Date.now() - startMs;
 *
 *   // Log the cost
 *   await logAICost(
 *     supabase,
 *     clinicId,
 *     "/api/v1/ai/patient-summary",
 *     "gpt-4",
 *     inputTokens,
 *     outputTokens,
 *     durationMs
 *   );
 *
 *   return apiSuccess({ ... });
 * };
 * ```
 */
