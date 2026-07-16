"use client";

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
  RefreshCw,
  Loader2,
  ArrowUp,
  ArrowDown,
  Percent,
  Download,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useCallback, useRef } from "react";
import { ClinicBriefingWidget } from "@/components/admin/clinic-briefing-widget";
import { OpsSummaryStrip } from "@/components/admin/ops-summary-strip";
import { ComplianceWidget } from "@/components/compliance/compliance-widget";
import { useLocale } from "@/components/locale-switcher";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/loading-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { exportToPDF } from "@/lib/export-utils";
import { t } from "@/lib/i18n";
import { logger } from "@/lib/logger";
import {
  fetchDashboardStats,
  fetchAnnouncements,
  fetchActivityLogs,
  type Announcement,
  type ActivityLog,
} from "@/lib/super-admin-actions";
import { formatCurrency } from "@/lib/utils";

/** Subset of the clinics.config JSONB column used in the dashboard. */
interface ClinicConfigJson {
  city?: string;
}

interface ClinicDetail {
  id: string;
  name: string;
  type: "doctor" | "dentist" | "pharmacy";
  plan: string;
  city: string;
  status: "active" | "suspended" | "trial";
}

const activityTypeIcons: Record<string, string> = {
  clinic: "text-blue-600 dark:text-blue-400",
  billing: "text-green-600 dark:text-green-400",
  feature: "text-purple-600 dark:text-purple-400",
  announcement: "text-orange-600 dark:text-orange-400",
  template: "text-pink-600 dark:text-pink-400",
  auth: "text-yellow-600 dark:text-yellow-400",
};

const AUTO_REFRESH_INTERVAL = 60_000;

export default function SuperAdminDashboardPage() {
  const [locale] = useLocale();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [clinicList, setClinicList] = useState<ClinicDetail[]>([]);
  const [totalClinics, setTotalClinics] = useState(0);
  const [activeClinics, setActiveClinics] = useState(0);
  const [totalPatients, setTotalPatients] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [mrr, setMrr] = useState(0);
  const [overdue, setOverdue] = useState(0);
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);
  const [paidInvoicesThisMonth, setPaidInvoicesThisMonth] = useState(0);
  const [newClinicsThisMonth, setNewClinicsThisMonth] = useState(0);
  const [announcementList, setAnnouncementList] = useState<Announcement[]>([]);
  const [activityLogList, setActivityLogList] = useState<ActivityLog[]>([]);
  const mountedRef = useRef(true);

  const loadStats = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [dashboardStats, announcements, logs] = await Promise.all([
        fetchDashboardStats(),
        fetchAnnouncements(),
        fetchActivityLogs(),
      ]);

      if (!mountedRef.current) return;

      setTotalClinics(dashboardStats.totalClinics);
      setActiveClinics(dashboardStats.activeClinics);
      setTotalPatients(dashboardStats.totalPatients);
      setTotalRevenue(dashboardStats.totalRevenue);
      setMrr(dashboardStats.mrr);
      setOverdue(dashboardStats.overdueInvoices);
      setMonthlyRevenue(dashboardStats.monthlyRevenue);
      setPaidInvoicesThisMonth(dashboardStats.paidInvoicesThisMonth);
      setNewClinicsThisMonth(dashboardStats.newClinicsThisMonth);

      const mapped: ClinicDetail[] = dashboardStats.clinics.map((c) => {
        const config = (c.config ?? {}) as ClinicConfigJson;
        return {
          id: c.id,
          name: c.name,
          type: c.type as "doctor" | "dentist" | "pharmacy",
          plan: (c.tier as string) ?? "pro",
          city: config.city ?? "",
          status: (c.status === "inactive" ? "suspended" : (c.status ?? "active")) as
            | "active"
            | "suspended"
            | "trial",
        };
      });
      setClinicList(mapped);
      setAnnouncementList(announcements);
      setActivityLogList(logs);
      setLastUpdated(new Date());
    } catch (err) {
      logger.warn("Failed to load super-admin dashboard", { context: "page", error: err });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    mountedRef.current = true;

    timeouts.push(
      setTimeout(() => {
        loadStats();
      }, 0),
    );

    const interval = setInterval(() => {
      loadStats(true);
    }, AUTO_REFRESH_INTERVAL);

    return () => {
      timeouts.forEach((t) => clearTimeout(t));

      (() => {
        mountedRef.current = false;
        clearInterval(interval);
      })();
    };
  }, [loadStats]);

  const activeAnnouncements = announcementList.filter((a) => a.active);
  const recentLogs = activityLogList.slice(0, 8);

  const activePercent = totalClinics > 0 ? Math.round((activeClinics / totalClinics) * 100) : 0;

  function handleDownloadReport() {
    const rows = clinicList.map((c) => ({
      Clinic: c.name,
      Type: c.type,
      Plan: c.plan,
      City: c.city,
      Status: c.status,
    }));
    const kpiRow = {
      Clinic: `--- KPIs: Total Clinics: ${totalClinics}, Active: ${activeClinics}, Users: ${totalPatients}, Revenue: ${formatCurrency(totalRevenue)} ---`,
      Type: "",
      Plan: "",
      City: "",
      Status: "",
    };
    exportToPDF(
      t(locale, "superAdmin.reportTitle"),
      [kpiRow, ...rows],
      ["Clinique", "Type", "Plan", "Ville", "Statut"],
    );
    addToast(t(locale, "superAdmin.reportGenerated"), "success");
  }

  const stats = [
    {
      icon: Building2,
      label: t(locale, "superAdmin.totalClinics"),
      value: totalClinics.toString(),
      change: `${activeClinics} ${t(locale, "superAdmin.active")}`,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-900/30",
      trend: t(locale, "superAdmin.trendNewThisMonth", { count: newClinicsThisMonth }),
      trendDirection: newClinicsThisMonth > 0 ? ("up" as const) : ("neutral" as const),
    },
    {
      icon: Building2,
      label: t(locale, "superAdmin.activeClinics"),
      value: activeClinics.toString(),
      change: `${totalClinics - activeClinics} ${t(locale, "superAdmin.inactive")}`,
      color: "text-green-600 dark:text-green-400",
      bg: "bg-green-50 dark:bg-green-900/30",
      trend: t(locale, "superAdmin.percentActive", { percent: activePercent }),
      trendDirection: "neutral" as const,
    },
    {
      icon: Users,
      label: t(locale, "superAdmin.platformUsers"),
      value: totalPatients > 0 ? `${totalPatients.toLocaleString()}+` : "0",
      change: t(locale, "superAdmin.registeredAccounts"),
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-50 dark:bg-purple-900/30",
      trend: null as string | null,
      trendDirection: null as string | null,
    },
    {
      icon: TrendingUp,
      label: t(locale, "superAdmin.monthlyRevenue"),
      value: `${formatCurrency(monthlyRevenue)}`,
      change: t(locale, "superAdmin.fromPayments"),
      color: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-50 dark:bg-orange-900/30",
      trend:
        monthlyRevenue > 0
          ? t(locale, "superAdmin.revenueTrendingUp")
          : t(locale, "superAdmin.noRevenueYet"),
      trendDirection: monthlyRevenue > 0 ? ("up" as const) : ("neutral" as const),
    },
  ];

  const financialStats = [
    {
      label: t(locale, "superAdmin.mrr"),
      value: `${formatCurrency(mrr)}`,
      icon: CreditCard,
      color: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: t(locale, "superAdmin.overdue"),
      value: overdue.toString(),
      icon: Clock,
      color: "text-red-500 dark:text-red-400",
    },
    {
      label: t(locale, "superAdmin.paidThisMonth"),
      value: paidInvoicesThisMonth.toString(),
      icon: TrendingUp,
      color: "text-blue-600 dark:text-blue-400",
    },
  ];

  return (
    <div>
      <OpsSummaryStrip />
      <Breadcrumb items={[{ label: "Super Admin" }, { label: t(locale, "nav.dashboard") }]} />
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold">{t(locale, "dashboard.superAdmin")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t(locale, "dashboard.superAdminDesc")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => loadStats(true)} disabled={refreshing}>
            {refreshing ? (
              <Loader2 className="h-4 w-4 me-1 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 me-1" />
            )}
            {t(locale, "superAdmin.refresh")}
          </Button>
          <Button variant="outline" size="sm" disabled={loading} onClick={handleDownloadReport}>
            <Download className="h-4 w-4 me-1" />
            {t(locale, "superAdmin.downloadReport")}
          </Button>
          <Link href="/super-admin/onboarding">
            <Button size="sm">
              <UserPlus className="h-4 w-4 me-1" />
              {t(locale, "superAdmin.newClinic")}
            </Button>
          </Link>
          <Link href="/super-admin/announcements">
            <Button variant="outline" size="sm">
              <Megaphone className="h-4 w-4 me-1" />
              {t(locale, "superAdmin.announce")}
            </Button>
          </Link>
          {/* Optional 2FA: enrolment is no longer forced at login — admins can
              enable two-factor authentication from here at any time. */}
          <Link href="/setup-2fa?next=%2Fsuper-admin%2Fdashboard">
            <Button variant="outline" size="sm">
              <ShieldCheck className="h-4 w-4 me-1" />
              Sécurité (2FA)
            </Button>
          </Link>
        </div>
      </div>
      <div className="flex items-center gap-2 mb-6 text-xs text-muted-foreground">
        {lastUpdated && (
          <span>
            {t(locale, "superAdmin.lastUpdated", { time: lastUpdated.toLocaleTimeString() })}
          </span>
        )}
        {refreshing && (
          <span className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t(locale, "superAdmin.refreshing")}
          </span>
        )}
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
      {!loading && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
            {stats.map((stat) => (
              <Card key={stat.label}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.bg}`}
                    >
                      <stat.icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-2xl font-bold transition-all duration-300">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{stat.change}</p>
                  {stat.trend && (
                    <div className="flex items-center gap-1 mt-1">
                      {stat.trendDirection === "up" ? (
                        <ArrowUp className="h-3 w-3 text-green-600 dark:text-green-400" />
                      ) : stat.trendDirection === "down" ? (
                        <ArrowDown className="h-3 w-3 text-red-500 dark:text-red-400" />
                      ) : (
                        <Percent className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span
                        className={`text-[10px] ${
                          stat.trendDirection === "up"
                            ? "text-green-600 dark:text-green-400"
                            : stat.trendDirection === "down"
                              ? "text-red-500 dark:text-red-400"
                              : "text-muted-foreground"
                        }`}
                      >
                        {stat.trend}
                      </span>
                    </div>
                  )}
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

          {/* Compliance + System snapshot */}
          <div className="mb-6 max-w-xs">
            <ComplianceWidget />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Clinics Overview */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {t(locale, "superAdmin.clinicsOverview")}
                  </CardTitle>
                  <Link href="/super-admin/clinics">
                    <Button variant="ghost" size="sm" className="text-xs">
                      {t(locale, "superAdmin.viewAll")}
                      <ArrowUpRight className="h-3 w-3 ms-1" />
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
                      <div className="flex items-center gap-2 ms-2">
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
                      {t(locale, "superAdmin.activeAnnouncements")}
                    </CardTitle>
                    <Link href="/super-admin/announcements">
                      <Button variant="ghost" size="sm" className="text-xs">
                        {t(locale, "superAdmin.manage")}
                        <ArrowUpRight className="h-3 w-3 ms-1" />
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
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      {t(locale, "superAdmin.recentActivity")}
                    </CardTitle>
                    <Link href="/super-admin/clinics">
                      <Button variant="ghost" size="sm" className="text-xs">
                        {t(locale, "superAdmin.viewAll")}
                        <ArrowUpRight className="h-3 w-3 ms-1" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recentLogs.length === 0 && clinicList.length > 0 && (
                      <>
                        {clinicList.slice(0, 5).map((clinic) => (
                          <div key={`fallback-${clinic.id}`} className="flex items-start gap-3">
                            <div className="mt-0.5 h-2 w-2 rounded-full bg-blue-600" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">
                                {t(locale, "superAdmin.clinicRegistered")}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {clinic.name} ({clinic.type})
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {t(locale, "superAdmin.statusLabel", { status: clinic.status })}{" "}
                                &middot; {t(locale, "superAdmin.planLabel", { plan: clinic.plan })}
                              </p>
                            </div>
                            <Badge
                              variant={clinic.status === "active" ? "success" : "warning"}
                              className="text-[10px]"
                            >
                              {clinic.status}
                            </Badge>
                          </div>
                        ))}
                      </>
                    )}
                    {recentLogs.length === 0 && clinicList.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        {t(locale, "superAdmin.noRecentActivity")}
                      </p>
                    )}
                    {recentLogs.map((log) => (
                      <div key={log.id} className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 h-2 w-2 rounded-full ${(activityTypeIcons[log.type] ?? "text-gray-600").replace("text-", "bg-")}`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{log.action}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {log.description}
                          </p>
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

            {/* AI Clinic Briefings Widget */}
            <ClinicBriefingWidget />
          </div>
        </>
      )}
    </div>
  );
}
