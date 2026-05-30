/**
 * GET /api/cron/data-retention
 *
 * Automated data retention policy enforcement for Moroccan Law 09-08.
 *
 * Runs daily. For each clinic:
 * 1. Identifies records older than the legal retention period (default: 5 years).
 * 2. Archives eligible records into the `archived_records` ledger.
 * 3. Flags records approaching expiry (within the notify_before_days window).
 *
 * Protected by CRON_SECRET via Authorization: Bearer header.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { withSentryCron } from "@/lib/sentry-cron";
import { createAdminClient } from "@/lib/supabase-server";

const DEFAULT_RETENTION_DAYS = 1826; // 5 years
const DEFAULT_NOTIFY_BEFORE_DAYS = 90;
const BATCH_SIZE = 100;

const RETAINABLE_TABLES = [
  { table: "appointments", dateColumn: "slot_start", patientColumn: "patient_id" },
  { table: "consultation_notes", dateColumn: "created_at", patientColumn: "patient_id" },
  { table: "medical_records", dateColumn: "created_at", patientColumn: "patient_id" },
  { table: "prescriptions", dateColumn: "created_at", patientColumn: "patient_id" },
  { table: "payments", dateColumn: "created_at", patientColumn: "patient_id" },
  { table: "invoices", dateColumn: "created_at", patientColumn: "patient_id" },
] as const;

// Use untyped client for tables not yet in generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedClient = SupabaseClient<any, any, any>;

interface ClinicRow {
  id: string;
  name: string;
}

interface RetentionPolicyRow {
  table_name: string;
  retention_days: number;
  auto_archive: boolean;
  notify_before_days: number;
}

async function handler(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  const supabase = createAdminClient("cron") as UntypedClient;
  let totalArchived = 0;
  let totalFlagged = 0;
  const errors: string[] = [];

  // Iterate per clinic (AGENTS.md rule #6)
  // MA-04: filter soft-deleted clinics
  const { data: clinics, error: clinicsError } = await supabase
    .from("clinics")
    .select("id, name")
    .is("deleted_at", null)
    .limit(1000);

  if (clinicsError || !clinics) {
    logger.error("Failed to fetch clinics for data retention", {
      context: "cron/data-retention",
      error: clinicsError,
    });
    return apiSuccess({ totalArchived: 0, totalFlagged: 0, errors: ["Failed to fetch clinics"] });
  }

  for (const clinic of clinics as ClinicRow[]) {
    // Fetch clinic-specific retention policies, fall back to defaults
    const { data: policies } = await supabase
      .from("retention_policies")
      .select("table_name, retention_days, auto_archive, notify_before_days")
      .eq("clinic_id", clinic.id);

    const policyMap = new Map<string, RetentionPolicyRow>();
    if (policies) {
      for (const p of policies as RetentionPolicyRow[]) {
        policyMap.set(p.table_name, p);
      }
    }

    for (const { table, dateColumn, patientColumn } of RETAINABLE_TABLES) {
      const policy = policyMap.get(table);
      const retentionDays = policy?.retention_days ?? DEFAULT_RETENTION_DAYS;
      const autoArchive = policy?.auto_archive ?? true;
      const notifyBeforeDays = policy?.notify_before_days ?? DEFAULT_NOTIFY_BEFORE_DAYS;

      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

      const warningDate = new Date(
        Date.now() - (retentionDays - notifyBeforeDays) * 24 * 60 * 60 * 1000,
      ).toISOString();

      try {
        // 1. Flag records approaching expiry (within the warning window but not yet expired)
        const { data: approachingExpiry, error: warnError } = await supabase
          .from(table)
          .select(`id, ${patientColumn}`)
          .eq("clinic_id", clinic.id)
          .lte(dateColumn, warningDate)
          .gt(dateColumn, cutoffDate)
          .limit(BATCH_SIZE);

        if (warnError) {
          logger.warn("Failed to query approaching-expiry records", {
            context: "cron/data-retention",
            clinicId: clinic.id,
            table,
            error: warnError,
          });
        } else if (approachingExpiry && approachingExpiry.length > 0) {
          // Check which ones are already flagged to avoid duplicates
          const sourceIds = approachingExpiry.map((r: Record<string, string>) => r.id as string);
          const { data: existingArchived } = await supabase
            .from("archived_records")
            .select("source_id")
            .eq("clinic_id", clinic.id)
            .eq("source_table", table)
            .in("source_id", sourceIds);

          const existingIds = new Set(
            (existingArchived ?? []).map((r: Record<string, string>) => r.source_id),
          );

          const newFlags = approachingExpiry.filter(
            (r: Record<string, string>) => !existingIds.has(r.id),
          );

          if (newFlags.length > 0) {
            const retentionExpiresAt = new Date(
              Date.now() + notifyBeforeDays * 24 * 60 * 60 * 1000,
            ).toISOString();

            const flagRows = newFlags.map((r: Record<string, string>) => ({
              clinic_id: clinic.id,
              source_table: table,
              source_id: r.id,
              patient_id: r[patientColumn] ?? null,
              status: "archived",
              retention_expires_at: retentionExpiresAt,
              metadata: { flagged_reason: "approaching_retention_expiry" },
            }));

            const { error: flagError } = await supabase.from("archived_records").insert(flagRows);

            if (flagError) {
              errors.push(`Flag ${table} for ${clinic.id}: ${flagError.message}`);
            } else {
              totalFlagged += newFlags.length;
            }
          }
        }

        // 2. Auto-archive records past retention period
        if (autoArchive) {
          const { data: expiredRecords, error: expError } = await supabase
            .from(table)
            .select(`id, ${patientColumn}`)
            .eq("clinic_id", clinic.id)
            .lte(dateColumn, cutoffDate)
            .limit(BATCH_SIZE);

          if (expError) {
            logger.warn("Failed to query expired records", {
              context: "cron/data-retention",
              clinicId: clinic.id,
              table,
              error: expError,
            });
            continue;
          }

          if (expiredRecords && expiredRecords.length > 0) {
            // Check which are already archived
            const expiredIds = expiredRecords.map((r: Record<string, string>) => r.id as string);
            const { data: alreadyArchived } = await supabase
              .from("archived_records")
              .select("source_id")
              .eq("clinic_id", clinic.id)
              .eq("source_table", table)
              .in("source_id", expiredIds);

            const alreadyArchivedIds = new Set(
              (alreadyArchived ?? []).map((r: Record<string, string>) => r.source_id),
            );

            const toArchive = expiredRecords.filter(
              (r: Record<string, string>) => !alreadyArchivedIds.has(r.id),
            );

            if (toArchive.length > 0) {
              const archiveRows = toArchive.map((r: Record<string, string>) => ({
                clinic_id: clinic.id,
                source_table: table,
                source_id: r.id,
                patient_id: r[patientColumn] ?? null,
                status: "pending_deletion",
                retention_expires_at: new Date().toISOString(),
                metadata: { auto_archived: true, reason: "retention_period_exceeded" },
              }));

              const { error: archiveError } = await supabase
                .from("archived_records")
                .insert(archiveRows);

              if (archiveError) {
                errors.push(`Archive ${table} for ${clinic.id}: ${archiveError.message}`);
              } else {
                totalArchived += toArchive.length;
              }
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${table} for ${clinic.id}: ${msg}`);
        logger.error("Data retention processing error", {
          context: "cron/data-retention",
          clinicId: clinic.id,
          table,
          error: err,
        });
      }
    }

    // Log audit event per clinic for compliance
    if (totalArchived > 0 || totalFlagged > 0) {
      try {
        await logAuditEvent({
          supabase,
          action: "data_retention_sweep",
          type: "admin",
          clinicId: clinic.id,
          clinicName: clinic.name,
          description: `Archived ${totalArchived} records, flagged ${totalFlagged} approaching expiry`,
          metadata: { totalArchived, totalFlagged },
        });
      } catch {
        // Audit log failure handled internally by logAuditEvent
      }
    }
  }

  logger.info("Data retention sweep complete", {
    context: "cron/data-retention",
    totalArchived,
    totalFlagged,
    errors: errors.length,
  });

  return apiSuccess({
    totalArchived,
    totalFlagged,
    clinicsProcessed: (clinics as ClinicRow[]).length,
    errors: errors.length > 0 ? errors : undefined,
  });
}

export const GET = withSentryCron("data-retention", "0 3 * * *", handler);
