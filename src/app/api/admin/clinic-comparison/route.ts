/**
 * GET /api/admin/clinic-comparison — Real per-clinic metrics for the
 * super-admin clinic comparison dashboard (O6).
 *
 * Replaces the previous fabricated `CLINIC_POOL` (12 seeded-random mock
 * clinics) with live, tenant-aggregated data pulled from the real tables:
 *   - appointments  → monthly volume + no-show rate
 *   - payments      → monthly revenue (completed only)
 *   - reviews       → satisfaction (avg stars)
 *   - users         → active patients + staff headcount
 *
 * Aggregation is done in-process by clinic_id (mirrors the churn-prediction
 * route's pattern) so there is no GROUP BY / RPC to maintain. This is a
 * cross-tenant super-admin read: it intentionally uses the service-role
 * admin client and is gated to super_admin only.
 *
 * Requires super_admin role.
 */

import { type NextRequest } from "next/server";
import { apiInternalError, apiSuccess } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase-server";
import type { UserRole } from "@/lib/types/database";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const ALLOWED_ROLES: UserRole[] = ["super_admin"];

export interface ClinicComparisonRow {
  id: string;
  name: string;
  type: string;
  tier: string;
  status: string;
  monthlyAppointments: number;
  monthlyRevenue: number;
  activePatients: number;
  noShowRate: number;
  satisfaction: number;
  staffCount: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

async function handleGet(_request: NextRequest, _auth: AuthContext) {
  try {
    // Deliberate cross-tenant super_admin read: this route is gated to
    // super_admin (ALLOWED_ROLES) and aggregates metrics across all clinics.
    // The per-table reads below are annotated for the same reason.
    // nosemgrep: admin-client-guard
    const admin = createAdminClient("super_admin");

    const now = Date.now();
    const thirtyCut = now - 30 * DAY_MS;
    const thirtyDaysAgoIso = new Date(thirtyCut).toISOString();
    const ninetyDaysAgoIso = new Date(now - 90 * DAY_MS).toISOString();

    // Cross-tenant super-admin aggregation: each read is intentionally
    // unscoped and gated to super_admin above.
    const [clinicsRes, apptRes, payRes, reviewRes, userRes] = await Promise.all([
      // nosemgrep: semgrep.tenant-scoping
      admin.from("clinics").select("id, name, type, tier, status").is("deleted_at", null), // nosemgrep: semgrep.tenant-scoping
      // nosemgrep: semgrep.tenant-scoping
      admin
        .from("appointments") // nosemgrep: semgrep.tenant-scoping
        .select("clinic_id, status, created_at")
        .gte("created_at", ninetyDaysAgoIso),
      // nosemgrep: semgrep.tenant-scoping
      admin
        .from("payments") // nosemgrep: semgrep.tenant-scoping
        .select("clinic_id, amount, created_at")
        .eq("status", "completed")
        .gte("created_at", thirtyDaysAgoIso),
      // nosemgrep: semgrep.tenant-scoping
      admin.from("reviews").select("clinic_id, stars"), // nosemgrep: semgrep.tenant-scoping
      // nosemgrep: semgrep.tenant-scoping
      admin.from("users").select("clinic_id, role"), // nosemgrep: semgrep.tenant-scoping
    ]);

    if (clinicsRes.error) {
      logger.error("clinic-comparison: clinics query failed", {
        context: "clinic-comparison",
        error: clinicsRes.error,
      });
      return apiInternalError();
    }

    const clinics = clinicsRes.data ?? [];
    const appts = (apptRes.data ?? []) as {
      clinic_id: string | null;
      status: string | null;
      created_at: string | null;
    }[];
    const pays = (payRes.data ?? []) as {
      clinic_id: string | null;
      amount: number | null;
      created_at: string | null;
    }[];
    const reviews = (reviewRes.data ?? []) as { clinic_id: string | null; stars: number | null }[];
    const users = (userRes.data ?? []) as { clinic_id: string | null; role: string | null }[];

    const rows: ClinicComparisonRow[] = clinics.map((c) => {
      const cAppts = appts.filter((a) => a.clinic_id === c.id);
      const monthlyAppointments = cAppts.filter(
        (a) => a.created_at != null && new Date(a.created_at).getTime() >= thirtyCut,
      ).length;
      const totalAppts = cAppts.length;
      const noShows = cAppts.filter((a) => a.status === "no_show").length;
      const noShowRate = totalAppts > 0 ? Number(((noShows / totalAppts) * 100).toFixed(1)) : 0;

      const monthlyRevenue = pays
        .filter((p) => p.clinic_id === c.id)
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      const cReviews = reviews.filter((r) => r.clinic_id === c.id);
      const satisfaction =
        cReviews.length > 0
          ? Number(
              (
                cReviews.reduce((sum, r) => sum + (Number(r.stars) || 0), 0) / cReviews.length
              ).toFixed(1),
            )
          : 0;

      const cUsers = users.filter((u) => u.clinic_id === c.id);
      const activePatients = cUsers.filter((u) => u.role === "patient").length;
      const staffCount = cUsers.filter((u) => u.role != null && u.role !== "patient").length;

      return {
        id: c.id,
        name: c.name,
        type: c.type,
        tier: c.tier,
        status: c.status,
        monthlyAppointments,
        monthlyRevenue,
        activePatients,
        noShowRate,
        satisfaction,
        staffCount,
      };
    });

    rows.sort((a, b) => a.name.localeCompare(b.name));

    return apiSuccess({ clinics: rows });
  } catch (error) {
    logger.error("clinic-comparison fetch failed", { context: "clinic-comparison", error });
    return apiInternalError();
  }
}

export const GET = withAuth(handleGet, ALLOWED_ROLES);
