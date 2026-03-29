"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Building2,
  Users,
  TrendingUp,
  Megaphone,
  ArrowUpRight,
  Activity,
  CreditCard,
  Clock,
  UserPlus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { CardSkeleton } from "@/components/ui/loading-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchDashboardStats,
  fetchAnnouncements,
  fetchActivityLogs,
  type Announcement,
  type ActivityLog,
} from "@/lib/super-admin-actions";

interface ClinicDetail {
  id: string;
  name: string;
  type: "doctor" | "dentist" | "pharmacy";
  plan: string;
  city: string;
  monthlyRevenue: number;
  status: "active" | "suspended" | "trial";
}

const activityTypeIcons: Record<string, string> = {
  clinic: "text-blue-600",
  billing: "text-green-600",
  feature: "text-purple-600",
  announcement: "text-orange-600",
  template: "text-pink-600",
  auth: "text-yellow-600",
};

export default function SuperAdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [clinicList, setClinicList] = useState<ClinicDetail[]>([]);
  const [totalClinics, setTotalClinics] = useState(0);
  const [activeClinics, setActiveClinics] = useState(0);
  const [totalPatients, setTotalPatients] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [mrr, setMrr] = useState(0);
  const [overdue, setOverdue] = useState(0);
  const [announcementList, setAnnouncementList] = useState<Announcement[]>([]);
  const [activityLogList, setActivityLogList] = useState<ActivityLog[]>([]);

  const loadStats = useCallback(async () => {
    try {
      const [stats, announcements, logs] = await Promise.all([
        fetchDashboardStats(),
        fetchAnnouncements(),
        fetchActivityLogs(),
      ]);

      setTotalClinics(stats.totalClinics);
      setActiveClinics(stats.activeClinics);
      setTotalPatients(stats.totalPatients);
      setTotalRevenue(stats.totalRevenue);
      setMrr(stats.totalRevenue);
      setOverdue(0);

      const mapped: ClinicDetail[] = stats.clinics.map((c) => {
        const config = (c.config ?? {}) as Record<string, unknown>;
        return {
          id: c.id,
          name: c.name,
          type: c.type as "doctor" | "dentist" | "pharmacy",
          plan: (c.tier as string) ?? "pro",
          city: (config.city as string) ?? "",
          monthlyRevenue: 0,
          status: (c.status === "inactive" ? "suspended" : c.status ?? "active") as "active" | "suspended" | "trial",
        };
      });
      setClinicList(mapped);
      setAnnouncementList(announcements);
      setActivityLogList(logs);
    } catch (err) {
      logger.warn("Operation failed", { context: "page", error: err });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadStats();
    return () => { controller.abort(); };
  }, [loadStats]);

  const activeAnnouncements = announcementList.filter((a) => a.active);
  const recentLogs = activityLogList.slice(0, 8);

  const stats = [
    {
      icon: Building2,
      label: "Total Clinics",
      value: totalClinics.toString(),
      change: `${activeClinics} active`,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      icon: Building2,
      label: "Active Clinics",
      value: activeClinics.toString(),
      change: `${totalClinics - activeClinics} inactive`,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      icon: Users,
      label: "Platform Users",
      value: totalPatients > 0 ? `${totalPatients.toLocaleString()}+` : "0",
      change: "registered accounts",
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      icon: TrendingUp,
      label: "Monthly Revenue",
      value: `${totalRevenue.toLocaleString()} MAD`,
      change: "from completed payments",
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ];

  const financialStats = [
    { label: "MRR", value: `${mrr.toLocaleString()} MAD`, icon: CreditCard, color: "text-emerald-600" },
    { label: "Overdue", value: overdue.toString(), icon: Clock, color: "text-red-500" },
    { label: "Paid This Month", value: `${activeClinics}`, icon: TrendingUp, color: "text-blue-600" },
  ];

  return (
    <div>
      <Breadcrumb items={[
        { label: "Super Admin" },
        { label: "Dashboard" },
      ]} />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Super Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Overview of all clinics and system status
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/super-admin/onboarding">
            <Button size="sm">
              <UserPlus className="h-4 w-4 mr-1" />
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
      {loading && (
        <>
          <CardSkeleton count={4} className="mb-6" />
          <CardSkeleton count={3} className="mb-6 lg:grid-cols-3" />
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border p-4 space-y-3">
              <Skeleton className="h-5 w-1/3" />
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-1 flex-1">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-14 rounded-full" />
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-6">
              <div className="rounded-xl border p-4 space-y-3">
                <Skeleton className="h-5 w-1/3" />
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-lg border p-3 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                ))}
              </div>
              <div className="rounded-xl border p-4 space-y-3">
                <Skeleton className="h-5 w-1/3" />
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Skeleton className="h-2 w-2 rounded-full mt-1" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
      {!loading && <>
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
              {clinicList.slice(0, 6).map((clinic) => (
                <div
                  key={clinic.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{clinic.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {clinic.type} &middot; {clinic.city}
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
                    <div className={`mt-0.5 h-2 w-2 rounded-full ${(activityTypeIcons[log.type] ?? "text-gray-600").replace("text-", "bg-")}`} />
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
      </>}
    </div>
  );
}
