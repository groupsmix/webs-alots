import { NextRequest } from "next/server";
import { apiSuccess, apiError, apiForbidden } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase-server";

/**
 * GET /api/cron/ai-token-reset
 *
 * A1-05: Monthly cron that resets AI token budget counters.
 * Called by Cloudflare Cron Triggers on the 1st of each month at 00:01 UTC.
 *
 * Security: Requires CRON_SECRET header to prevent unauthorized triggering.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const expectedAuth = cronSecret ? `Bearer ${cronSecret}` : null;

  if (!expectedAuth || authHeader !== expectedAuth) {
    logger.warn("Unauthorized ai-token-reset cron trigger attempt", {
      context: "cron/ai-token-reset",
    });
    return apiForbidden("Unauthorized");
  }

  try {
    const supabase = createAdminClient();

    // Call the DB function to reset monthly counters and log the event
    const { data, error } = await supabase.rpc(
      "reset_monthly_ai_tokens" as Parameters<typeof supabase.rpc>[0]
    );

    if (error) {
      logger.error("AI token budget reset RPC failed", {
        context: "cron/ai-token-reset",
        error,
      });
      return apiError("AI token reset failed", 500);
    }

    logger.info("Monthly AI token budget reset complete", {
      context: "cron/ai-token-reset",
      clinicsReset: data,
    });

    return apiSuccess({ reset: true, clinicsReset: data });
  } catch (err) {
    logger.error("AI token reset cron threw exception", {
      context: "cron/ai-token-reset",
      error: err,
    });
    return apiError("AI token reset failed", 500);
  }
}
