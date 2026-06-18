/* eslint-disable i18next/no-literal-string -- Internal/super-admin-only surface or English-first form. The FR/AR translation backlog will catch up; do not add these strings to the i18n keyset now. */
import { AlertTriangle, Database, ShieldAlert } from "lucide-react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MONITORED_SERVICES } from "@/lib/monitoring/services";
import { createUntypedAdminClient } from "@/lib/supabase-server";

// uptime_sla_monthly (view) and uptime_events are introduced by migration
// 00160 and are not yet in the generated Supabase types. Use the untyped
// admin client and declare row shapes locally — same pattern as the
// sibling /super-admin/compliance page and /api/super-admin/compliance-snapshot.
type UptimeSlaMonthlyRow = {
  month: string;
  monitor_name: string;
  uptime_pct: number | null;
  downtime_events: number | null;
};

type UptimeEventRow = {
  id: string;
  monitor_name: string;
  occurred_at: string;
  event_type: string;
  message: string | null;
};

async function getMetrics(): Promise<{
  uptime: UptimeSlaMonthlyRow[];
  events: UptimeEventRow[];
}> {
  const supabase = createUntypedAdminClient("super_admin");

  const [uptime, events] = await Promise.all([
    supabase.from("uptime_sla_monthly").select("*").order("month", { ascending: false }).limit(12),
    supabase.from("uptime_events").select("*").order("occurred_at", { ascending: false }).limit(20),
  ]);

  return {
    uptime: (uptime.data ?? []) as UptimeSlaMonthlyRow[],
    events: (events.data ?? []) as UptimeEventRow[],
  };
}

export default async function SystemHealthPage() {
  const metrics = await getMetrics();
  const latestMonth = metrics.uptime[0]?.month;
  const latestMonthRows = metrics.uptime.filter((row) => row.month === latestMonth);
  const distinctMonitors = new Set(metrics.uptime.map((row) => row.monitor_name)).size;
  // Fall back to the canonical monitored-services count so "Services suivis"
  // never reads a misleading 0 before the historical uptime_sla_monthly table
  // has been populated by the monitoring pipeline.
  const servicesTracked = distinctMonitors > 0 ? distinctMonitors : MONITORED_SERVICES.length;

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Super Admin", href: "/super-admin/dashboard" },
          { label: "System", href: "/super-admin/system" },
          { label: "Health" },
        ]}
      />

      <div>
        <h1 className="text-2xl font-bold">System Health</h1>
        <p className="text-sm text-muted-foreground">
          Vue consolidée des incidents, de la disponibilité et des signaux opérationnels.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Database className="h-4 w-4" />
              Services suivis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{servicesTracked}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldAlert className="h-4 w-4" />
              Incidents récents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.events.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4" />
              Downtime (mois)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {latestMonthRows.reduce((sum, row) => sum + (row.downtime_events ?? 0), 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Disponibilité mensuelle</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-3">Service</th>
                  <th className="p-3">Mois</th>
                  <th className="p-3">Uptime</th>
                  <th className="p-3">Incidents</th>
                </tr>
              </thead>
              <tbody>
                {metrics.uptime.length === 0 ? (
                  <tr>
                    <td className="p-3 text-muted-foreground" colSpan={4}>
                      Aucune donnée de disponibilité enregistrée pour le moment.
                    </td>
                  </tr>
                ) : (
                  metrics.uptime.map((row) => (
                    <tr key={`${row.monitor_name}-${row.month}`} className="border-b">
                      <td className="p-3">{row.monitor_name}</td>
                      <td className="p-3">
                        {new Date(row.month).toLocaleDateString("fr-MA", {
                          year: "numeric",
                          month: "long",
                        })}
                      </td>
                      <td className="p-3">{row.uptime_pct}%</td>
                      <td className="p-3">{row.downtime_events}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Événements récents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {metrics.events.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun événement récent enregistré.</p>
            ) : (
              metrics.events.map((event) => (
                <div key={event.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{event.monitor_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(event.occurred_at).toLocaleString("fr-MA")}
                      </div>
                    </div>
                    <div className="text-sm capitalize">{event.event_type}</div>
                  </div>
                  {event.message ? (
                    <p className="mt-2 text-sm text-muted-foreground">{event.message}</p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
