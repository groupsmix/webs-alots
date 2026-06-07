/**
 * GET /api/super-admin/clinic-usage-detail?clinicId=UUID
 *
 * Returns 30-day usage snapshots + clinic info for the super admin drill-down page.
 *
 * OWASP A01: super_admin only.
 * OWASP A03: clinicId validated as UUID before use.
 */

import { z } from "zod";
import { type NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const querySchema = z.object({
  clinicId: z.string().uuid("Invalid clinic ID"),
});

export const GET = withAuth(
  async (request: NextRequest, auth: AuthContext) => {
    const { supabase } = auth;
    const { searchParams } = new URL(request.url);

    const parsed = querySchema.safeParse({ clinicId: searchParams.get("clinicId") });
    if (!parsed.success) {
      return apiError("Invalid clinicId parameter", 400, "INVALID_PARAMS");
    }
    const { clinicId } = parsed.data;

    try {
      // Get clinic info — super_admin can read any clinic
      // nosemgrep: semgrep.tenant-scoping — super_admin cross-tenant read
      const { data: clinic, error: clinicError } = await supabase
        .from("clinics")
        .select("id, name, tier, trial_started_at, trial_ends_at")
        .eq("id", clinicId)
        .single();

      if (clinicError || !clinic) {
        return apiError("Clinic not found", 404, "NOT_FOUND");
      }

      // Get 30-day usage snapshots
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);

      // nosemgrep: semgrep.tenant-scoping — super_admin intentional cross-tenant read
      const { data: snapshots, error: snapshotsError } = await supabase
        .from("usage_snapshots")
        .select(
          "snapshot_date, appointments_count, whatsapp_sent, ai_calls, storage_bytes, active_doctors",
        )
        .eq("clinic_id", clinicId)
        .gte("snapshot_date", thirtyDaysAgo)
        .order("snapshot_date", { ascending: false })
        .limit(30);

      if (snapshotsError) {
        logger.warn("Failed to fetch usage snapshots", {
          context: "api/super-admin/clinic-usage-detail",
          clinicId,
          error: snapshotsError,
        });
      }

      return apiSuccess({
        clinic,
        snapshots: snapshots ?? [],
      });
    } catch (err) {
      logger.error("clinic-usage-detail fetch failed", {
        context: "api/super-admin/clinic-usage-detail",
        clinicId,
        error: err instanceof Error ? err.message : String(err),
      });
      return apiError("Internal error", 500, "INTERNAL_ERROR");
    }
  },
  ["super_admin"],
);
