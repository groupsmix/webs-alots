"use client";

import { useCallback, useEffect, useState } from "react";
import type { HealthResponse, HealthStatus } from "@/app/api/health/route";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_COLORS: Record<string, string> = {
  ok: "bg-green-500",
  healthy: "bg-green-500",
  degraded: "bg-yellow-500",
  unhealthy: "bg-red-500",
  down: "bg-red-500",
  loading: "bg-gray-400 animate-pulse",
};

const STATUS_TEXT_COLORS: Record<string, string> = {
  ok: "text-green-700 dark:text-green-400",
  healthy: "text-green-700 dark:text-green-400",
  degraded: "text-yellow-700 dark:text-yellow-400",
  unhealthy: "text-red-700 dark:text-red-400",
  down: "text-red-700 dark:text-red-400",
  loading: "text-gray-500",
};

function StatusDot({ status }: { status: string }) {
  return (
    <span
      className={`inline-block h-3 w-3 rounded-full ${STATUS_COLORS[status] ?? "bg-gray-400"}`}
    />
  );
}

function OverallBanner({ status }: { status: HealthStatus | "loading" }) {
  const bannerColors: Record<string, string> = {
    healthy: "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800",
    degraded: "bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800",
    unhealthy: "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800",
    loading: "bg-gray-50 border-gray-200 dark:bg-gray-900 dark:border-gray-700",
  };
  const labels: Record<string, string> = {
    healthy: "All Systems Operational",
    degraded: "Some Systems Degraded",
    unhealthy: "Service Disruption",
    loading: "Checking...",
  };
  return (
    <div
      className={`rounded-lg border p-4 flex items-center gap-3 ${bannerColors[status] ?? bannerColors.loading}`}
    >
      <StatusDot status={status} />
      <span className={`font-semibold text-lg ${STATUS_TEXT_COLORS[status] ?? ""}`}>
        {labels[status] ?? status}
      </span>
    </div>
  );
}

interface CheckCardProps {
  name: string;
  status: string;
  latencyMs?: number;
  error?: string;
  backend?: string;
  detail?: string;
}

function CheckCard({ name, status, latencyMs, error, backend, detail }: CheckCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>{name}</span>
          <StatusDot status={status} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className={`text-sm font-semibold ${STATUS_TEXT_COLORS[status] ?? ""}`}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </p>
        {latencyMs !== undefined && (
          <p className="text-xs text-muted-foreground">{latencyMs}ms latency</p>
        )}
        {backend && <p className="text-xs text-muted-foreground">Backend: {backend}</p>}
        {detail && <p className="text-xs text-muted-foreground">Detail: {detail}</p>}
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </CardContent>
    </Card>
  );
}

export default function AdminStatusPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/health");
      const json = (await res.json()) as { data: HealthResponse };
      setHealth(json.data);
      setLastChecked(new Date().toLocaleTimeString());
    } catch {
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = setTimeout(() => {
      void fetchHealth();
    }, 0);
    const interval = setInterval(() => {
      void fetchHealth();
    }, 30_000);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [fetchHealth]);

  return (
    <div>
      <Breadcrumb
        items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "System Status" }]}
      />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">System Status</h1>
        <div className="flex items-center gap-3">
          {lastChecked && (
            <span className="text-xs text-muted-foreground">Last checked: {lastChecked}</span>
          )}
          <Button size="sm" variant="outline" onClick={fetchHealth} disabled={loading}>
            <span
              className={`me-2 inline-block h-2 w-2 rounded-full bg-current ${loading ? "animate-pulse" : "opacity-70"}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        <OverallBanner status={loading && !health ? "loading" : (health?.status ?? "loading")} />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {health ? (
            <>
              <CheckCard
                name="Supabase (Database)"
                status={health.checks.supabase.status}
                latencyMs={health.checks.supabase.latencyMs}
                error={health.checks.supabase.error}
              />
              <CheckCard
                name="R2 Storage"
                status={health.checks.r2.status}
                error={health.checks.r2.error}
              />
              <CheckCard
                name="Rate Limiter"
                status={health.checks.rateLimiter.status}
                backend={health.checks.rateLimiter.backend}
                error={health.checks.rateLimiter.error}
              />
              <CheckCard
                name="AI Service"
                status={health.checks.ai.status}
                backend={health.checks.ai.backend}
                detail={health.checks.ai.detail}
                error={health.checks.ai.error}
              />
            </>
          ) : loading ? (
            <>
              {["Supabase (Database)", "R2 Storage", "Rate Limiter", "AI Service"].map((name) => (
                <CheckCard key={name} name={name} status="loading" />
              ))}
            </>
          ) : (
            <Card className="sm:col-span-2 lg:col-span-3">
              <CardContent className="pt-6 text-center text-sm text-muted-foreground">
                Failed to load health check data. Check network connectivity.
              </CardContent>
            </Card>
          )}
        </div>

        {health?.timestamp && (
          <p className="text-xs text-muted-foreground text-end">
            Server timestamp: {health.timestamp}
          </p>
        )}
      </div>
    </div>
  );
}
