/**
 * Cron Route — R2 Abandoned-Upload Cleanup (Task 3.3.3).
 *
 * Runs every hour (Cloudflare Cron Trigger `0 * * * *`) to reconcile the
 * R2 bucket against the `pending_uploads` tracking table, deleting:
 *   1. Tracking rows whose `confirmed_at` is still null after the SLA
 *      window (default 24 h) — and the corresponding R2 object.
 *   2. Orphan R2 keys — objects under `clinics/{id}/` that no
 *      `pending_uploads` row references.
 *
 * Tenant isolation (AGENTS.md rule #6): the route iterates active
 * clinics and scopes every R2 list/delete and DB query to the current
 * `clinic_id` via the per-clinic primitives in `@/lib/r2-cleanup`.
 *
 * Protected by CRON_SECRET via `Authorization: Bearer` header.
 */

import { NextRequest } from "next/server";
import { apiInternalError, apiSuccess } from "@/lib/api-response";
import { assertClinicId } from "@/lib/assert-tenant";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import {
  cleanupAbandonedUploads,
  reconcileOrphans,
} from "@/lib/r2-cleanup";
import { withSentryCron } from "@/lib/sentry-cron";
import { createAdminClient } from "@/lib/supabase-server";

interface PerClinicResult {
  clinicId: string;
  scanned: number;
  orphans: number;
  deleted: number;
  errors: number;
  alerted: boolean;
  error?: string;
}

async function handler(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  try {
    // Cron has no tenant subdomain context — use the admin client to
    // enumerate clinics, then re-scope every per-clinic operation via
    // the library primitives that take an explicit `clinicId`.
    const supabase = createAdminClient();

    const { data: clinics, error: clinicsError } = await supabase
      .from("clinics")
      .select("id")
      .eq("status", "active");

    if (clinicsError) {
      logger.error("r2-cleanup: failed to list active clinics", {
        context: "cron/r2-cleanup",
        error: clinicsError,
      });
      return apiInternalError("Failed to list active clinics");
    }

    const perClinic: PerClinicResult[] = [];
    let totalScanned = 0;
    let totalOrphans = 0;
    let totalDeleted = 0;
    let totalErrors = 0;
    let alertEmitted = false;

    for (const clinic of clinics ?? []) {
      // Defense-in-depth — never let a malformed clinic row leak across
      // tenants (per AGENTS.md rule #6). Skip rather than fail the pass.
      if (!clinic.id) {
        logger.warn("r2-cleanup: clinic row missing id — skipping", {
          context: "cron/r2-cleanup",
        });
        continue;
      }
      try {
        assertClinicId(clinic.id, "cron/r2-cleanup:clinic");
      } catch {
        logger.warn("r2-cleanup: invalid clinic_id format — skipping", {
          context: "cron/r2-cleanup",
          clinicId: clinic.id,
        });
        continue;
      }

      const prefix = `clinics/${clinic.id}/`;

      try {
        const abandoned = await cleanupAbandonedUploads(supabase, clinic.id, {
          prefix,
        });
        const orphans = await reconcileOrphans(supabase, clinic.id, {
          prefix,
        });

        const scanned = orphans.scanned;
        const orphanCount = orphans.orphans;
        const deleted = abandoned.deletedFromR2 + orphans.deletedFromR2;
        const errors = abandoned.errors.length + orphans.errors.length;

        totalScanned += scanned;
        totalOrphans += orphanCount;
        totalDeleted += deleted;
        totalErrors += errors;
        alertEmitted = alertEmitted || orphans.alerted;

        perClinic.push({
          clinicId: clinic.id,
          scanned,
          orphans: orphanCount,
          deleted,
          errors,
          alerted: orphans.alerted,
        });
      } catch (err) {
        // A failure for one clinic must not abort the rest of the pass.
        const message = err instanceof Error ? err.message : String(err);
        logger.error("r2-cleanup: per-clinic sweep failed", {
          context: "cron/r2-cleanup",
          clinicId: clinic.id,
          error: message,
        });
        perClinic.push({
          clinicId: clinic.id,
          scanned: 0,
          orphans: 0,
          deleted: 0,
          errors: 1,
          alerted: false,
          error: message,
        });
        totalErrors += 1;
      }
    }

    logger.info("r2-cleanup cron completed", {
      context: "cron/r2-cleanup",
      clinics: perClinic.length,
      scanned: totalScanned,
      orphans: totalOrphans,
      deleted: totalDeleted,
      errors: totalErrors,
      alertEmitted,
    });

    return apiSuccess({
      clinics: perClinic.length,
      scanned: totalScanned,
      orphans: totalOrphans,
      deleted: totalDeleted,
      errors: totalErrors,
      alertEmitted,
      perClinic,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("r2-cleanup cron failed", {
      context: "cron/r2-cleanup",
      error: err instanceof Error ? err.message : String(err),
    });
    return apiInternalError("R2 cleanup failed");
  }
}

export const GET = withSentryCron("r2-cleanup-hourly", "0 * * * *", handler);
