/**
 * Cron Route — Subscription Billing Renewal
 *
 * Called daily (e.g., via Cloudflare Cron Trigger at 2am UTC) to process
 * subscription renewals for all active clinics.
 *
 * Protected by CRON_SECRET to prevent unauthorized access.
 */

import { NextRequest } from "next/server";
import { apiInternalError, apiSuccess } from "@/lib/api-response";
import { assertClinicId } from "@/lib/assert-tenant";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { withSentryCron } from "@/lib/sentry-cron";
import { processRenewal } from "@/lib/subscription-billing";
// B-02: Cron jobs have no user session — use service-role client.
import { createAdminClient } from "@/lib/supabase-server";

async function handler(request: NextRequest) {
  // DRY: Use shared cron secret verification helper
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  const supabase = createAdminClient();

  // Fetch all active subscriptions that may need renewal
  const today = new Date().toISOString().split("T")[0];
  const { data: subscriptions, error } = await supabase
    .from("clinic_subscriptions")
    .select("clinic_id, current_period_end, status")
    .in("status", ["active", "past_due"])
    .lte("current_period_end", today);

  if (error) {
    return apiInternalError("Failed to fetch subscriptions");
  }

  logger.info("Billing cron started", {
    context: "cron/billing",
    subscriptionCount: subscriptions?.length ?? 0,
  });

  const results: { clinicId: string; success: boolean; error?: string }[] = [];
  const BATCH_SIZE = 10;
  // SAFETY ASSERTION: Filter out any subscriptions without a valid clinic_id
  // to prevent cross-tenant operations. This should never happen with correct
  // data integrity but acts as defense-in-depth.
  const subs = (subscriptions ?? []).filter((sub) => {
    if (!sub.clinic_id) {
      results.push({ clinicId: "unknown", success: false, error: "Missing clinic_id — skipped for tenant safety" });
      return false;
    }
    try {
      assertClinicId(sub.clinic_id, "cron/billing:subscription");
    } catch {
      logger.warn("Invalid clinic_id on subscription — skipped", {
        context: "cron/billing",
        clinicId: sub.clinic_id,
      });
      results.push({ clinicId: sub.clinic_id, success: false, error: "Invalid clinic_id format" });
      return false;
    }
    return true;
  });

  for (let i = 0; i < subs.length; i += BATCH_SIZE) {
    const batch = subs.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(
      batch.map((sub) => processRenewal(sub.clinic_id)),
    );
    for (let j = 0; j < batch.length; j++) {
      const outcome = settled[j];
      if (outcome.status === "fulfilled") {
        results.push({
          clinicId: batch[j].clinic_id,
          success: outcome.value.success,
          error: outcome.value.error,
        });
      } else {
        results.push({
          clinicId: batch[j].clinic_id,
          success: false,
          error: outcome.reason instanceof Error ? outcome.reason.message : "Unknown error",
        });
      }
    }
  }

  const renewed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return apiSuccess({
    processed: results.length,
    renewed,
    failed,
    results,
    timestamp: new Date().toISOString(),
  });
}

export const GET = withSentryCron("billing-daily-2am", "0 2 * * *", handler);
