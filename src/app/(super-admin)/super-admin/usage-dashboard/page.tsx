"use client";

import {
  BarChart3,
  AlertTriangle,
  TrendingUp,
  Loader2,
  DollarSign,
  MapPin,
  RefreshCw,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { logger } from "@/lib/logger";

// ── Types ──

interface ClinicUsageRow {
  clinicId: string;
  clinicName?: string | null;
  resourceType: string;
  totalUnits: number;
  totalCostUsd: number;
}

interface QuotaResult {
  allowed: boolean;
  currentUsage: number;
  limit: number;
  remainingUnits: number;
  plan: string;
}

interface ClinicDetail {
  clinicId: string;
  tier: string;
  quota: Record<string, QuotaResult>;
  usage: Array<{
    resourceType: string;
    totalUnits: number;
    totalCostUsd: number;
    eventCount: number;
  }>;
}

// ── Helpers ──

function resourceLabel(rt: string): string {
  const labels: Record<string, string> = {
    whatsapp: "WhatsApp",
    sms: "SMS",
    ai_tokens: "AI Tokens",
    r2_storage: "R2 Storage",
  };
  return labels[rt] ?? rt;
}

function formatUnits(rt: string, units: number): string {
  if (rt === "r2_storage") {
    if (units > 1024 * 1024 * 1024) return `${(units / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    if (units > 1024 * 1024) return `${(units / (1024 * 1024)).toFixed(1)} MB`;
    return `${(units / 1024).toFixed(0)} KB`;
  }
  if (units > 1000) return `${(units / 1000).toFixed(1)}k`;
  return units.toFixed(0);
}

function quotaPercent(q: QuotaResult): number {
  if (q.limit === -1) return 0;
  if (q.limit === 0) return q.currentUsage > 0 ? 100 : 0;
  return Math.min(100, Math.round((q.currentUsage / q.limit) * 100));
}

// ── Component ──

export default function UsageDashboardPage() {
  const [allUsage, setAllUsage] = useState<ClinicUsageRow[]>([]);
  const [selectedClinic, setSelectedClinic] = useState<string | null>(null);
  const [clinicDetail, setClinicDetail] = useState<ClinicDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  // I2: track failed/blocked top-level fetch so "no usage" isn't shown for a 403.
  const [fetchError, setFetchError] = useState(false);
  const [geoBlocked, setGeoBlocked] = useState(false);

  const loadAllUsage = useCallback(async () => {
    setFetchError(false);
    setGeoBlocked(false);
    try {
      const res = await fetch("/api/super-admin/usage/quota");
      let isGeo = false;
      try {
        const json = (await res.json()) as {
          ok: boolean;
          code?: string;
          data?: { usage: ClinicUsageRow[] };
        };
        if (res.ok && json.ok && json.data) {
          setAllUsage(json.data.usage);
          return;
        }
        isGeo = json?.code === "GEO_RESTRICTED";
      } catch {
        /* non-JSON error body */
      }
      if (isGeo) setGeoBlocked(true);
      else setFetchError(true);
    } catch (err) {
      logger.warn("Failed to load usage data", { context: "usage-dashboard", error: err });
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadClinicDetail = useCallback(async (clinicId: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/super-admin/usage/quota?clinic_id=${clinicId}`);
      const json = (await res.json()) as { ok: boolean; data?: ClinicDetail };
      if (json.ok && json.data) {
        setClinicDetail(json.data);
      }
    } catch (err) {
      logger.warn("Failed to load clinic detail", { context: "usage-dashboard", error: err });
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    timeouts.push(
      setTimeout(() => {
        loadAllUsage();
      }, 0),
    );

    return () => {
      timeouts.forEach((t) => clearTimeout(t));
    };
  }, [loadAllUsage]);

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    if (selectedClinic)
      timeouts.push(
        setTimeout(() => {
          loadClinicDetail(selectedClinic);
        }, 0),
      );

    return () => {
      timeouts.forEach((t) => clearTimeout(t));
    };
  }, [selectedClinic, loadClinicDetail]);

  // Aggregate usage by clinic
  const clinicTotals = allUsage.reduce(
    (acc, row) => {
      if (!acc[row.clinicId])
        acc[row.clinicId] = { totalCost: 0, resources: {}, name: row.clinicName ?? null };
      if (row.clinicName) acc[row.clinicId].name = row.clinicName;
      acc[row.clinicId].totalCost += row.totalCostUsd;
      acc[row.clinicId].resources[row.resourceType] = row.totalUnits;
      return acc;
    },
    {} as Record<
      string,
      { totalCost: number; resources: Record<string, number>; name: string | null }
    >,
  );

  // Map of clinicId -> display name, for the detail header.
  const clinicNameById = (id: string): string => clinicTotals[id]?.name ?? `${id.slice(0, 8)}…`;

  const topConsumers = Object.entries(clinicTotals)
    .sort(([, a], [, b]) => b.totalCost - a.totalCost)
    .slice(0, 10);

  const totalCostAllClinics = Object.values(clinicTotals).reduce((s, c) => s + c.totalCost, 0);

  // Aggregate by resource type
  const resourceTotals = allUsage.reduce(
    (acc, row) => {
      if (!acc[row.resourceType]) acc[row.resourceType] = { units: 0, cost: 0 };
      acc[row.resourceType].units += row.totalUnits;
      acc[row.resourceType].cost += row.totalCostUsd;
      return acc;
    },
    {} as Record<string, { units: number; cost: number }>,
  );

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="me-2 h-6 w-6 animate-spin" />
        Chargement des données d&apos;utilisation…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Super Admin", href: "/super-admin/dashboard" },
          { label: "Tableau de bord usage" },
        ]}
      />

      <h1 className="text-2xl font-bold">Tableau de bord d&apos;utilisation</h1>

      {/* I2: geo-block / failure banners */}
      {geoBlocked && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:bg-amber-900/20 dark:border-amber-700">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-200">
              Accès restreint depuis votre localisation
            </p>
            <p className="text-amber-700 dark:text-amber-300 mt-0.5">
              L&apos;API d&apos;utilisation/quota est limitée aux accès depuis le Maroc. Les
              montants affichés (zéro) ne reflètent pas la consommation réelle.
            </p>
          </div>
        </div>
      )}
      {fetchError && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
          <span className="flex-1 text-destructive">
            Impossible de charger les données d&apos;utilisation (erreur réseau ou API
            indisponible).
          </span>
          <Button variant="outline" size="sm" onClick={() => loadAllUsage()}>
            <RefreshCw className="h-3.5 w-3.5 me-1" />
            Réessayer
          </Button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            {/* B6: this is the raw AI/infra provider cost, billed in USD — labelled
                explicitly so it isn't mistaken for a MAD platform-revenue figure. */}
            <CardTitle className="text-sm font-medium">
              Coût fournisseur (USD, mois en cours)
            </CardTitle>
            <DollarSign className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCostAllClinics.toFixed(4)}</div>
            <p className="text-muted-foreground text-xs">Coût des fournisseurs (USD), hors MAD</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cliniques actives</CardTitle>
            <BarChart3 className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(clinicTotals).length}</div>
          </CardContent>
        </Card>
        {Object.entries(resourceTotals)
          .slice(0, 2)
          .map(([rt, v]) => (
            <Card key={rt}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{resourceLabel(rt)}</CardTitle>
                <TrendingUp className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatUnits(rt, v.units)}</div>
                <p className="text-muted-foreground text-xs">${v.cost.toFixed(4)} (USD)</p>
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Top Consumers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Plus gros consommateurs (ce mois-ci)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topConsumers.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {geoBlocked || fetchError
                ? "Données indisponibles — voir le message ci-dessus."
                : "Aucune consommation enregistrée ce mois-ci."}
            </p>
          ) : (
            <div className="space-y-2">
              {topConsumers.map(([clinicId, data]) => (
                <button
                  key={clinicId}
                  onClick={() => setSelectedClinic(clinicId)}
                  className={`hover:bg-muted flex w-full items-center justify-between rounded-lg border p-3 text-start transition-colors ${
                    selectedClinic === clinicId ? "border-primary bg-muted" : ""
                  }`}
                >
                  <div>
                    <span className="text-sm font-medium">
                      {data.name ?? `${clinicId.slice(0, 8)}…`}
                    </span>
                    <div className="mt-1 flex gap-2">
                      {Object.entries(data.resources).map(([rt, units]) => (
                        <Badge key={rt} variant="secondary" className="text-xs">
                          {resourceLabel(rt)}: {formatUnits(rt, units)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <span className="font-bold">${data.totalCost.toFixed(4)}</span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Clinic Detail */}
      {selectedClinic && (
        <Card>
          <CardHeader>
            <CardTitle>Clinique : {clinicNameById(selectedClinic)}</CardTitle>
          </CardHeader>
          <CardContent>
            {detailLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
              </div>
            ) : clinicDetail ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Offre :</span>
                  <Badge>{clinicDetail.tier}</Badge>
                </div>

                {/* Quota Status */}
                <div>
                  <h3 className="mb-2 text-sm font-semibold">État des quotas</h3>
                  <div className="grid gap-2 md:grid-cols-2">
                    {Object.entries(clinicDetail.quota).map(([rt, q]) => {
                      const pct = quotaPercent(q);
                      return (
                        <div key={rt} className="rounded border p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">{resourceLabel(rt)}</span>
                            <span className="text-sm">
                              {q.limit === -1
                                ? "∞"
                                : `${formatUnits(rt, q.currentUsage)} / ${formatUnits(rt, q.limit)}`}
                            </span>
                          </div>
                          {q.limit !== -1 && (
                            <div className="bg-muted mt-1 h-2 w-full rounded-full">
                              <div
                                className={`h-2 rounded-full ${pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-yellow-500" : "bg-green-500"}`}
                                data-width={Math.round(pct)}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Usage Breakdown */}
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Consommation ce mois-ci</h3>
                  {clinicDetail.usage.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      Aucune consommation enregistrée.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {clinicDetail.usage.map((u) => (
                        <div
                          key={u.resourceType}
                          className="flex items-center justify-between rounded border p-2 text-sm"
                        >
                          <span>{resourceLabel(u.resourceType)}</span>
                          <div className="flex gap-4">
                            <span>{formatUnits(u.resourceType, u.totalUnits)} unités</span>
                            <span className="font-mono">${u.totalCostUsd.toFixed(4)}</span>
                            <span className="text-muted-foreground">{u.eventCount} événements</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Aucune donnée disponible.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
