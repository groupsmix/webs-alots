import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { apiSuccess, apiInternalError } from "@/lib/api-response";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { deleteFromR2, isR2Configured } from "@/lib/r2";
import { withSentryCron } from "@/lib/sentry-cron";
import { createAdminClient } from "@/lib/supabase-server";

// consent_logs and some dependent tables are not in the generated Supabase
// types yet. Use an untyped client handle for purge operations.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedClient = SupabaseClient<any, any, any>;

/**
 * GET /api/cron/gdpr-purge
 *
 * GDPR-01 (CRITICAL): Automated GDPR right-to-erasure purge.
 *
 * Runs daily. Finds users whose `deletion_requested_at` is older
 * than 30 days and permanently deletes their data while preserving
 * anonymized consent log records (GDPR-02).
 *
 * Deletion order respects foreign-key constraints:
 * 1. Delete dependent records (appointments, prescriptions, etc.)
 * 2. Anonymize consent_logs (set user_id = NULL, keep anonymized_user_id)
 * 3. Delete the user row itself
 */
async function handler(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  try {
    const supabase = createAdminClient() as UntypedClient;
    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000,
    ).toISOString();

    // Find users whose deletion grace period has expired
    const { data: usersToDelete, error: queryError } = await supabase
      .from("users")
      .select("id, name, clinic_id")
      .not("deletion_requested_at", "is", null)
      .lte("deletion_requested_at", thirtyDaysAgo)
      .limit(50); // Process in batches to avoid timeouts

    if (queryError) {
      logger.error("Failed to query users for GDPR purge", {
        context: "cron/gdpr-purge",
        error: queryError,
      });
      return apiInternalError("Failed to query users for purge");
    }

    if (!usersToDelete || usersToDelete.length === 0) {
      return apiSuccess({
        message: "No users pending deletion",
        purged: 0,
      });
    }

    const results: Array<{
      userId: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const user of usersToDelete) {
      try {
        // 1. Delete dependent records in order (FK-safe)
        // These tables reference users.id as patient_id or user_id
        const dependentTables = [
          { table: "appointments", column: "patient_id" },
          { table: "prescriptions", column: "patient_id" },
          { table: "consultation_notes", column: "patient_id" },
          { table: "medical_records", column: "patient_id" },
          { table: "documents", column: "patient_id" },
          { table: "payments", column: "patient_id" },
          { table: "invoices", column: "patient_id" },
          { table: "notifications", column: "user_id" },
          { table: "notification_log", column: "recipient_id" },
          { table: "activity_logs", column: "user_id" },
          { table: "waiting_list", column: "patient_id" },
          { table: "family_members", column: "patient_id" },
        ];

        for (const { table, column } of dependentTables) {
          const { error: delError } = await supabase
            .from(table)
            .delete()
            .eq(column, user.id);

          if (delError) {
            // Log but continue — some tables may not exist
            // or may have already been cleaned up
            logger.warn(`Failed to delete from ${table}`, {
              context: "cron/gdpr-purge",
              userId: user.id,
              error: delError,
            });
          }
        }

        // 2. Anonymize consent_logs (GDPR-02): keep the record
        // but remove the link to the user. The anonymized_user_id
        // column (added in migration 00057) preserves the association
        // as a one-way hash for audit purposes.
        const { error: consentError } = await supabase
          .from("consent_logs")
          .update({ user_id: null })
          .eq("user_id", user.id);

        if (consentError) {
          logger.warn("Failed to anonymize consent_logs", {
            context: "cron/gdpr-purge",
            userId: user.id,
            error: consentError,
          });
        }

        // 2b. GDPR-PHI: Delete encrypted patient files from R2 storage.
        // Files are keyed as `clinics/{clinic_id}/{category}/{filename}.enc`.
        // Without this step, PHI would persist on R2 indefinitely after the
        // DB records are removed, violating Moroccan Law 09-08 and GDPR
        // right-to-erasure obligations.
        if (user.clinic_id && isR2Configured()) {
          try {
            const { data: docs } = await supabase
              .from("documents")
              .select("storage_key")
              .eq("patient_id", user.id);

            if (docs && docs.length > 0) {
              for (const doc of docs) {
                if (doc.storage_key) {
                  try {
                    // Delete both the encrypted (.enc) and any plaintext version
                    await deleteFromR2(doc.storage_key);
                    await deleteFromR2(`${doc.storage_key}.enc`);
                  } catch (r2Err) {
                    logger.warn("Failed to delete R2 object during GDPR purge", {
                      context: "cron/gdpr-purge",
                      userId: user.id,
                      key: doc.storage_key,
                      error: r2Err,
                    });
                  }
                }
              }
            }
          } catch (r2QueryErr) {
            logger.warn("Failed to query documents for R2 cleanup", {
              context: "cron/gdpr-purge",
              userId: user.id,
              error: r2QueryErr,
            });
          }
        }

        // 3. Delete the user record itself
        const { error: userDelError } = await supabase
          .from("users")
          .delete()
          .eq("id", user.id);

        if (userDelError) {
          logger.error("Failed to delete user", {
            context: "cron/gdpr-purge",
            userId: user.id,
            error: userDelError,
          });
          results.push({
            userId: user.id,
            success: false,
            error: "Failed to delete user record",
          });
          continue;
        }

        logger.info("GDPR purge completed for user", {
          context: "cron/gdpr-purge",
          userId: user.id,
          clinicId: user.clinic_id,
        });

        results.push({ userId: user.id, success: true });
      } catch (err) {
        logger.error("GDPR purge failed for user", {
          context: "cron/gdpr-purge",
          userId: user.id,
          error: err,
        });
        results.push({
          userId: user.id,
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    const purged = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return apiSuccess({
      message: `GDPR purge complete: ${purged} purged, ${failed} failed`,
      purged,
      failed,
      results,
    });
  } catch (err) {
    logger.error("GDPR purge cron failed", {
      context: "cron/gdpr-purge",
      error: err,
    });
    return apiInternalError("Failed to process GDPR purge");
  }
}

export const GET = withSentryCron("gdpr-purge-daily", "0 3 * * *", handler);
