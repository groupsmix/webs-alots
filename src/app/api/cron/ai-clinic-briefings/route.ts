/**
 * GET /api/cron/ai-clinic-briefings
 *
 * Generates AI-powered executive clinic briefings for all active clinics.
 * Called by Cloudflare Worker cron at 06:00 Africa/Casablanca.
 *
 * Protected by CRON_SECRET via Authorization: Bearer header.
 *
 * OWASP A07: Rate-limited by cron infrastructure (one call per schedule).
 * OWASP A04: Briefings scoped per-clinic — no cross-tenant data.
 * OWASP A03: Only aggregate numbers sent to LLM — no PHI.
 */

import { type NextRequest } from "next/server";
import { generateDailyClinicBriefings } from "@/lib/ai/clinic-briefings";
import { apiInternalError, apiSuccess } from "@/lib/api-response";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { withSentryCron } from "@/lib/sentry-cron";
import { createAdminClient } from "@/lib/supabase-server";

async function handler(request: NextRequest) {
  // OWASP A07: Verify cron secret before processing
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  try {
    const supabase = createAdminClient("cron-ai-briefings");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const count = await generateDailyClinicBriefings(supabase as any);

    logger.info("AI clinic briefings cron completed", {
      context: "cron/ai-clinic-briefings",
      generated: count,
    });

    return apiSuccess({
      generated: count,
      message: `${count} briefing(s) IA générés avec succès`,
    });
  } catch (err) {
    logger.error("AI clinic briefings cron failed", {
      context: "cron/ai-clinic-briefings",
      error: err instanceof Error ? err.message : String(err),
    });
    return apiInternalError("Échec de la génération des briefings IA cliniques");
  }
}

// Runs at 06:00 Africa/Casablanca (UTC+1) = 05:00 UTC
export const GET = withSentryCron("ai-clinic-briefings", "0 5 * * *", handler);
