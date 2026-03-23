"use client";

import { useState, useEffect } from "react";
import {
  BedDouble,
  UserPlus,
  UserMinus,
  Building2,
  DollarSign,
  Activity,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  fetchClinicCenterDashboardKPIs,
  type ClinicCenterDashboardKPIs,
} from "@/lib/data/client";
import { clinicConfig } from "@/config/clinic.config";
import { PageLoader } from "@/components/ui/page-loader";

/**
 * ClinicCenterDashboardKPIs
 *
 * Task 37 — Clinic/Center Dashboard KPIs:
 *  - Bed occupancy rate
 *  - Admissions / discharges today
 *  - Department-wise patient load
 *  - Revenue by department
 */
export function ClinicCenterDashboardKPIsComponent() {
  const [data, setData] = useState<ClinicCenterDashboardKPIs | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const clinicId = clinicConfig.clinicId;
    let cancelled = false;
    if (!clinicId) {
      Promise.resolve().then(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }
    fetchClinicCenterDashboardKPIs(clinicId)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => { void err; })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <PageLoader message="Loading clinic/center KPIs..." />;
  }

  const totalBeds = data?.totalBeds ?? 0;
  const occupiedBeds = data?.occupiedBeds ?? 0;
  const occupancyRate = data?.bedOccupancyRate ?? 0;
  const admissionsToday = data?.admissionsToday ?? 0;
  const dischargesToday = data?.dischargesToday ?? 0;
  const departmentLoad = data?.departmentPatientLoad ?? [];
  const departmentRevenue = data?.departmentRevenue ?? [];

  const stats = [
    {
      title: "Bed Occupancy",
      value: `${occupancyRate}%`,
      subtitle: `${occupiedBeds} / ${totalBeds} beds`,
      icon: BedDouble,
      badge: occupancyRate > 85 ? "Critical" : occupancyRate > 70 ? "High" : "Normal",
      trend: occupancyRate > 85 ? ("down" as const) : ("up" as const),
    },
    {
      title: "Admissions Today",
      value: admissionsToday.toString(),
      subtitle: "New patients admitted",
      icon: UserPlus,
      badge: admissionsToday > 0 ? "Active" : "None",
      trend: "up" as const,
    },
    {
      title: "Discharges Today",
      value: dischargesToday.toString(),
      subtitle: "Patients discharged",
      icon: UserMinus,
      badge: dischargesToday > 0 ? "Active" : "None",
      trend: "up" as const,
    },
    {
      title: "Departments",
      value: departmentLoad.length.toString(),
      subtitle: "Active departments",
      icon: Building2,
      badge: "Active",
      trend: "up" as const,
    },
  ];

  const totalDeptRevenue = departmentRevenue.reduce((sum, d) => sum + d.revenue, 0);
  const maxDeptRevenue = Math.max(...departmentRevenue.map((d) => d.revenue), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Building2 className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Clinic / Center Dashboard</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
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

      {/* Bed Occupancy Visual */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BedDouble className="h-4 w-4" />
            Bed Occupancy Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1">
              <div className="h-4 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    occupancyRate > 85
                      ? "bg-red-500"
                      : occupancyRate > 70
                        ? "bg-amber-500"
                        : "bg-green-500"
                  }`}
                  style={{ width: `${occupancyRate}%` }}
                />
              </div>
            </div>
            <span className="text-sm font-medium w-16 text-right">{occupancyRate}%</span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 border rounded-lg">
              <p className="text-lg font-bold text-green-600">{totalBeds - occupiedBeds}</p>
              <p className="text-xs text-muted-foreground">Available</p>
            </div>
            <div className="p-3 border rounded-lg">
              <p className="text-lg font-bold text-blue-600">{occupiedBeds}</p>
              <p className="text-xs text-muted-foreground">Occupied</p>
            </div>
            <div className="p-3 border rounded-lg">
              <p className="text-lg font-bold">{totalBeds}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Department-wise Patient Load */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Department Patient Load
            </CardTitle>
          </CardHeader>
          <CardContent>
            {departmentLoad.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No departments configured</p>
            ) : (
              <div className="space-y-3">
                {departmentLoad.map((dept) => (
                  <div key={dept.departmentId}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium">{dept.departmentName}</span>
                      <span className="text-muted-foreground">
                        {dept.occupiedBeds}/{dept.totalBeds} beds
                        {dept.activeAdmissions > 0 && (
                          <span className="ml-1">({dept.activeAdmissions} admitted)</span>
                        )}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          dept.occupancyRate > 85
                            ? "bg-red-500"
                            : dept.occupancyRate > 70
                              ? "bg-amber-500"
                              : "bg-green-500"
                        }`}
                        style={{ width: `${dept.occupancyRate}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-muted-foreground">{dept.occupancyRate}% occupancy</span>
                      {dept.occupancyRate > 85 && (
                        <Badge variant="destructive" className="text-[10px]">Critical</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revenue by Department */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Revenue by Department
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                Total: {totalDeptRevenue.toLocaleString()} MAD
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {departmentRevenue.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No revenue data</p>
            ) : (
              <div className="space-y-3">
                {departmentRevenue.map((dept) => (
                  <div key={dept.departmentId}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>{dept.departmentName}</span>
                      <span className="font-medium">{dept.revenue.toLocaleString()} MAD</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${(dept.revenue / maxDeptRevenue) * 100}%` }}
                        />
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {dept.paymentCount} cases
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Admissions & Discharges Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Today&apos;s Admissions &amp; Discharges
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
              <UserPlus className="h-6 w-6 text-blue-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-blue-600">{admissionsToday}</p>
              <p className="text-xs text-muted-foreground">Admissions Today</p>
            </div>
            <div className="text-center p-4 border rounded-lg bg-green-50 dark:bg-green-950/20">
              <UserMinus className="h-6 w-6 text-green-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-green-600">{dischargesToday}</p>
              <p className="text-xs text-muted-foreground">Discharges Today</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
