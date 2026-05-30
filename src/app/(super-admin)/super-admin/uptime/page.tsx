/* eslint-disable i18next/no-literal-string */
"use client";

import {
  Activity,
  CheckCircle,
  Clock,
  Server,
  Shield,
  Wifi,
  Database,
  MessageSquare,
  CreditCard,
  AlertTriangle,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";

/* ---------- mock data ---------- */

const CURRENT_UPTIME = 99.95;
const AVG_RESPONSE_TIME = 120;
const INCIDENTS_THIS_MONTH = 0;

function generateLast30Days(): {
  date: string;
  uptime: number;
  status: "green" | "yellow" | "red";
}[] {
  const days: { date: string; uptime: number; status: "green" | "yellow" | "red" }[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push({
      date: d.toISOString().slice(0, 10),
      uptime: 100,
      status: "green",
    });
  }
  return days;
}

const uptimeHistory = generateLast30Days();

interface ServiceStatus {
  name: string;
  status: "operational" | "degraded" | "outage";
  icon: React.ElementType;
  lastChecked: string;
}

const services: ServiceStatus[] = [
  { name: "API", status: "operational", icon: Server, lastChecked: "Just now" },
  { name: "Dashboard", status: "operational", icon: Activity, lastChecked: "Just now" },
  { name: "WhatsApp", status: "operational", icon: MessageSquare, lastChecked: "2 min ago" },
  { name: "Payments", status: "operational", icon: CreditCard, lastChecked: "1 min ago" },
  { name: "Database", status: "operational", icon: Database, lastChecked: "Just now" },
];

const slaTiers = [
  { tier: "Vitrine", uptime: "99%", color: "text-gray-600" },
  { tier: "Cabinet", uptime: "99.5%", color: "text-blue-600" },
  { tier: "Pro", uptime: "99.9%", color: "text-purple-600" },
  { tier: "Premium", uptime: "99.99%", color: "text-amber-600" },
];

/* ---------- helpers ---------- */

const statusColor: Record<string, string> = {
  operational: "bg-green-500",
  degraded: "bg-yellow-500",
  outage: "bg-red-500",
};

const statusLabel: Record<string, string> = {
  operational: "Operational",
  degraded: "Degraded",
  outage: "Outage",
};

const blockColor: Record<string, string> = {
  green: "bg-green-500",
  yellow: "bg-yellow-400",
  red: "bg-red-500",
};

/* ---------- component ---------- */

export default function UptimeSLAPage() {
  const [reportDialogOpen, setReportDialogOpen] = useState(false);

  const kpis = [
    {
      label: "Current Uptime",
      value: `${CURRENT_UPTIME}%`,
      icon: Wifi,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Avg Response Time",
      value: `${AVG_RESPONSE_TIME}ms`,
      icon: Clock,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Incidents This Month",
      value: INCIDENTS_THIS_MONTH.toString(),
      icon: AlertTriangle,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: "SLA Status",
      value: "Within SLA",
      icon: Shield,
      color: "text-green-600",
      bg: "bg-green-50",
      badge: true,
    },
  ];

  return (
    <div className="space-y-8 p-4 md:p-6">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[{ label: "Super Admin", href: "/super-admin/dashboard" }, { label: "Uptime SLA" }]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Uptime SLA</h1>
          <p className="text-muted-foreground">
            Monitor platform uptime, service health, and SLA compliance
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{kpi.label}</p>
                  {kpi.badge ? (
                    <Badge variant="success" className="text-sm font-bold">
                      {kpi.value}
                    </Badge>
                  ) : (
                    <p className="text-2xl font-bold">{kpi.value}</p>
                  )}
                </div>
                <div className={`rounded-lg ${kpi.bg} p-3`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Uptime History (Last 30 Days) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Uptime History (Last 30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-1 flex-wrap">
            {uptimeHistory.map((day) => (
              <Tooltip key={day.date} content={`${day.date} — ${day.uptime}% uptime`} side="top">
                <div
                  className={`h-8 w-3 rounded-sm ${blockColor[day.status]} transition-transform hover:scale-125`}
                />
              </Tooltip>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            {CURRENT_UPTIME}% uptime &mdash; {INCIDENTS_THIS_MONTH} incidents
          </p>
        </CardContent>
      </Card>

      {/* Service Status Cards */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Service Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((svc) => (
              <div
                key={svc.name}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex items-center gap-3">
                  <svc.icon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{svc.name}</p>
                    <p className="text-xs text-muted-foreground">Last checked: {svc.lastChecked}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${statusColor[svc.status]}`} />
                  <span className="text-sm font-medium text-green-600">
                    {statusLabel[svc.status]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Incident History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Incident History
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setReportDialogOpen(!reportDialogOpen);
            }}
          >
            Report Incident
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle className="mb-4 h-12 w-12 text-green-500" />
            <p className="text-lg font-medium">No incidents recorded &mdash; great job!</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Placeholder for future incident tracking
            </p>
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {slaTiers.map((tier) => (
              <div key={tier.tier} className="rounded-lg border p-4 text-center">
                <p className={`text-lg font-bold ${tier.color}`}>{tier.tier}</p>
                <p className="mt-2 text-2xl font-bold">{tier.uptime}</p>
                <p className="text-sm text-muted-foreground">guaranteed uptime</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
