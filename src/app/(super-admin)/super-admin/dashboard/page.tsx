"use client";

import Link from "next/link";
import {
  Building2,
  Users,
  TrendingUp,
  Megaphone,
  Plus,
  ArrowUpRight,
  Activity,
  CreditCard,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  clinicDetails,
  activityLogs,
  announcements,
  getActiveClinicsCount,
  getTotalPatientsCount,
  getTotalMonthlyRevenue,
  getMRR,
  getOverdueCount,
} from "@/lib/super-admin-data";

const stats = [
  {
    icon: Building2,
    label: "Total Clinics",
    value: clinicDetails.length.toString(),
    change: "+2 this month",
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    icon: Building2,
    label: "Active Clinics",
    value: getActiveClinicsCount().toString(),
    change: `${clinicDetails.filter((c) => c.status === "suspended").length} suspended`,
    color: "text-green-600",
    bg: "bg-green-50",
  },
  {
    icon: Users,
    label: "Total Patients",
    value: getTotalPatientsCount().toLocaleString(),
    change: "+89 this month",
    color: "text-purple-600",
    bg: "bg-purple-50",
  },
  {
    icon: TrendingUp,
    label: "Monthly Revenue",
    value: `${getTotalMonthlyRevenue().toLocaleString()} MAD`,
    change: "+12% vs last month",
    color: "text-orange-600",
    bg: "bg-orange-50",
  },
];

const financialStats = [
  { label: "MRR", value: `${getMRR().toLocaleString()} MAD`, icon: CreditCard, color: "text-emerald-600" },
  { label: "Overdue", value: getOverdueCount().toString(), icon: Clock, color: "text-red-500" },
  { label: "Paid This Month", value: `${clinicDetails.filter((c) => c.status === "active").length}`, icon: TrendingUp, color: "text-blue-600" },
];

const activityTypeIcons: Record<string, string> = {
  clinic: "text-blue-600",
  billing: "text-green-600",
  feature: "text-purple-600",
  announcement: "text-orange-600",
  template: "text-pink-600",
  auth: "text-yellow-600",
};

export default function SuperAdminDashboardPage() {
  const activeAnnouncements = announcements.filter((a) => a.active);
  const recentLogs = activityLogs.slice(0, 8);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Super Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Overview of all clinics and system status
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/super-admin/clinics">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              New Clinic
            </Button>
          </Link>
          <Link href="/super-admin/announcements">
            <Button variant="outline" size="sm">
              <Megaphone className="h-4 w-4 mr-1" />
              Announce
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Financial Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        {financialStats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
              <div>
                <p className="text-lg font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Clinics Overview */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Clinics Overview
              </CardTitle>
              <Link href="/super-admin/clinics">
                <Button variant="ghost" size="sm" className="text-xs">
                  View All
                  <ArrowUpRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {clinicDetails.slice(0, 6).map((clinic) => (
                <div
                  key={clinic.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{clinic.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {clinic.type} &middot; {clinic.city} &middot; {clinic.patientsCount} patients
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <Badge
                      variant={
                        clinic.plan === "premium"
                          ? "default"
                          : clinic.plan === "standard"
                          ? "secondary"
                          : "outline"
                      }
                      className="text-[10px]"
                    >
                      {clinic.plan}
                    </Badge>
                    <Badge
                      variant={
                        clinic.status === "active"
                          ? "success"
                          : clinic.status === "suspended"
                          ? "destructive"
                          : "warning"
                      }
                    >
                      {clinic.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Announcements */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Megaphone className="h-4 w-4" />
                  Active Announcements
                </CardTitle>
                <Link href="/super-admin/announcements">
                  <Button variant="ghost" size="sm" className="text-xs">
                    Manage
                    <ArrowUpRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activeAnnouncements.slice(0, 3).map((ann) => (
                  <div key={ann.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium">{ann.title}</p>
                      <Badge
                        variant={
                          ann.type === "critical"
                            ? "destructive"
                            : ann.type === "warning"
                            ? "warning"
                            : "default"
                        }
                        className="text-[10px]"
                      >
                        {ann.type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{ann.message}</p>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-[10px] text-muted-foreground">{ann.targetLabel}</p>
                      <p className="text-[10px] text-muted-foreground">{ann.publishedAt}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3">
                    <div className={`mt-0.5 h-2 w-2 rounded-full ${activityTypeIcons[log.type].replace("text-", "bg-")}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{log.action}</p>
                      <p className="text-xs text-muted-foreground truncate">{log.description}</p>
                      {log.clinicName && (
                        <p className="text-[10px] text-muted-foreground">{log.clinicName}</p>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
