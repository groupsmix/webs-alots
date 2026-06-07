import { apiError, apiSuccess } from "@/lib/api-response";
import { createUntypedAdminClient } from "@/lib/supabase-server";
import { withAuth } from "@/lib/with-auth";

export const dynamic = "force-dynamic";

async function fetchSentryMetrics() {
  if (!process.env.SENTRY_AUTH_TOKEN || !process.env.SENTRY_ORG || !process.env.SENTRY_PROJECT) {
    return { available: false };
  }

  const since = new Date(Date.now() - 86_400_000).toISOString();
  const response = await fetch(
    `https://sentry.io/api/0/projects/${process.env.SENTRY_ORG}/${process.env.SENTRY_PROJECT}/events/?query=is:unresolved&start=${since}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.SENTRY_AUTH_TOKEN}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return { available: false };
  }

  const data = (await response.json()) as unknown[];
  return { available: true, errorCount24h: data.length };
}

export const GET = withAuth(
  async (_request, auth) => {
    if (auth.profile.role !== "super_admin") {
      return apiError("Forbidden", 403, "FORBIDDEN");
    }

    // uptime_events is introduced by migration 00160 and not yet in the
    // generated Supabase types — use the untyped admin client.
    const supabase = createUntypedAdminClient("super_admin");
    const [sentry, uptimeEvents, dbProbe] = await Promise.allSettled([
      fetchSentryMetrics(),
      supabase
        .from("uptime_events")
        .select("monitor_name, event_type, occurred_at, response_time_ms")
        .gte("occurred_at", new Date(Date.now() - 86_400_000).toISOString())
        .order("occurred_at", { ascending: false })
        .limit(50),
      auth.supabase.from("users").select("id", { count: "exact", head: true }),
    ]);

    const database =
      dbProbe.status === "fulfilled"
        ? {
            available: !dbProbe.value.error,
            userCount: dbProbe.value.count ?? 0,
          }
        : { available: false };

    return apiSuccess({
      sentry: sentry.status === "fulfilled" ? sentry.value : { available: false },
      database,
      uptime:
        uptimeEvents.status === "fulfilled"
          ? {
              events: uptimeEvents.value.data ?? [],
            }
          : { events: [] },
      fetchedAt: new Date().toISOString(),
    });
  },
  ["super_admin"],
);
