/**
 * GET /api/super-admin/compliance-snapshot
 *
 * Returns a compact compliance summary for the dashboard widget.
 * Queries CNDP status, open/overdue DSARs, and active breach count.
 * Requires super_admin role.
 */

import { apiSuccess } from "@/lib/api-response";
import { createUntypedAdminClient } from "@/lib/supabase-server";
import { withAuth } from "@/lib/with-auth";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (_request, auth) => {
  if (auth.profile.role !== "super_admin") {
    return apiSuccess({ cndpStatus: null, openDsars: 0, overdueDsars: 0, activeBreaches: 0 });
  }

  const supabase = createUntypedAdminClient("super_admin");
  const now = new Date().toISOString();

  const [cndpRes, openDsarsRes, overdueDsarsRes, breachesRes] = await Promise.allSettled([
    supabase
      .from("compliance_cndp")
      .select("status")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("dsar_requests")
      .select("id", { count: "exact", head: true })
      .in("status", ["received", "in_progress", "extended"]),
    supabase
      .from("dsar_requests")
      .select("id", { count: "exact", head: true })
      .in("status", ["received", "in_progress", "extended"])
      .lt("response_due_at", now),
    supabase
      .from("data_breach_incidents")
      .select("id", { count: "exact", head: true })
      .neq("status", "resolved"),
  ]);

  const cndpData =
    cndpRes.status === "fulfilled"
      ? (cndpRes.value.data as { status: string } | null)
      : null;

  return apiSuccess({
    cndpStatus: cndpData?.status ?? null,
    openDsars:
      openDsarsRes.status === "fulfilled" ? (openDsarsRes.value.count ?? 0) : 0,
    overdueDsars:
      overdueDsarsRes.status === "fulfilled" ? (overdueDsarsRes.value.count ?? 0) : 0,
    activeBreaches:
      breachesRes.status === "fulfilled" ? (breachesRes.value.count ?? 0) : 0,
  });
}, ["super_admin"]);
