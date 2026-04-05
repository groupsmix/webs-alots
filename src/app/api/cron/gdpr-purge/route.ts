/**
 * GET /api/cron/gdpr-purge
 *
 * MED-13 FIX: Permanent deletion of soft-deleted patient accounts after
 * the GDPR retention period (30 days). This cron job runs daily and:
 *
 * 1. Finds users with deleted_at > 30 days ago
 * 2. Permanently deletes their PHI from the database
 * 3. Deletes their encrypted files from R2 storage
 * 4. Logs the deletion for compliance audit trail
 *
 * IMPORTANT: This is a destructive operation. Once executed, patient data
 * cannot be recovered. Ensure backups are in place before running.
 *
 * Requires: CRON_SECRET environment variable for authentication
 */

import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import { apiError, apiSuccess, apiUnauthorized } from "@/lib/api-response";
import { deleteFromR2 } from "@/lib/r2";

const RETENTION_DAYS = 30;

interface PurgeResult {
  purgedUsers: number;
  purgedAppointments: number;
  purgedFiles: number;
  errors: number;
}

/**
 * Permanently delete a patient's PHI from the database and R2 storage.
 * This is the final step after the 30-day soft-delete retention period.
 */
async function purgePatientData(
  userId: string,
  clinicId: string,
): Promise<{ success: boolean; filesDeleted: number }> {
  const supabase = createAdminClient();
  let filesDeleted = 0;

  try {
    // 1. Delete encrypted patient files from R2 (medical records, lab results, etc.)
    const { data: files } = await supabase
      .from("patient_files")
      .select("file_key")
      .eq("patient_id", userId)
      .eq("clinic_id", clinicId);

    if (files && files.length > 0) {
      for (const file of files) {
        if (file.file_key) {
          const deleted = await deleteFromR2(file.file_key);
          if (deleted) filesDeleted++;
        }
      }
    }

    // 2. Delete patient file records from database
    await supabase
      .from("patient_files")
      .delete()
      .eq("patient_id", userId)
      .eq("clinic_id", clinicId);

    // 3. Delete appointment history (cascade will handle related records)
    await supabase
      .from("appointments")
      .delete()
      .eq("patient_id", userId)
      .eq("clinic_id", clinicId);

    // 4. Delete payment records
    await supabase
      .from("payments")
      .delete()
      .eq("patient_id", userId)
      .eq("clinic_id", clinicId);

    // 5. Delete notification logs
    await supabase
      .from("notification_log")
      .delete()
      .eq("recipient_id", userId)
      .eq("clinic_id", clinicId);

    // 6. Delete audit log entries (keep only the final deletion event)
    await supabase
      .from("audit_log")
      .delete()
      .eq("actor", userId)
      .eq("clinic_id", clinicId);

    // 7. Finally, delete the user record itself
    await supabase
      .from("users")
      .delete()
      .eq("id", userId)
      .eq("clinic_id", clinicId);

    // 8. Log the permanent deletion for compliance audit trail
    await supabase.from("audit_log").insert({
      clinic_id: clinicId,
      action: "patient.gdpr_purged",
      type: "gdpr",
      actor: "system",
      description: `Patient ${userId} permanently deleted after ${RETENTION_DAYS}-day retention period`,
      metadata: { user_id: userId, files_deleted: filesDeleted },
    });

    return { success: true, filesDeleted };
  } catch (err) {
    logger.error("Failed to purge patient data", {
      context: "cron/gdpr-purge",
      userId,
      clinicId,
      error: err,
    });
    return { success: false, filesDeleted };
  }
}

/**
 * GET /api/cron/gdpr-purge
 *
 * Cron handler for permanent deletion of soft-deleted patient accounts.
 * Runs daily at 02:00 UTC (configured in vercel.json or cron service).
 */
export async function GET(request: NextRequest) {
  // Authenticate cron request using CRON_SECRET
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    logger.error("CRON_SECRET not configured — GDPR purge disabled", {
      context: "cron/gdpr-purge",
    });
    return apiError("GDPR purge not configured", 503);
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    logger.warn("Unauthorized GDPR purge attempt", {
      context: "cron/gdpr-purge",
      ip: request.headers.get("x-forwarded-for") ?? "unknown",
    });
    return apiUnauthorized("Invalid cron secret");
  }

  const result: PurgeResult = {
    purgedUsers: 0,
    purgedAppointments: 0,
    purgedFiles: 0,
    errors: 0,
  };

  try {
    const supabase = createAdminClient();

    // Find all soft-deleted users past the retention period
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
    const cutoffIso = cutoffDate.toISOString();

    const { data: deletedUsers, error: fetchError } = await supabase
      .from("users")
      .select("id, clinic_id, name, email, phone")
      .eq("role", "patient")
      .not("deleted_at", "is", null)
      .lt("deleted_at", cutoffIso);

    if (fetchError) {
      logger.error("Failed to fetch deleted users for GDPR purge", {
        context: "cron/gdpr-purge",
        error: fetchError,
      });
      return apiError("Failed to fetch deleted users");
    }

    if (!deletedUsers || deletedUsers.length === 0) {
      logger.info("No users to purge", { context: "cron/gdpr-purge" });
      return apiSuccess({
        message: "No users to purge",
        ...result,
      });
    }

    logger.info(`Starting GDPR purge for ${deletedUsers.length} users`, {
      context: "cron/gdpr-purge",
      count: deletedUsers.length,
    });

    // Purge each user's data
    for (const user of deletedUsers) {
      const purgeResult = await purgePatientData(user.id, user.clinic_id);

      if (purgeResult.success) {
        result.purgedUsers++;
        result.purgedFiles += purgeResult.filesDeleted;
      } else {
        result.errors++;
      }
    }

    logger.info("GDPR purge complete", {
      context: "cron/gdpr-purge",
      ...result,
    });

    return apiSuccess({
      message: `GDPR purge complete: ${result.purgedUsers} users, ${result.purgedFiles} files`,
      ...result,
    });
  } catch (err) {
    logger.error("GDPR purge failed", {
      context: "cron/gdpr-purge",
      error: err,
    });
    return apiError("GDPR purge failed");
  }
}
