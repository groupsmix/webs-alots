/**
 * F-AI-10: Per-clinic monthly AI usage cap.
 *
 * Prevents a single clinic from consuming disproportionate AI resources
 * by enforcing a configurable monthly limit on AI operations.
 *
 * The cap is checked before each AI call. Usage is tracked via the
 * existing `billing_events` table with type='ai_*'.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

/** Default monthly AI call limit per clinic (configurable via clinic config). */
const DEFAULT_MONTHLY_CAP = 500;

/**
 * Check if a clinic has exceeded its monthly AI usage cap.
 *
 * @param supabase - Supabase client (service role or authenticated)
 * @param clinicId - The clinic to check
 * @param monthlyCapOverride - Optional override from clinic config
 * @returns true if the clinic is under the cap, false if exceeded
 */
export async function checkAIUsageCap(
  supabase: SupabaseClient,
  clinicId: string,
  monthlyCapOverride?: number,
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const limit = monthlyCapOverride ?? DEFAULT_MONTHLY_CAP;
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

  try {
    // Count AI billing events for this clinic in the current month.
    // The billing_events table is already scoped by clinic_id via RLS.
    const { count, error } = await supabase
      .from("billing_events")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .like("type", "ai_%")
      .gte("created_at", `${currentMonth}-01T00:00:00Z`);

    if (error) {
      logger.warn("Failed to check AI usage cap — allowing request", {
        context: "ai-cost-cap",
        clinicId,
        error,
      });
      // Fail-open: allow the request if we can't check
      return { allowed: true, used: 0, limit };
    }

    const used = count ?? 0;
    return { allowed: used < limit, used, limit };
  } catch (err) {
    logger.warn("AI usage cap check error — allowing request", {
      context: "ai-cost-cap",
      clinicId,
      error: err,
    });
    return { allowed: true, used: 0, limit };
  }
}
