/**
 * Cron Route — Daily Usage Snapshots & Overage Alerts
 *
 * Runs at 01:00 UTC daily.
 * For every active clinic:
 *   1. Snapshots yesterday's usage into usage_snapshots (for trend analysis).
 *   2. Checks current-month usage against plan limits and fires in-app
 *      notifications at 80% and 100% thresholds (deduped per month).
 *
 * Protected by CRON_SECRET bearer token.
 */

import { NextRequest } from "next/server";
import { apiInternalError, apiSuccess } from "@/lib/api-response";
import { assertClinicId } from "@/lib/assert-tenant";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { withSentryCron } from "@/lib/sentry-cron";
import { createAdminClient } from "@/lib/supabase-server";
import { checkAndSendUsageAlerts, snapshotDailyUsage } from "@/lib/usage-alerts";

async function handler(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  const supabase = createAdminClient("cron");

  // Compute yesterday's date in UTC (YYYY-MM-DD)
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  // Fetch all active clinics
  // nosemgrep: tenant-scoping — intentional cross-tenant query for cron job
  const { data: clinics, error: clinicsError } = await supabase
    .from("clinics")
    .select("id, name, is_active")
    .eq("is_active", true);

  if (clinicsError) {
    logger.error("cron/usage-snapshots: failed to fetch clinics", {
      context: "cron/usage-snapshots",
      error: clinicsError.message,
    });
    return apiInternalError("Failed to fetch clinics");
  }

  const active = (clinics ?? []).filter((c: { id: string; name: string; is_active: boolean }) => {
    if (!c.id) return false;
    try {
      assertClinicId(c.id, "cron/usage-snapshots");
      return true;
    } catch {
      logger.warn("cron/usage-snapshots: skipping clinic with invalid id", {
        context: "cron/usage-snapshots",
        clinicId: c.id,
      });
      return false;
    }
  });

  logger.info("cron/usage-snapshots: starting", {
    context: "cron/usage-snapshots",
    clinicCount: active.length,
    snapshotDate: yesterdayStr,
  });

  let snapped = 0;
  let totalAlerted = 0;
  const BATCH_SIZE = 10;

  for (let i = 0; i < active.length; i += BATCH_SIZE) {
    const batch = active.slice(i, i + BATCH_SIZE);

    await Promise.allSettled(
      batch.map(async (clinic: { id: string; name: string; is_active: boolean }) => {
        try {
          // 1. Snapshot yesterday's usage
          await snapshotDailyUsage(supabase, clinic.id, yesterdayStr);
          snapped++;

          // 2. Check and send overage alerts for this month's usage
          const { alertsSent } = await checkAndSendUsageAlerts(
            supabase,
            clinic.id,
            clinic.name ?? clinic.id,
          );
          totalAlerted += alertsSent;
        } catch (err) {
          logger.error("cron/usage-snapshots: failed for clinic", {
            context: "cron/usage-snapshots",
            clinicId: clinic.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }),
    );
  }

  logger.info("cron/usage-snapshots: completed", {
    context: "cron/usage-snapshots",
    snapped,
    totalAlerted,
    snapshotDate: yesterdayStr,
  });

  return apiSuccess({ snapped, alerted: totalAlerted, snapshotDate: yesterdayStr });
}

export const GET = withSentryCron("usage-snapshots", "0 1 * * *", handler);
