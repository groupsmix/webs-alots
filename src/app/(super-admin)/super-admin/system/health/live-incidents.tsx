"use client";

import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchCoreHealth, type CoreHealthSnapshot } from "@/lib/monitoring/health-client";
import type { ServiceStatus } from "@/lib/monitoring/services";

interface LiveIncident {
  name: string;
  status: ServiceStatus;
}

/**
 * Client component that uses the same probe as the System Status page
 * (fetchCoreHealth) to display currently active incidents on the Health
 * Metrics page. This ensures the Health Metrics page reflects the same
 * live status that System Status shows, even when the uptime_events table
 * has no historical records.
 */
export function LiveIncidents() {
  const [incidents, setIncidents] = useState<LiveIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    async function probe() {
      try {
        const health: CoreHealthSnapshot = await fetchCoreHealth();
        if (cancelled) return;

        const active: LiveIncident[] = [];
        if (health.webApp !== "operational") {
          active.push({ name: "Web App (Next.js)", status: health.webApp });
        }
        if (health.database !== "operational") {
          active.push({ name: "Database (Supabase)", status: health.database });
        }
        if (health.auth !== "operational") {
          active.push({ name: "Auth (Supabase Auth)", status: health.auth });
        }

        setIncidents(active);
        setCheckedAt(health.checkedAt);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    function startPolling() {
      if (interval) return;
      probe();
      interval = setInterval(probe, 60_000);
    }

    function stopPolling() {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        stopPolling();
      } else {
        startPolling();
      }
    }

    startPolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4" />
            Incidents en direct
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Chargement des sondes en direct...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4" />
          Incidents en direct
        </CardTitle>
      </CardHeader>
      <CardContent>
        {incidents.length === 0 ? (
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <p className="text-sm text-muted-foreground">
              Aucun incident actif. Tous les services sont opérationnels.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {incidents.map((incident) => (
              <div
                key={incident.name}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-2">
                  {incident.status === "down" ? (
                    <XCircle className="h-4 w-4 text-red-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  )}
                  <span className="text-sm font-medium">{incident.name}</span>
                </div>
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                    incident.status === "down"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                  }`}
                >
                  {incident.status === "down" ? "En panne" : "Dégradé"}
                </span>
              </div>
            ))}
          </div>
        )}
        {/* B2/B3 fix: toLocaleTimeString() output differs between server and
            client locale → suppressHydrationWarning prevents React #418. */}
        {checkedAt && (
          <p suppressHydrationWarning className="mt-3 text-xs text-muted-foreground">
            Dernière vérification : {checkedAt.toLocaleTimeString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
