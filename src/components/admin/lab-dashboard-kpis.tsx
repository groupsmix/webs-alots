"use client";

import { useState, useEffect } from "react";
import {
  FlaskConical,
  Clock,
  CheckCircle2,
  AlertCircle,
  Timer,
  CalendarCheck,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchLabDashboardKPIs, type LabDashboardKPIs } from "@/lib/data/client";
import { clinicConfig } from "@/config/clinic.config";
import { PageLoader } from "@/components/ui/page-loader";
import { logger } from "@/lib/logger";

/**
 * LabDashboardKPIs
 *
 * Task 36 — Lab Dashboard KPIs:
 *  - Pending test orders
 *  - Results awaiting validation
 *  - Tests completed today / this week
 *  - Average turnaround time
 */
export function LabDashboardKPIsComponent() {
  const [data, setData] = useState<LabDashboardKPIs | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const clinicId = clinicConfig.clinicId;
    let cancelled = false;
    if (!clinicId) {
      Promise.resolve().then(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }
    fetchLabDashboardKPIs(clinicId)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => { logger.warn("Operation failed", { context: "lab-dashboard-kpis", error: err }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <PageLoader message="Loading lab KPIs..." />;
  }

  const pending = data?.pendingTestOrders ?? 0;
  const awaiting = data?.awaitingValidation ?? 0;
  const completedToday = data?.completedToday ?? 0;
  const completedWeek = data?.completedThisWeek ?? 0;
  const avgTurnaround = data?.averageTurnaroundHours ?? 0;
  const recentTests = data?.recentTests ?? [];

  const stats = [
    {
      title: "Pending Orders",
      value: pending.toString(),
      icon: FlaskConical,
      badge: pending > 5 ? "High" : "Normal",
      trend: pending > 5 ? ("down" as const) : ("up" as const),
    },
    {
      title: "Awaiting Validation",
      value: awaiting.toString(),
      icon: AlertCircle,
      badge: awaiting > 3 ? "Attention" : "OK",
      trend: awaiting > 3 ? ("down" as const) : ("up" as const),
    },
    {
      title: "Completed Today",
      value: completedToday.toString(),
      icon: CheckCircle2,
      badge: `${completedWeek} this week`,
      trend: "up" as const,
    },
    {
      title: "Avg Turnaround",
      value: `${avgTurnaround}h`,
      icon: Timer,
      badge: avgTurnaround > 24 ? "Slow" : "Good",
      trend: avgTurnaround > 24 ? ("down" as const) : ("up" as const),
    },
  ];

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    awaiting_validation: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    validated: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };

  const priorityColors: Record<string, string> = {
    normal: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    urgent: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    stat: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <FlaskConical className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Lab Dashboard</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                  <Badge
                    variant={stat.trend === "up" ? "default" : "destructive"}
                    className="text-xs mt-1"
                  >
                    {stat.badge}
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
              <CalendarCheck className="h-4 w-4" />
              Completion Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>Tests Completed Today</span>
                <span className="font-medium">{completedToday}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${Math.min((completedToday / Math.max(completedWeek, 1)) * 100, 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Tests Completed This Week</span>
                <span className="font-medium">{completedWeek}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: "100%" }} />
              </div>
              <div className="flex items-center justify-between text-sm mt-2 pt-2 border-t">
                <span className="text-muted-foreground">Average Turnaround Time</span>
                <span className="font-bold">{avgTurnaround} hours</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Status Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { label: "Pending", count: pending, color: "bg-yellow-500" },
                { label: "Awaiting Validation", count: awaiting, color: "bg-orange-500" },
                { label: "Completed Today", count: completedToday, color: "bg-green-500" },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>{item.label}</span>
                    <span className="text-muted-foreground">{item.count}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.color} rounded-full transition-all`}
                      style={{ width: `${Math.min((item.count / Math.max(pending + awaiting + completedToday, 1)) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {recentTests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Recent Lab Tests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium text-muted-foreground">Test</th>
                    <th className="text-left py-2 font-medium text-muted-foreground">Patient</th>
                    <th className="text-left py-2 font-medium text-muted-foreground">Doctor</th>
                    <th className="text-left py-2 font-medium text-muted-foreground">Priority</th>
                    <th className="text-left py-2 font-medium text-muted-foreground">Status</th>
                    <th className="text-right py-2 font-medium text-muted-foreground">Turnaround</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTests.map((test) => (
                    <tr key={test.id} className="border-b last:border-0">
                      <td className="py-2">
                        <div>
                          <span className="font-medium">{test.testName}</span>
                          <span className="text-xs text-muted-foreground ml-1">({test.testCategory})</span>
                        </div>
                      </td>
                      <td className="py-2">{test.patientName}</td>
                      <td className="py-2">{test.doctorName}</td>
                      <td className="py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${priorityColors[test.priority] ?? priorityColors.normal}`}>
                          {test.priority}
                        </span>
                      </td>
                      <td className="py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[test.status] ?? ""}`}>
                          {test.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        {test.turnaroundHours !== null ? `${test.turnaroundHours}h` : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
