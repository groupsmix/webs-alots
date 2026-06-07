/* eslint-disable i18next/no-literal-string -- Internal/super-admin-only surface or English-first form. The FR/AR translation backlog will catch up; do not add these strings to the i18n keyset now. */
import { Activity, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPublicStatusSnapshot } from "@/lib/system-status";

const STATUS_STYLES = {
  operational: "text-green-600 bg-green-50 border-green-200",
  degraded: "text-amber-600 bg-amber-50 border-amber-200",
  down: "text-red-600 bg-red-50 border-red-200",
} as const;

export default async function PublicStatusPage() {
  const snapshot = await getPublicStatusSnapshot();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-12">
      <div className="space-y-3">
        <div
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium ${STATUS_STYLES[snapshot.status]}`}
        >
          <Activity className="h-4 w-4" />
          System status: {snapshot.status}
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Oltigo Status</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Public availability summary for core platform services and recent incidents.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Last updated {new Date(snapshot.fetchedAt).toLocaleString("fr-MA")}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {snapshot.services.map((service) => (
          <Card key={service.name}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm font-medium">
                <span>{service.name}</span>
                {service.status === "operational" ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : service.status === "degraded" ? (
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-base font-semibold capitalize">{service.status}</div>
              {service.latencyMs != null ? (
                <p className="text-xs text-muted-foreground">Latency: {service.latencyMs}ms</p>
              ) : null}
              {service.detail ? (
                <p className="text-xs text-muted-foreground">{service.detail}</p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Recent incidents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.incidents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No incidents recorded recently.</p>
            ) : (
              snapshot.incidents.map((incident) => (
                <div key={incident.id} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{incident.monitorName}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(incident.occurredAt).toLocaleString("fr-MA")}
                      </p>
                    </div>
                    <span className="text-xs font-medium uppercase text-muted-foreground">
                      {incident.eventType}
                    </span>
                  </div>
                  {incident.message ? (
                    <p className="mt-2 text-sm text-muted-foreground">{incident.message}</p>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest monthly uptime</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.uptime.slice(0, 6).map((row) => (
              <div key={`${row.monitorName}-${row.month}`} className="rounded-lg border p-4">
                <p className="font-medium">{row.monitorName}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(row.month).toLocaleDateString("fr-MA", {
                    month: "long",
                    year: "numeric",
                  })}
                </p>
                <p className="mt-2 text-sm">
                  Uptime: {row.uptimePct == null ? "—" : `${row.uptimePct}%`}
                </p>
                <p className="text-xs text-muted-foreground">
                  Downtime events: {row.downtimeEvents}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
