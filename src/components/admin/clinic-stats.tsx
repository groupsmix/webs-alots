"use client";

import { useState, useEffect } from "react";
import { Users, Calendar, TrendingDown, DollarSign, Activity, Clock, UserCheck, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchDashboardStats, fetchTodayAppointments, type DashboardStats } from "@/lib/data/client";
import { useTenant } from "@/components/tenant-provider";
import { logger } from "@/lib/logger";

/**
 * ClinicStats
 *
 * Key metrics cards: patient count, no-show rate, booking sources, busiest hours.
 */
export function ClinicStats() {
  const [dashData, setDashData] = useState<DashboardStats | null>(null);
  const [todayCount, setTodayCount] = useState(0);
  const tenant = useTenant();

  useEffect(() => {
    const clinicId = tenant?.clinicId;
    if (!clinicId) return;

    let cancelled = false;
    Promise.all([
      fetchDashboardStats(clinicId),
      fetchTodayAppointments(clinicId),
    ]).then(([dashStats, todayAppts]) => {
      if (cancelled) return;
      setDashData(dashStats);
      setTodayCount(todayAppts.length);
    }).catch((err) => {
      logger.warn("Operation failed", { context: "clinic-stats", error: err });
    });
    return () => { cancelled = true; };
  }, [tenant?.clinicId]);

  const totalPatients = dashData?.totalPatients ?? 0;
  const completedAppts = dashData?.completedAppointments ?? 0;
  const noShowRate = dashData && dashData.totalAppointments > 0
    ? Math.round((dashData.noShowCount / dashData.totalAppointments) * 100)
    : 0;
  const revenue = dashData?.totalRevenue ?? 0;

  const stats = [
    { title: "Total Patients", value: totalPatients.toString(), icon: Users, change: "+12%", trend: "up" as const },
    { title: "Today's Bookings", value: todayCount.toString(), icon: Calendar, change: `${completedAppts} completed`, trend: "neutral" as const },
    { title: "No-Show Rate", value: `${noShowRate}%`, icon: TrendingDown, change: noShowRate > 10 ? "High" : "Normal", trend: noShowRate > 10 ? ("down" as const) : ("up" as const) },
    { title: "Revenue (MTD)", value: `${revenue.toLocaleString()} MAD`, icon: DollarSign, change: "+8%", trend: "up" as const },
  ];

  const bookingSources = [
    { source: "Online", count: 45, percentage: 56 },
    { source: "Phone", count: 22, percentage: 28 },
    { source: "Walk-in", count: 13, percentage: 16 },
  ];

  const busiestHours = [
    { hour: "09:00-10:00", count: 18 },
    { hour: "10:00-11:00", count: 24 },
    { hour: "11:00-12:00", count: 15 },
    { hour: "14:00-15:00", count: 20 },
    { hour: "15:00-16:00", count: 16 },
    { hour: "16:00-17:00", count: 10 },
  ];

  const maxCount = Math.max(...busiestHours.map((h) => h.count));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                  <Badge
                    variant={stat.trend === "up" ? "default" : stat.trend === "down" ? "destructive" : "secondary"}
                    className="text-xs mt-1"
                  >
                    {stat.change}
                  </Badge>
                </div>
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Booking Sources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {bookingSources.map((source) => (
                <div key={source.source}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>{source.source}</span>
                    <span className="text-muted-foreground">{source.count} ({source.percentage}%)</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${source.percentage}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Busiest Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {busiestHours.map((hour) => (
                <div key={hour.hour} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-24">{hour.hour}</span>
                  <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary/60 rounded-full transition-all" style={{ width: `${(hour.count / maxCount) * 100}%` }} />
                  </div>
                  <span className="text-xs font-medium w-6 text-right">{hour.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Active Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-sm p-2 rounded-lg bg-yellow-50 dark:bg-yellow-950/20">
              <Activity className="h-4 w-4 text-yellow-600" />
              <span>3 patients waiting for more than 30 minutes</span>
            </div>
            <div className="flex items-center gap-3 text-sm p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20">
              <Calendar className="h-4 w-4 text-blue-600" />
              <span>2 appointment slots remaining today</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
