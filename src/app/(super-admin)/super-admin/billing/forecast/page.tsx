"use client";

import {
  TrendingUp,
  DollarSign,
  BarChart3,
  RefreshCw,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  Calendar,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/loading-skeleton";
import { logger } from "@/lib/logger";
import { formatCurrency } from "@/lib/utils";

interface RevenueSnapshot {
  id: string;
  month: string;
  mrr: number;
  arr: number;
  total_clinics: number;
  paid_clinics: number;
  churned_clinics: number;
  new_clinics: number;
  expansion_revenue: number;
  contraction_revenue: number;
  plan_breakdown: Record<string, number>;
}

interface RevenueForecast {
  id: string;
  forecast_month: string;
  predicted_mrr: number;
  predicted_arr: number;
  confidence_low: number;
  confidence_high: number;
  assumptions: {
    growth_rate: number;
    base_mrr: number;
    months_of_history: number;
  };
  model_version: string;
}

interface CurrentRevenue {
  mrr: number;
  arr: number;
  totalClinics: number;
  paidClinics: number;
  planBreakdown: Record<string, number>;
  month: string;
}

export default function RevenueForecastPage() {
  const [current, setCurrent] = useState<CurrentRevenue | null>(null);
  const [historical, setHistorical] = useState<RevenueSnapshot[]>([]);
  const [forecasts, setForecasts] = useState<RevenueForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/super-admin/revenue-forecast?months_ahead=6");
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Failed to load forecast data");

      setCurrent(json.data.current);
      setHistorical(json.data.historical);
      setForecasts(json.data.forecasts);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      logger.warn("Failed to load revenue forecast", { context: "forecast-page", error: err });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    timeouts.push(
      setTimeout(() => {
        fetchData();
      }, 0),
    );

    return () => {
      timeouts.forEach((t) => clearTimeout(t));
    };
  }, [fetchData]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/super-admin/revenue-forecast?months_ahead=6", {
        method: "POST",
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Forecast generation failed");
      await fetchData();
    } catch (err) {
      logger.warn("Forecast generation failed", { context: "forecast-page", error: err });
    } finally {
      setGenerating(false);
    }
  }

  function formatMonth(monthStr: string): string {
    const [year, month] = monthStr.split("-");
    const months = [
      "Janv",
      "Févr",
      "Mars",
      "Avr",
      "Mai",
      "Juin",
      "Juil",
      "Août",
      "Sept",
      "Oct",
      "Nov",
      "Déc",
    ];
    return `${months[parseInt(month) - 1]} ${year}`;
  }

  // Calculate MRR growth from historical
  const mrrGrowth =
    historical.length >= 2
      ? ((Number(historical[historical.length - 1]?.mrr ?? 0) -
          Number(historical[historical.length - 2]?.mrr ?? 0)) /
          Math.max(Number(historical[historical.length - 2]?.mrr ?? 1), 1)) *
        100
      : 0;

  return (
    <div className="space-y-6 p-6">
      <Breadcrumb
        items={[
          { label: "Super Admin", href: "/super-admin/dashboard" },
          { label: "Facturation", href: "/super-admin/billing" },
          { label: "Prévision de revenus" },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Prévision de revenus</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Prédire les revenus SaaS à partir des tendances MRR et des données pipeline
          </p>
        </div>
        <Button onClick={handleGenerate} disabled={generating} variant="outline">
          {generating ? (
            <Loader2 className="h-4 w-4 me-1 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 me-1" />
          )}
          Générer la prévision
        </Button>
      </div>

      {loading && <CardSkeleton count={4} className="mb-6" />}

      {error && (
        <Card>
          <CardContent className="p-6 text-center text-red-600">{error}</CardContent>
        </Card>
      )}

      {!loading && !error && current && (
        <>
          {/* Current KPIs */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="text-xs text-muted-foreground">MRR actuel</span>
                </div>
                <p className="text-2xl font-bold">{formatCurrency(current.mrr)}</p>
                {mrrGrowth !== 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    {mrrGrowth > 0 ? (
                      <ArrowUpRight className="h-3 w-3 text-green-600" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3 text-red-600" />
                    )}
                    <span
                      className={`text-xs ${mrrGrowth > 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      {mrrGrowth > 0 ? "+" : ""}
                      {mrrGrowth.toFixed(1)}% vs mois précédent
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-blue-600" />
                  <span className="text-xs text-muted-foreground">ARR actuel</span>
                </div>
                <p className="text-2xl font-bold">{formatCurrency(current.arr)}</p>
                <p className="text-xs text-muted-foreground">MAD / an</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-purple-600" />
                  <span className="text-xs text-muted-foreground">Cliniques payantes</span>
                </div>
                <p className="text-2xl font-bold">{current.paidClinics}</p>
                <p className="text-xs text-muted-foreground">sur {current.totalClinics} au total</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-orange-600" />
                  <span className="text-xs text-muted-foreground">Période actuelle</span>
                </div>
                <p className="text-2xl font-bold">{formatMonth(current.month)}</p>
                <p className="text-xs text-muted-foreground">
                  {historical.length} mois d&apos;historique
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Forecast Table */}
          {forecasts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Prévision de revenus
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-start py-3 pe-4 font-medium">Mois</th>
                        <th className="text-end py-3 px-4 font-medium">MRR prévu</th>
                        <th className="text-end py-3 px-4 font-medium">ARR prévu</th>
                        <th className="text-end py-3 px-4 font-medium">Estimation basse</th>
                        <th className="text-end py-3 px-4 font-medium">Estimation haute</th>
                        <th className="text-end py-3 ps-4 font-medium">Taux de croissance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {forecasts.map((f) => (
                        <tr key={f.id ?? f.forecast_month} className="border-b last:border-0">
                          <td className="py-3 pe-4 font-medium">{formatMonth(f.forecast_month)}</td>
                          <td className="py-3 px-4 text-end font-mono">
                            {formatCurrency(f.predicted_mrr)}
                          </td>
                          <td className="py-3 px-4 text-end font-mono">
                            {formatCurrency(f.predicted_arr)}
                          </td>
                          <td className="py-3 px-4 text-end font-mono text-muted-foreground">
                            {formatCurrency(f.confidence_low)}
                          </td>
                          <td className="py-3 px-4 text-end font-mono text-muted-foreground">
                            {formatCurrency(f.confidence_high)}
                          </td>
                          <td className="py-3 ps-4 text-end">
                            <span className="text-green-600">
                              +{f.assumptions?.growth_rate ?? 0}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Visual Trend: Bar chart via CSS */}
          {historical.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Tendance historique du MRR
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-2 h-48">
                  {(() => {
                    const allMrr = [
                      ...historical.map((s) => Number(s.mrr)),
                      ...forecasts.map((f) => f.predicted_mrr),
                    ];
                    const maxMrr = Math.max(...allMrr, 1);

                    return (
                      <>
                        {historical.map((s) => {
                          const height = (Number(s.mrr) / maxMrr) * 100;
                          return (
                            <div
                              key={s.month}
                              className="flex flex-col items-center flex-1 min-w-0"
                            >
                              <span className="text-[10px] text-muted-foreground mb-1 truncate w-full text-center">
                                {formatCurrency(Number(s.mrr))}
                              </span>
                              <div
                                className="w-full bg-blue-500 rounded-t min-h-[4px]"
                                style={{ height: `${height}%` }}
                                title={`${formatMonth(s.month)}: ${formatCurrency(Number(s.mrr))}`}
                              />
                              <span className="text-[10px] text-muted-foreground mt-1 truncate w-full text-center">
                                {s.month.split("-")[1]}
                              </span>
                            </div>
                          );
                        })}
                        {forecasts.map((f) => {
                          const height = (f.predicted_mrr / maxMrr) * 100;
                          return (
                            <div
                              key={f.forecast_month}
                              className="flex flex-col items-center flex-1 min-w-0"
                            >
                              <span className="text-[10px] text-muted-foreground mb-1 truncate w-full text-center">
                                {formatCurrency(f.predicted_mrr)}
                              </span>
                              <div
                                className="w-full bg-blue-300 rounded-t border-2 border-dashed border-blue-400 min-h-[4px]"
                                style={{ height: `${height}%` }}
                                title={`${formatMonth(f.forecast_month)}: ${formatCurrency(f.predicted_mrr)} (forecast)`}
                              />
                              <span className="text-[10px] text-muted-foreground mt-1 truncate w-full text-center">
                                {f.forecast_month.split("-")[1]}*
                              </span>
                            </div>
                          );
                        })}
                      </>
                    );
                  })()}
                </div>
                <p className="text-xs text-muted-foreground mt-3 text-center">
                  * Mois prévisionnels affichés avec des bordures pointillées
                </p>
              </CardContent>
            </Card>
          )}

          {/* Plan Breakdown */}
          {current.planBreakdown && Object.keys(current.planBreakdown).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Répartition actuelle des forfaits</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {Object.entries(current.planBreakdown).map(([plan, count]) => (
                    <div
                      key={plan}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <span className="text-sm font-medium capitalize">{plan}</span>
                      <span className="text-lg font-bold">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
