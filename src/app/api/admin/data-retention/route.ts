/**
 * GET /api/admin/data-retention
 *
 * Returns data retention summary for the current clinic:
 * - Count of archived records by table
 * - Records approaching retention expiry
 * - Current retention policy configuration
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { withAuth, type AuthContext } from "@/lib/with-auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedClient = SupabaseClient<any, any, any>;

async function handler(_request: NextRequest, auth: AuthContext) {
  const clinicId = auth.profile.clinic_id;
  if (!clinicId) {
    return apiError("Clinic context required", 403, "NO_CLINIC");
  }

  try {
    const supabase = auth.supabase as UntypedClient;

    const [archivedRes, policiesRes, approachingRes] = await Promise.all([
      // Count archived records by table
      supabase.from("archived_records").select("source_table, status").eq("clinic_id", clinicId),

      // Get retention policies
      supabase
        .from("retention_policies")
        .select("table_name, retention_days, auto_archive, notify_before_days, updated_at")
        .eq("clinic_id", clinicId),

      // Records approaching expiry (status = 'archived', not yet pending_deletion)
      supabase
        .from("archived_records")
        .select("id, source_table, source_id, patient_id, retention_expires_at, created_at")
        .eq("clinic_id", clinicId)
        .eq("status", "archived")
        .order("retention_expires_at", { ascending: true })
        .limit(100),
    ]);

    // Aggregate archive counts by table and status
    const archiveSummary: Record<
      string,
      { archived: number; pending_deletion: number; deleted: number }
    > = {};
    if (archivedRes.data) {
      for (const row of archivedRes.data) {
        const table = row.source_table as string;
        const status = row.status as string;
        if (!archiveSummary[table]) {
          archiveSummary[table] = { archived: 0, pending_deletion: 0, deleted: 0 };
        }
        if (status === "archived") archiveSummary[table].archived++;
        else if (status === "pending_deletion") archiveSummary[table].pending_deletion++;
        else if (status === "deleted") archiveSummary[table].deleted++;
      }
    }

    return apiSuccess({
      summary: archiveSummary,
      policies: policiesRes.data ?? [],
      approachingExpiry: approachingRes.data ?? [],
      retentionPeriodYears: 5,
      legalBasis: "Moroccan Law 09-08",
    });
  } catch (err) {
    logger.error("Failed to fetch data retention info", {
      context: "api/admin/data-retention",
      error: err,
    });
    return apiError("Internal server error", 500, "INTERNAL_ERROR");
  }
}

export const GET = withAuth(handler, ["clinic_admin", "super_admin"]);
