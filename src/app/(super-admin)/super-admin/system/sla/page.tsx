/* eslint-disable i18next/no-literal-string -- Internal/super-admin-only surface or English-first form. The FR/AR translation backlog will catch up; do not add these strings to the i18n keyset now. */
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createUntypedAdminClient } from "@/lib/supabase-server";
import { SlaExportButton } from "./export-button";

export default async function SLAPage() {
  const supabase = createUntypedAdminClient("super_admin");
  const [slaRows, recentEvents] = await Promise.all([
    supabase.from("uptime_sla_monthly").select("*").order("month", { ascending: false }).limit(60),
    supabase
      .from("uptime_events")
      .select("*")
      .eq("event_type", "down")
      .order("occurred_at", { ascending: false })
      .limit(20),
  ]);

  const reportMonth = String(
    (slaRows.data ?? [])[0]?.month ?? new Date().toISOString().slice(0, 7),
  );
  const reportMonthParam = reportMonth.slice(0, 7);

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Super Admin", href: "/super-admin/dashboard" },
          { label: "System", href: "/super-admin/system" },
          { label: "SLA" },
        ]}
      />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Uptime SLA</h1>
          <p className="text-sm text-muted-foreground">
            Suivi mensuel de la disponibilité et des incidents enregistrés.
          </p>
        </div>
        <SlaExportButton reportMonth={reportMonthParam} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Starter target</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">99%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pro target</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">99.9%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Enterprise target</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">99.99%</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historique SLA mensuel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-3">Service</th>
                  <th className="p-3">Mois</th>
                  <th className="p-3">Uptime %</th>
                  <th className="p-3">Downtime</th>
                </tr>
              </thead>
              <tbody>
                {(slaRows.data ?? []).length === 0 ? (
                  <tr>
                    <td className="p-3 text-muted-foreground" colSpan={4}>
                      Aucune donnée SLA enregistrée pour le moment.
                    </td>
                  </tr>
                ) : (
                  (slaRows.data ?? []).map((row: Record<string, unknown>) => (
                    <tr
                      key={`${String(row.monitor_name)}-${String(row.month)}`}
                      className="border-b"
                    >
                      <td className="p-3">{String(row.monitor_name ?? "unknown")}</td>
                      <td className="p-3">
                        {new Date(String(row.month)).toLocaleDateString("fr-MA", {
                          month: "long",
                          year: "numeric",
                        })}
                      </td>
                      <td className="p-3">{String(row.uptime_pct ?? "—")}%</td>
                      <td className="p-3">{String(row.downtime_events ?? 0)}</td>
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
          <CardTitle>Dernières pannes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(recentEvents.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune panne enregistrée.</p>
            ) : (
              (recentEvents.data ?? []).map((event: Record<string, unknown>) => (
                <div key={String(event.id)} className="rounded-lg border p-3">
                  <div className="font-medium">{String(event.monitor_name ?? "unknown")}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(String(event.occurred_at)).toLocaleString("fr-MA")}
                  </div>
                  {typeof event.message === "string" ? (
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
