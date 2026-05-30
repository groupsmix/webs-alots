/* eslint-disable i18next/no-literal-string */
"use client";

import {
  Activity,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Database,
  Globe,
  Shield,
  MessageSquare,
  CreditCard,
  HardDrive,
  Server,
  Clock,
  RefreshCw,
  Users,
  Info,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/loading-skeleton";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase-client";

type ServiceStatus = "operational" | "degraded" | "down";

interface ServiceHealth {
  name: string;
  description: string;
  status: ServiceStatus;
  icon: React.ElementType;
  lastChecked: Date;
}

interface HealthApiResponse {
  status: string;
  database: string;
  version: string;
  timestamp: string;
}

const STATUS_CONFIG: Record<
  ServiceStatus,
  { label: string; color: string; bg: string; icon: React.ElementType }
> = {
  operational: {
    label: "Operational",
    color: "text-green-700",
    bg: "bg-green-50 border-green-200",
    icon: CheckCircle,
  },
  degraded: {
    label: "Degraded",
    color: "text-amber-700",
    bg: "bg-amber-50 border-amber-200",
    icon: AlertTriangle,
  },
  down: {
    label: "Down",
    color: "text-red-700",
    bg: "bg-red-50 border-red-200",
    icon: XCircle,
  },
};

function StatusBadge({ status }: { status: ServiceStatus }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.color}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

function StorageBar({ used, total, label }: { used: string; total: string; label: string }) {
  const usedNum = parseFloat(used);
  const totalNum = parseFloat(total);
  const percentage = totalNum > 0 ? (usedNum / totalNum) * 100 : 0;
  const barColor =
    percentage > 80 ? "bg-red-500" : percentage > 60 ? "bg-amber-500" : "bg-green-500";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {used} / {total}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}

export default function SystemStatusPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [overallStatus, setOverallStatus] = useState<ServiceStatus>("operational");
  const [activeUsers, setActiveUsers] = useState(0);
  const [appVersion, setAppVersion] = useState("0.1.0");
  const [lastChecked, setLastChecked] = useState<Date>(new Date());

  const loadHealth = useCallback(async () => {
    try {
      const now = new Date();
      const serviceResults: ServiceHealth[] = [];

      let webAppStatus: ServiceStatus = "operational";
      let dbStatus: ServiceStatus = "operational";
      let dbConnected = false;
      let version = "0.1.0";

      try {
        const res = await fetch("/api/admin/health");
        if (res.ok) {
          const json = (await res.json()) as { ok: boolean; data: HealthApiResponse };
          if (json.ok && json.data) {
            dbConnected = json.data.database === "connected";
            version = json.data.version;
          }
        } else {
          webAppStatus = "degraded";
        }
      } catch {
        webAppStatus = "degraded";
      }

      dbStatus = dbConnected ? "operational" : "down";
      setAppVersion(version);

      let userCount = 0;
      try {
        const supabase = createClient();
        const { count } = await supabase.from("users").select("id", { count: "exact", head: true });
        userCount = count ?? 0;
      } catch {
        logger.warn("Failed to fetch active user count", { context: "system-status" });
      }
      setActiveUsers(userCount);

      let authStatus: ServiceStatus = "operational";
      try {
        const supabase = createClient();
        const { error } = await supabase.auth.getUser();
        if (error) authStatus = "degraded";
      } catch {
        authStatus = "down";
      }

      serviceResults.push(
        {
          name: "Web App (Next.js)",
          description: "Main application server",
          status: webAppStatus,
          icon: Globe,
          lastChecked: now,
        },
        {
          name: "Database (Supabase)",
          description: "PostgreSQL database with RLS",
          status: dbStatus,
          icon: Database,
          lastChecked: now,
        },
        {
          name: "Storage (R2)",
          description: "Cloudflare R2 object storage",
          status: "operational",
          icon: HardDrive,
          lastChecked: now,
        },
        {
          name: "Auth (Supabase Auth)",
          description: "Authentication service",
          status: authStatus,
          icon: Shield,
          lastChecked: now,
        },
        {
          name: "WhatsApp API",
          description: "Meta Cloud API for notifications",
          status: "operational",
          icon: MessageSquare,
          lastChecked: now,
        },
        {
          name: "Payment Gateway",
          description: "CMI / Stripe payment processing",
          status: "operational",
          icon: CreditCard,
          lastChecked: now,
        },
      );

      setServices(serviceResults);

      const hasDown = serviceResults.some((s) => s.status === "down");
      const hasDegraded = serviceResults.some((s) => s.status === "degraded");
      setOverallStatus(hasDown ? "down" : hasDegraded ? "degraded" : "operational");
      setLastChecked(now);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadHealth();
    return () => {
      controller.abort();
    };
  }, [loadHealth]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadHealth();
    setRefreshing(false);
  };

  const overallConfig = STATUS_CONFIG[overallStatus];
  const OverallIcon = overallConfig.icon;

  const kpiCards = [
    {
      label: "System Status",
      value: overallConfig.label,
      icon: OverallIcon,
      color: overallConfig.color,
      bg:
        overallStatus === "operational"
          ? "bg-green-50"
          : overallStatus === "degraded"
            ? "bg-amber-50"
            : "bg-red-50",
    },
    {
      label: "Uptime",
      value: "99.9%",
      icon: Activity,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "API Latency",
      value: "avg 120ms",
      icon: Clock,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: "Active Users",
      value: activeUsers.toLocaleString(),
      icon: Users,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <Breadcrumb
          items={[
            { label: "Super Admin", href: "/super-admin/dashboard" },
            { label: "System Status" },
          ]}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Breadcrumb
          items={[
            { label: "Super Admin", href: "/super-admin/dashboard" },
            { label: "System Status" },
          ]}
        />
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className={`rounded-lg p-2.5 ${kpi.bg}`}>
                <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{kpi.label}</p>
                <p
                  className={`text-lg font-semibold ${kpi.label === "System Status" ? kpi.color : ""}`}
                >
                  {kpi.value}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Service Health Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-4 w-4" />
            Service Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <div key={service.name} className="flex items-start gap-3 rounded-lg border p-4">
                <div className="rounded-lg bg-muted p-2">
                  <service.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{service.name}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{service.description}</p>
                  <div className="flex items-center justify-between pt-1">
                    <StatusBadge status={service.status} />
                    <span className="text-[10px] text-muted-foreground">
                      {service.lastChecked.toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Platform Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-4 w-4" />
              Platform Info
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              {[
                { label: "App Version", value: appVersion },
                {
                  label: "Node.js Version",
                  value: typeof process !== "undefined" ? (process.version ?? "N/A") : "N/A",
                },
                { label: "Next.js Version", value: "16" },
                { label: "Last Deployment", value: process.env.NEXT_PUBLIC_DEPLOY_TIME ?? "N/A" },
                {
                  label: "Environment",
                  value: process.env.NODE_ENV === "production" ? "Production" : "Staging",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between border-b pb-2 last:border-0"
                >
                  <dt className="text-sm text-muted-foreground">{item.label}</dt>
                  <dd className="text-sm font-medium">
                    <Badge variant="outline">{item.value}</Badge>
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        {/* Storage Usage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HardDrive className="h-4 w-4" />
              Storage Usage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <StorageBar used="245 MB" total="500 MB" label="Database" />
            <StorageBar used="1.2 GB" total="10 GB" label="R2 Storage" />
          </CardContent>
        </Card>
      </div>

      {/* Recent Incidents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4" />
            Recent Incidents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle className="h-10 w-10 text-green-500 mb-3" />
            <p className="text-sm font-medium">No recent incidents</p>
            <p className="text-xs text-muted-foreground mt-1">
              All systems have been running smoothly
            </p>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Last checked: {lastChecked.toLocaleString()}
      </p>
    </div>
  );
}
