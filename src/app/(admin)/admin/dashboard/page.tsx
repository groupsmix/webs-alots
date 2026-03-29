"use client";

import { useEffect, useState } from "react";
import { Users, Calendar, CreditCard, Star, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getCurrentUser,
  fetchDashboardStats,
  type DashboardStats,
} from "@/lib/data/client";
import { LabDashboardKPIsComponent } from "@/components/admin/lab-dashboard-kpis";
import { ClinicCenterDashboardKPIsComponent } from "@/components/admin/clinic-center-dashboard-kpis";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { PageLoader } from "@/components/ui/page-loader";
import { useLocale } from "@/components/locale-switcher";
import { t } from "@/lib/i18n";

const activityVariant: Record<string, "default" | "success" | "warning" | "destructive"> = {
  booking: "default",
  payment: "success",
  review: "warning",
  cancel: "destructive",
};

export default function AdminDashboardPage() {
  const [locale] = useLocale();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
    const user = await getCurrentUser();
      if (controller.signal.aborted) return;
    if (!user?.clinic_id) { setLoading(false); return; }
    const s = await fetchDashboardStats(user.clinic_id);
      if (controller.signal.aborted) return;
    setStats(s);
    setLoading(false);
  }
    load().catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    });
    return () => { controller.abort(); };
  }, []);

  if (loading) {
    return <PageLoader message={t(locale, "dashboard.loading")} />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">{t(locale, "error.loadFailed")}</p>
        <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
      </div>
    );
  }

  const totalPatients = stats?.totalPatients ?? 0;
  const totalAppts = stats?.totalAppointments ?? 0;
  const completedAppts = stats?.completedAppointments ?? 0;
  const noShowRate = totalAppts > 0 ? Math.round((stats?.noShowCount ?? 0) / totalAppts * 100) : 0;
  const totalRevenue = stats?.totalRevenue ?? 0;
  const avgRating = stats?.averageRating ?? 0;
  const doctorCount = stats?.doctorCount ?? 0;
  const insurancePatients = stats?.insurancePatients ?? 0;

  const statCards = [
    { icon: Users, label: t(locale, "admin.totalPatients"), value: totalPatients.toString(), color: "text-blue-600" },
    { icon: Calendar, label: t(locale, "admin.totalAppointments"), value: totalAppts.toString(), color: "text-green-600" },
    { icon: CreditCard, label: t(locale, "admin.monthlyRevenue"), value: `${totalRevenue} MAD`, color: "text-purple-600" },
    { icon: Star, label: t(locale, "admin.averageRating"), value: avgRating.toFixed(1), color: "text-yellow-600" },
  ];

  const recentActivity: { type: string; message: string; time: string }[] = [];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t(locale, "dashboard.admin")}</h1>

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
              <p className="text-sm text-muted-foreground text-center py-4">{t(locale, "admin.noRecentActivity")}</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((activity, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <Badge variant={activityVariant[activity.type]} className="text-[10px] w-16 justify-center">
                      {activity.type}
                    </Badge>
                    <p className="flex-1 text-sm">{activity.message}</p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{activity.time}</span>
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
                <span className="text-muted-foreground">{t(locale, "admin.insurancePatients")}</span>
                <span className="font-medium">{insurancePatients}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      {/* Lab Dashboard KPIs (Task 36) */}
      <div className="mt-8">
        <ErrorBoundary section="Lab KPIs" compact>
          <LabDashboardKPIsComponent />
        </ErrorBoundary>
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
