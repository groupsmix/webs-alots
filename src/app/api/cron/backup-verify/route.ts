import { NextRequest } from "next/server";
import { apiSuccess, apiInternalError } from "@/lib/api-response";
import { verifyDailyBackup } from "@/lib/automation/backup-verifier";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";

/**
 * GET /api/cron/backup-verify
 *
 * Daily cron job to verify that DB backups were successful.
 * Runs at 6 AM after all nightly maintenance tasks.
 */
export async function GET(req: NextRequest) {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  try {
    const result = await verifyDailyBackup();

    if (result.status === "failed") {
      logger.error("CRITICAL: Daily backup verification failed!", {
        context: "cron/backup-verify",
        details: result.message,
      });
      // In a real system, send PagerDuty alert, Slack message to DevOps, etc.
    } else {
      logger.info("Backup verification passed", {
        context: "cron/backup-verify",
        sizeMB: result.backupSizeMB,
        lastBackup: result.lastBackupTime,
      });
    }

    return apiSuccess({
      message: "Backup verification complete",
      result,
    });
  } catch (err) {
    logger.error("Backup verification cron failed", {
      context: "cron/backup-verify",
      error: err instanceof Error ? err.message : String(err),
    });
    return apiInternalError("Backup verification execution failed");
  }
}
