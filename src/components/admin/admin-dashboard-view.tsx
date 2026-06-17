"use client";

import { Users, Calendar, CreditCard, Star, Activity, MessageSquare } from "lucide-react";
import Link from "next/link";
import { ClinicCenterDashboardKPIsComponent } from "@/components/admin/clinic-center-dashboard-kpis";
import { SetupChecklistWidget } from "@/components/admin/setup-checklist-widget";
import { UsageWidget } from "@/components/admin/usage-widget";
import { useLocale } from "@/components/locale-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import type { DashboardStats, RecentActivityItem } from "@/lib/data/dashboard";
import { t } from "@/lib/i18n";
import { formatCurrency, formatDisplayDate } from "@/lib/utils";

const activityVariant: Record<string, "default" | "success" | "warning" | "destructive"> = {
  booking: "default",
  payment: "success",
  review: "warning",
  cancel: "destructive",
  admin: "default",
  auth: "default",
  security: "destructive",
  patient: "default",
  config: "warning",
};

interface AdminDashboardViewProps {
  stats: DashboardStats;
}

export function AdminDashboardView({ stats }: AdminDashboardViewProps) {
  const [locale] = useLocale();

  const totalPatients = stats.totalPatients;
  const totalAppts = stats.totalAppointments;
  const completedAppts = stats.completedAppointments;
  const noShowRate = totalAppts > 0 ? Math.round((stats.noShowCount / totalAppts) * 100) : 0;
  const totalRevenue = stats.totalRevenue;
  const avgRating = stats.averageRating;
  const doctorCount = stats.doctorCount;
  const insurancePatients = stats.insurancePatients;

  const statCards = [
    {
      icon: Users,
      label: t(locale, "admin.totalPatients"),
      value: totalPatients.toString(),
      color: "text-[var(--oltigo-green)]",
    },
    {
      icon: Calendar,
      label: t(locale, "admin.totalAppointments"),
      value: totalAppts.toString(),
      color: "text-[var(--ink-70)]",
    },
    {
      icon: CreditCard,
      label: t(locale, "admin.monthlyRevenue"),
      value: `${formatCurrency(totalRevenue)}`,
      color: "text-[var(--signal-green)]",
    },
    {
      icon: Star,
      label: t(locale, "admin.averageRating"),
      value: avgRating.toFixed(1),
      color: "text-[var(--signal-amber)]",
    },
  ];

  const recentActivity: RecentActivityItem[] = stats.recentActivity;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t(locale, "dashboard.admin")}</h1>
        <Link href="/admin/notifications">
          <Button variant="outline" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Notification Status
          </Button>
        </Link>
      </div>

      <SetupChecklistWidget stats={stats} />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              {t(locale, "admin.recentActivity")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <EmptyState
                icon={Activity}
                title={t(locale, "admin.noRecentActivity")}
                className="py-4"
              />
            ) : (
              <div className="space-y-3">
                {recentActivity.map((activity, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <Badge
                      variant={activityVariant[activity.type]}
                      className="text-[10px] w-16 justify-center"
                    >
                      {activity.type}
                    </Badge>
                    <p className="flex-1 text-sm">{activity.message}</p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDisplayDate(activity.time, locale, "relative")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t(locale, "admin.quickStats")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t(locale, "admin.activeDoctors")}</span>
                <span className="font-medium">{doctorCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t(locale, "admin.completedAppts")}</span>
                <span className="font-medium">{completedAppts}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t(locale, "admin.noShowRate")}</span>
                <span className="font-medium">{noShowRate}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t(locale, "admin.avgRating")}</span>
                <span className="font-medium">{avgRating.toFixed(1)} / 5</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {t(locale, "admin.insurancePatients")}
                </span>
                <span className="font-medium">{insurancePatients}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      {/* Usage & Plan Widget */}
      <div className="mt-6">
        <UsageWidget />
      </div>

      {/* Clinic/Center Dashboard KPIs (Task 37) */}
      <div className="mt-8">
        <ErrorBoundary section="Clinic KPIs" compact>
          <ClinicCenterDashboardKPIsComponent />
        </ErrorBoundary>
      </div>
    </div>
  );
}
