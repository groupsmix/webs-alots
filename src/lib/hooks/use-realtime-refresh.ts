"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/data/client";

export type RealtimeStatus = "connecting" | "live" | "offline";

/**
 * Subscribe to Postgres change events for the given tables (scoped to a
 * clinic) and trigger a server-component refresh when the data changes.
 *
 * Uses `router.refresh()` so the existing server-side data loaders
 * (e.g. `getDashboardStats` / `getDoctorDashboardData`) stay the single
 * source of truth — no duplicated client-side query logic and RLS keeps
 * applying on the server.
 *
 * The tables MUST be members of the `supabase_realtime` publication (see
 * migration `00189_realtime_dashboard_tables.sql`) and must expose a
 * `clinic_id` column for the per-tenant filter. Bursts of changes (e.g. a
 * booking that writes an appointment + a payment in one transaction) are
 * debounced into a single refresh.
 *
 * @param clinicId  Tenant to scope the subscription to. When null/undefined
 *                  (e.g. super-admins with no clinic) the hook is inert.
 * @param tables    Stable list of table names to watch. Pass a module-level
 *                  constant so the effect does not re-subscribe each render.
 */
export function useRealtimeRefresh(
  clinicId: string | null | undefined,
  tables: readonly string[],
): RealtimeStatus {
  const router = useRouter();
  const [status, setStatus] = useState<RealtimeStatus>("connecting");

  // Join to a primitive so the effect's dependency is stable across renders
  // even if the caller passes a fresh array literal.
  const tableKey = tables.join(",");

  useEffect(() => {
    if (!clinicId) return;

    const supabase = createClient();
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => router.refresh(), 500);
    };

    let channel = supabase.channel(`dashboard:${clinicId}`);
    for (const table of tableKey.split(",")) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `clinic_id=eq.${clinicId}` },
        scheduleRefresh,
      );
    }

    channel.subscribe((state) => {
      if (state === "SUBSCRIBED") {
        setStatus("live");
      } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
        setStatus("offline");
      } else {
        setStatus("connecting");
      }
    });

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, [clinicId, tableKey, router]);

  return status;
}
