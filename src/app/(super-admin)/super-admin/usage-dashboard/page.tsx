/* eslint-disable i18next/no-literal-string */
"use client";

import { BarChart3, AlertTriangle, TrendingUp, Loader2, DollarSign } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { logger } from "@/lib/logger";

// ── Types ──

interface ClinicUsageRow {
  clinicId: string;
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

  const loadAllUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/usage/quota");
      const json = (await res.json()) as { ok: boolean; data?: { usage: ClinicUsageRow[] } };
      if (json.ok && json.data) {
        setAllUsage(json.data.usage);
      }
    } catch (err) {
      logger.warn("Failed to load usage data", { context: "usage-dashboard", error: err });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadClinicDetail = useCallback(async (clinicId: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/usage/quota?clinic_id=${clinicId}`);
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
    loadAllUsage();
  }, [loadAllUsage]);

  useEffect(() => {
    if (selectedClinic) loadClinicDetail(selectedClinic);
  }, [selectedClinic, loadClinicDetail]);

  // Aggregate usage by clinic
  const clinicTotals = allUsage.reduce(
    (acc, row) => {
      if (!acc[row.clinicId]) acc[row.clinicId] = { totalCost: 0, resources: {} };
      acc[row.clinicId].totalCost += row.totalCostUsd;
      acc[row.clinicId].resources[row.resourceType] = row.totalUnits;
      return acc;
    },
    {} as Record<string, { totalCost: number; resources: Record<string, number> }>,
  );

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
        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
        Loading usage data...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Super Admin", href: "/super-admin/dashboard" },
          { label: "Usage Dashboard" },
        ]}
      />

      <h1 className="text-2xl font-bold">Usage Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost (MTD)</CardTitle>
            <DollarSign className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCostAllClinics.toFixed(4)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Clinics</CardTitle>
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
                <p className="text-muted-foreground text-xs">${v.cost.toFixed(4)} cost</p>
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Top Consumers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Top Consumers (This Month)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topConsumers.length === 0 ? (
            <p className="text-muted-foreground text-sm">No usage recorded this month.</p>
          ) : (
            <div className="space-y-2">
              {topConsumers.map(([clinicId, data]) => (
                <button
                  key={clinicId}
                  onClick={() => setSelectedClinic(clinicId)}
                  className={`hover:bg-muted flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                    selectedClinic === clinicId ? "border-primary bg-muted" : ""
                  }`}
                >
                  <div>
                    <span className="font-mono text-sm">{clinicId.slice(0, 8)}…</span>
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
            <CardTitle>Clinic: {selectedClinic.slice(0, 8)}…</CardTitle>
          </CardHeader>
          <CardContent>
            {detailLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : clinicDetail ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Plan:</span>
                  <Badge>{clinicDetail.tier}</Badge>
                </div>

                {/* Quota Status */}
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Quota Status</h3>
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
                  <h3 className="mb-2 text-sm font-semibold">Usage This Month</h3>
                  {clinicDetail.usage.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No usage recorded.</p>
                  ) : (
                    <div className="space-y-1">
                      {clinicDetail.usage.map((u) => (
                        <div
                          key={u.resourceType}
                          className="flex items-center justify-between rounded border p-2 text-sm"
                        >
                          <span>{resourceLabel(u.resourceType)}</span>
                          <div className="flex gap-4">
                            <span>{formatUnits(u.resourceType, u.totalUnits)} units</span>
                            <span className="font-mono">${u.totalCostUsd.toFixed(4)}</span>
                            <span className="text-muted-foreground">{u.eventCount} events</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No data available.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
