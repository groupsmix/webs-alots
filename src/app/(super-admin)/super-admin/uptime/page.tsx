/* eslint-disable i18next/no-literal-string -- Admin/super-admin internal surface: French UI strings are the intended output language; adding them to the i18n keyset would inflate the translation backlog for internal-only tooling. */
"use client";

import {
  Activity,
  CheckCircle,
  Clock,
  Server,
  Shield,
  Wifi,
  Database,
  AlertTriangle,
  RefreshCw,
  Loader2,
  XCircle,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ServiceStatus = "operational" | "degraded" | "down";

interface HealthData {
  status: string;
  database: string;
  version: string;
  timestamp: string;
}

const statusConfig: Record<
  ServiceStatus,
  { label: string; color: string; icon: typeof CheckCircle }
> = {
  operational: { label: "Operational", color: "bg-green-500", icon: CheckCircle },
  degraded: { label: "Degraded", color: "bg-yellow-500", icon: AlertTriangle },
  down: { label: "Down", color: "bg-red-500", icon: XCircle },
};

const slaTiers = [
  { tier: "Vitrine", uptime: "99%", color: "text-gray-600" },
  { tier: "Cabinet", uptime: "99.5%", color: "text-blue-600" },
  { tier: "Pro", uptime: "99.9%", color: "text-purple-600" },
  { tier: "Premium", uptime: "99.99%", color: "text-amber-600" },
];

export default function UptimeSLAPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [webAppStatus, setWebAppStatus] = useState<ServiceStatus>("operational");
  const [dbStatus, setDbStatus] = useState<ServiceStatus>("operational");
  const [authStatus, setAuthStatus] = useState<ServiceStatus>("operational");
  const [appVersion, setAppVersion] = useState("0.1.0");
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());

  const checkHealth = useCallback(async () => {
    const start = performance.now();
    try {
      const res = await fetch("/api/admin/health");
      const elapsed = Math.round(performance.now() - start);
      setResponseTime(elapsed);

      if (res.ok) {
        const json = (await res.json()) as { ok: boolean; data: HealthData };
        if (json.ok && json.data) {
          setWebAppStatus("operational");
          setDbStatus(json.data.database === "connected" ? "operational" : "down");
          setAppVersion(json.data.version);
        } else {
          setWebAppStatus("degraded");
        }
      } else {
        setWebAppStatus("degraded");
      }
    } catch {
      setWebAppStatus("down");
      setResponseTime(null);
    }

    // Check auth
    try {
      const { createClient } = await import("@/lib/supabase-client");
      const supabase = createClient();
      const { error } = await supabase.auth.getUser();
      setAuthStatus(error ? "degraded" : "operational");
    } catch {
      setAuthStatus("down");
    }

    setLastChecked(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await checkHealth();
    setRefreshing(false);
  };

  const overallStatus: ServiceStatus =
    webAppStatus === "down" || dbStatus === "down" || authStatus === "down"
      ? "down"
      : webAppStatus === "degraded" || dbStatus === "degraded" || authStatus === "degraded"
        ? "degraded"
        : "operational";

  const overallCfg = statusConfig[overallStatus];

  const services = [
    { name: "Web App (Next.js)", status: webAppStatus, icon: Server },
    { name: "Database (Supabase)", status: dbStatus, icon: Database },
    { name: "Auth (Supabase Auth)", status: authStatus, icon: Shield },
  ];

  return (
    <div className="space-y-8 p-4 md:p-6">
      <Breadcrumb
        items={[{ label: "Super Admin", href: "/super-admin/dashboard" }, { label: "Uptime SLA" }]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Uptime SLA</h1>
          <p className="text-muted-foreground">Real-time platform health and SLA targets</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">System Status</p>
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Badge
                    variant={overallStatus === "operational" ? "default" : "destructive"}
                    className="text-sm font-bold"
                  >
                    {overallCfg.label}
                  </Badge>
                )}
              </div>
              <div className="rounded-lg bg-green-50 p-3">
                <Wifi className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Response Time</p>
                <p className="text-2xl font-bold">
                  {loading ? "—" : responseTime !== null ? `${responseTime}ms` : "N/A"}
                </p>
              </div>
              <div className="rounded-lg bg-blue-50 p-3">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">App Version</p>
                <p className="text-2xl font-bold">{loading ? "—" : appVersion}</p>
              </div>
              <div className="rounded-lg bg-purple-50 p-3">
                <Activity className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Last Checked</p>
                <p className="text-sm font-medium">
                  {loading ? "—" : lastChecked.toLocaleTimeString()}
                </p>
              </div>
              <div className="rounded-lg bg-green-50 p-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Service Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Service Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((svc) => {
              const cfg = statusConfig[svc.status];
              const Icon = svc.icon;
              return (
                <div key={svc.name} className="flex items-center gap-3 rounded-lg border p-4">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{svc.name}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`h-2 w-2 rounded-full ${cfg.color}`} />
                      <span className="text-xs text-muted-foreground">{cfg.label}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* SLA Tiers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            SLA Tiers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {slaTiers.map((tier) => (
              <div key={tier.tier} className="rounded-lg border p-4 text-center">
                <p className="text-sm font-medium">{tier.tier}</p>
                <p className={`text-xl font-bold mt-1 ${tier.color}`}>{tier.uptime}</p>
                <p className="text-xs text-muted-foreground mt-1">uptime guarantee</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
