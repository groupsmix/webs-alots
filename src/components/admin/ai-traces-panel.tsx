"use client";

/**
 * AI Traces Panel — Phase E1
 *
 * Displays per-request AI trace data with aggregation charts:
 * 1. Daily cost by feature
 * 2. Fallback rate by provider
 * 3. p95 latency
 *
 * Table of recent traces with status, provider, model, latency, cost.
 */

import { Activity, AlertTriangle, Clock, DollarSign, Loader2, RefreshCw } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AITraceRow {
  id: string;
  feature: string;
  provider: string;
  model: string;
  fallback_chain: Array<{ provider: string; error?: string }>;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  ttft_ms: number | null;
  status: string;
  error_code: string | null;
  cost_cents: number;
  created_at: string;
}

interface Aggregations {
  dailyCostByFeature: Record<string, Record<string, number>>;
  fallbackRateByProvider: Record<string, { total: number; fallbacks: number }>;
  p95Latency: number;
  totalTraces: number;
}

interface TracesData {
  traces: AITraceRow[];
  aggregations: Aggregations;
}

const STATUS_COLORS: Record<string, string> = {
  ok: "bg-green-100 text-green-800",
  validation_failed: "bg-yellow-100 text-yellow-800",
  all_providers_failed: "bg-red-100 text-red-800",
  rate_limited: "bg-orange-100 text-orange-800",
  error: "bg-red-100 text-red-800",
};

export function AITracesPanel() {
  const [data, setData] = useState<TracesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const didMount = useRef(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/admin/ai-traces?days=${days}`);
      if (!res.ok) throw new Error("Failed to load traces");
      const json = await res.json();
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      void fetchData();
    }
  }, [fetchData]);

  useEffect(() => {
    if (didMount.current) {
      void fetchData();
    }
  }, [days, fetchData]);

  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading AI traces...
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-red-600">
          <AlertTriangle className="h-4 w-4 inline mr-2" />
          {error}
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { traces, aggregations } = data;

  // Build daily cost chart data
  const dailyCostEntries = Object.entries(aggregations.dailyCostByFeature).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  // Get all features for cost chart
  const allFeatures = new Set<string>();
  for (const [, featureCosts] of dailyCostEntries) {
    for (const feat of Object.keys(featureCosts)) {
      allFeatures.add(feat);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header + controls */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5" />
          AI Traces
        </h2>
        <div className="flex items-center gap-2">
          <select
            className="text-sm border rounded px-2 py-1"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={1}>Last 24h</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => void fetchData()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Traces</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aggregations.totalTraces}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">p95 Latency</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aggregations.p95Latency}ms</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(traces.reduce((sum, t) => sum + (t.cost_cents ?? 0), 0) / 100).toFixed(2)} MAD
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {traces.length > 0
                ? ((traces.filter((t) => t.status !== "ok").length / traces.length) * 100).toFixed(
                    1,
                  )
                : "0"}
              %
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily cost by feature (table-based chart) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Daily Cost by Feature (cents)</CardTitle>
        </CardHeader>
        <CardContent>
          {dailyCostEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data for this period</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-1 px-2">Date</th>
                    {[...allFeatures].map((f) => (
                      <th key={f} className="text-right py-1 px-2">
                        {f}
                      </th>
                    ))}
                    <th className="text-right py-1 px-2 font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyCostEntries.map(([day, featureCosts]) => {
                    const total = Object.values(featureCosts).reduce((s, v) => s + v, 0);
                    return (
                      <tr key={day} className="border-b hover:bg-muted/50">
                        <td className="py-1 px-2">{day}</td>
                        {[...allFeatures].map((f) => (
                          <td key={f} className="text-right py-1 px-2">
                            {(featureCosts[f] ?? 0).toFixed(2)}
                          </td>
                        ))}
                        <td className="text-right py-1 px-2 font-semibold">{total.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fallback rate by provider */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Fallback Rate by Provider</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(aggregations.fallbackRateByProvider).map(([prov, stats]) => {
              const rate = stats.total > 0 ? (stats.fallbacks / stats.total) * 100 : 0;
              const isHigh = rate > 30;
              return (
                <div key={prov} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{prov}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${isHigh ? "bg-red-500" : "bg-blue-500"}`}
                        style={{ width: `${Math.min(rate, 100)}%` }}
                      />
                    </div>
                    <span className={`text-sm ${isHigh ? "text-red-600 font-semibold" : ""}`}>
                      {rate.toFixed(1)}%
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({stats.fallbacks}/{stats.total})
                    </span>
                    {isHigh && (
                      <Badge variant="destructive" className="text-xs">
                        Alert
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
            {Object.keys(aggregations.fallbackRateByProvider).length === 0 && (
              <p className="text-sm text-muted-foreground">No provider data</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent traces table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Recent Traces ({traces.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Time</th>
                  <th className="text-left py-2 px-2">Feature</th>
                  <th className="text-left py-2 px-2">Provider</th>
                  <th className="text-left py-2 px-2">Model</th>
                  <th className="text-left py-2 px-2">Status</th>
                  <th className="text-right py-2 px-2">Tokens</th>
                  <th className="text-right py-2 px-2">Latency</th>
                  <th className="text-right py-2 px-2">Cost</th>
                  <th className="text-left py-2 px-2">Fallback</th>
                </tr>
              </thead>
              <tbody>
                {traces.slice(0, 50).map((trace) => (
                  <tr key={trace.id} className="border-b hover:bg-muted/50">
                    <td className="py-1 px-2 text-xs text-muted-foreground">
                      {new Date(trace.created_at).toLocaleString("fr-MA")}
                    </td>
                    <td className="py-1 px-2">{trace.feature}</td>
                    <td className="py-1 px-2">{trace.provider}</td>
                    <td className="py-1 px-2 text-xs">{trace.model}</td>
                    <td className="py-1 px-2">
                      <Badge variant="outline" className={STATUS_COLORS[trace.status] ?? ""}>
                        {trace.status}
                      </Badge>
                    </td>
                    <td className="py-1 px-2 text-right">
                      {trace.input_tokens + trace.output_tokens}
                    </td>
                    <td className="py-1 px-2 text-right">{trace.latency_ms}ms</td>
                    <td className="py-1 px-2 text-right">{(trace.cost_cents / 100).toFixed(4)}</td>
                    <td className="py-1 px-2">
                      {trace.fallback_chain.length > 0 ? (
                        <Badge variant="outline" className="bg-orange-50 text-orange-700 text-xs">
                          {trace.fallback_chain.length} retry
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
                {traces.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-muted-foreground">
                      No traces for this period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
