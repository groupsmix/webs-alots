"use client";

import {
  Building2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  DollarSign,
  Users,
  Calendar,
  Activity,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/loading-skeleton";
import { formatCurrency } from "@/lib/utils";

interface ClinicAnalytics {
  clinicId: string;
  clinicName: string;
  clinicType: string;
  tier: string;
  status: string;
  subdomain: string | null;
  totalRevenue: number;
  recentRevenue: number;
  totalAppointments: number;
  recentAppointments: number;
  appointmentTrend: number;
  totalPatients: number;
  churnRisk: "low" | "medium" | "high";
}

interface AnalyticsSummary {
  totalClinics: number;
  activeClinics: number;
  totalRevenue: number;
  totalRecentRevenue: number;
  highChurnRisk: number;
  mediumChurnRisk: number;
}

interface AnalyticsData {
  summary: AnalyticsSummary;
  clinics: ClinicAnalytics[];
}

interface RateLimitStatus {
  limit: string | null;
  remaining: string | null;
  reset: string | null;
}

export default function MultiClinicAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [rateLimit, setRateLimit] = useState<RateLimitStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"revenue" | "appointments" | "churn">("revenue");

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/analytics/multi-clinic");
      setRateLimit({
        limit: res.headers.get("X-RateLimit-Limit"),
        remaining: res.headers.get("X-RateLimit-Remaining"),
        reset: res.headers.get("X-RateLimit-Reset"),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Failed to load analytics");
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    timeouts.push(
      setTimeout(() => {
        fetchAnalytics();
      }, 0),
    );

    return () => {
      timeouts.forEach((t) => clearTimeout(t));
    };
  }, [fetchAnalytics]);

  const sortedClinics = data?.clinics
    ? [...data.clinics].sort((a, b) => {
        if (sortBy === "revenue") return b.recentRevenue - a.recentRevenue;
        if (sortBy === "appointments") return b.recentAppointments - a.recentAppointments;
        const riskOrder = { high: 0, medium: 1, low: 2 };
        return riskOrder[a.churnRisk] - riskOrder[b.churnRisk];
      })
    : [];

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Breadcrumb items={[{ label: "Super Admin" }, { label: "Analytics" }]} />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Breadcrumb items={[{ label: "Super Admin" }, { label: "Analytics" }]} />
        <Card className="mt-4">
          <CardContent className="p-6 text-center text-red-600">{error}</CardContent>
        </Card>
      </div>
    );
  }

  const summary = data?.summary;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumb items={[{ label: "Super Admin" }, { label: "Multi-Clinic Analytics" }]} />
        {rateLimit?.remaining && rateLimit.limit && (
          <Badge variant="outline">
            {rateLimit.remaining}/{rateLimit.limit} requests
          </Badge>
        )}
      </div>

      <div>
        <h1 className="text-2xl font-bold">Multi-Clinic Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Revenue, appointments, and churn risk across all clinics
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clinics</CardTitle>
            <Building2 className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalClinics ?? 0}</div>
            <p className="text-muted-foreground text-xs">{summary?.activeClinics ?? 0} active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary?.totalRevenue ?? 0)}</div>
            <p className="text-muted-foreground text-xs">
              {formatCurrency(summary?.totalRecentRevenue ?? 0)} last 30 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Churn Risk</CardTitle>
            <AlertTriangle className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{summary?.highChurnRisk ?? 0}</div>
            <p className="text-muted-foreground text-xs">
              {summary?.mediumChurnRisk ?? 0} medium risk
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue/Clinic (avg)</CardTitle>
            <Activity className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(
                summary && summary.activeClinics > 0
                  ? Math.round(summary.totalRecentRevenue / summary.activeClinics)
                  : 0,
              )}
            </div>
            <p className="text-muted-foreground text-xs">last 30 days per active clinic</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Clinic Performance</CardTitle>
            <div className="flex gap-2">
              <button
                onClick={() => setSortBy("revenue")}
                className={`rounded px-3 py-1 text-xs ${sortBy === "revenue" ? "bg-primary text-white" : "bg-muted"}`}
              >
                Revenue
              </button>
              <button
                onClick={() => setSortBy("appointments")}
                className={`rounded px-3 py-1 text-xs ${sortBy === "appointments" ? "bg-primary text-white" : "bg-muted"}`}
              >
                Appointments
              </button>
              <button
                onClick={() => setSortBy("churn")}
                className={`rounded px-3 py-1 text-xs ${sortBy === "churn" ? "bg-primary text-white" : "bg-muted"}`}
              >
                Churn Risk
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sortedClinics.map((clinic) => (
              <div
                key={clinic.clinicId}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex items-center gap-4">
                  <Building2 className="text-muted-foreground h-8 w-8" />
                  <div>
                    <p className="font-medium">{clinic.clinicName}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span>{clinic.clinicType}</span>
                      <span>·</span>
                      <span>{clinic.tier}</span>
                      {clinic.subdomain && (
                        <>
                          <span>·</span>
                          <span>{clinic.subdomain}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      <span className="text-sm font-medium">
                        {formatCurrency(clinic.recentRevenue)}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-xs">30d revenue</p>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span className="text-sm font-medium">{clinic.recentAppointments}</span>
                    </div>
                    <p className="text-muted-foreground text-xs">30d appts</p>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      <span className="text-sm font-medium">{clinic.totalPatients}</span>
                    </div>
                    <p className="text-muted-foreground text-xs">patients</p>
                  </div>

                  <div className="flex items-center gap-1">
                    {clinic.appointmentTrend >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                    <span
                      className={`text-sm ${clinic.appointmentTrend >= 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      {clinic.appointmentTrend > 0 ? "+" : ""}
                      {clinic.appointmentTrend}%
                    </span>
                  </div>

                  <Badge
                    variant={
                      clinic.churnRisk === "high"
                        ? "destructive"
                        : clinic.churnRisk === "medium"
                          ? "warning"
                          : "default"
                    }
                  >
                    {clinic.churnRisk} risk
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
