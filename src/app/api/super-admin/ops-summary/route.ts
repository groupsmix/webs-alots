import { apiError, apiSuccess } from "@/lib/api-response";
import { createUntypedAdminClient } from "@/lib/supabase-server";
import { withAuth } from "@/lib/with-auth";

export const dynamic = "force-dynamic";

// compliance_cndp, dsar_requests, data_breach_incidents, and uptime_events
// are all introduced by migration 00160 and not yet in the generated
// Supabase types — use the untyped admin client (same pattern as the
// sibling /super-admin/compliance page and /api/super-admin/compliance-snapshot).

export const GET = withAuth(
  async (_request, auth) => {
    if (auth.profile.role !== "super_admin") {
      return apiError("Forbidden", 403, "FORBIDDEN");
    }

    const supabase = createUntypedAdminClient("super_admin");
    const nowIso = new Date().toISOString();
    const tenMinutesAgo = new Date(Date.now() - 10 * 60_000).toISOString();

    const [cndp, overdueDsar, activeBreach, uptimeEvents] = await Promise.all([
      supabase.from("compliance_cndp").select("status").limit(1).maybeSingle(),
      supabase
        .from("dsar_requests")
        .select("id", { count: "exact", head: true })
        .in("status", ["received", "in_progress"])
        .lt("response_due_at", nowIso),
      supabase
        .from("data_breach_incidents")
        .select("id", { count: "exact", head: true })
        .in("status", ["investigating", "contained", "notifying_cndp"]),
      supabase
        .from("uptime_events")
        .select("monitor_name, event_type, occurred_at")
        .gte("occurred_at", tenMinutesAgo)
        .order("occurred_at", { ascending: false }),
    ]);

    const cndpRow = (cndp.data ?? null) as { status: string } | null;
    const uptimeRows = (uptimeEvents.data ?? []) as Array<{
      monitor_name: string;
      event_type: string;
      occurred_at: string;
    }>;

    const latestByMonitor = new Map<string, string>();
    for (const row of uptimeRows) {
      if (!latestByMonitor.has(row.monitor_name)) {
        latestByMonitor.set(row.monitor_name, row.event_type);
      }
    }

    const downServices = [...latestByMonitor.entries()]
      .filter(([, eventType]) => eventType === "down")
      .map(([monitorName]) => monitorName);

    return apiSuccess({
      compliance: {
        cndpApproved: cndpRow?.status === "approved",
        overdueDsarCount: overdueDsar.count ?? 0,
        activeBreachCount: activeBreach.count ?? 0,
      },
      uptime: {
        downServices,
        monitorCount: latestByMonitor.size,
      },
      fetchedAt: nowIso,
    });
  },
  ["super_admin"],
);
