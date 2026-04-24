"use client";

import {
  Users, TrendingUp, Calendar, XCircle, Globe, Footprints,
  Star, Clock, RefreshCw, BarChart3, Download,
} from "lucide-react";
import { useState, useEffect } from "react";
/**
 * Audit 5.2 — recharts is code-split because the pages that consume this
 * component (admin/reports/page.tsx and doctor/analytics/page.tsx) load it
 * via next/dynamic. This keeps the ~200 KB recharts + D3 bundle out of
 * the initial page load — it is only fetched when the user navigates to
 * the analytics/reports route.
 */
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/page-loader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  getCurrentUser,
  fetchAnalytics,
  type AnalyticsData,
  type AnalyticsPeriod,
} from "@/lib/data/client";
import { exportToCSV } from "@/lib/export-data";

const COLORS = [
  "#2563eb", "#7c3aed", "#db2777", "#ea580c",
  "#16a34a", "#0891b2", "#ca8a04", "#dc2626", "#4f46e5",
];

const PERIOD_LABELS: Record<AnalyticsPeriod, string> = {
  week: "This Week",
  month: "This Month",
  quarter: "This Quarter",
  year: "This Year",
};

function ChangeIndicator({ value, inverted = false }: { value: number; inverted?: boolean }) {
  const isPositive = inverted ? value < 0 : value > 0;
  const isNegative = inverted ? value > 0 : value < 0;
  return (
    <Badge
      variant="outline"
      className={`text-xs ${
        isPositive ? "text-green-600 border-green-200" : isNegative ? "text-red-600 border-red-200" : ""
      }`}
    >
      {value > 0 ? "+" : ""}{value}%
    </Badge>
  );
}

export function AnalyticsDashboard({ role = "admin" }: { role?: "admin" | "doctor" }) {
  const [revenuePeriod, setRevenuePeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const [timePeriod, setTimePeriod] = useState<AnalyticsPeriod>("month");
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
    setLoading(true);
    const user = await getCurrentUser();
      if (controller.signal.aborted) return;
    if (!user?.clinic_id) { setLoading(false); return; }
    const data = await fetchAnalytics(user.clinic_id, timePeriod);
      if (controller.signal.aborted) return;
    setAnalytics(data);
    setLoading(false);
  }
    load().catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    });
    return () => { controller.abort(); };
  }, [timePeriod]);

  if (loading) {
    return <PageLoader message="Loading analytics..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">Failed to load data. Please try refreshing the page.</p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">No analytics data available.</p>
      </div>
    );
  }

  const {
    dailyAnalytics,
    weeklyRevenue,
    monthlyRevenue,
    servicePopularity,
    hourlyHeatmap,
    reviewTrends,
    patientRetention,
    totalPatients: _totalPatients,
    totalAppointments,
    periodComparison,
  } = analytics;

  const noShowAppts = dailyAnalytics.reduce((sum, d) => sum + d.noShows, 0);
  const noShowRate = totalAppointments > 0 ? Math.round((noShowAppts / totalAppointments) * 100) : 0;

  const onlineBookings = dailyAnalytics.reduce((sum, d) => sum + d.onlineBookings, 0);
  const walkInBookings = dailyAnalytics.reduce((sum, d) => sum + d.walkIns, 0);
  const totalBookings = onlineBookings + walkInBookings || 1;

  const bookingSourceData = [
    { name: "Online", value: onlineBookings, percentage: Math.round((onlineBookings / totalBookings) * 100) },
    { name: "Walk-in", value: walkInBookings, percentage: Math.round((walkInBookings / totalBookings) * 100) },
  ];

  const _latestRetention = patientRetention[patientRetention.length - 1];

  const revenueData =
    revenuePeriod === "daily"
      ? dailyAnalytics.map((d) => ({ name: d.date.slice(5), revenue: d.revenue, patients: d.patientCount }))
      : revenuePeriod === "weekly"
      ? weeklyRevenue.map((w) => ({ name: w.week, revenue: w.revenue, patients: w.patients }))
      : monthlyRevenue.map((m) => ({ name: m.month, revenue: m.revenue, patients: m.patients }));

  const _totalDailyRevenue = dailyAnalytics.reduce((sum, d) => sum + d.revenue, 0);
  const _totalDailyPatients = dailyAnalytics.reduce((sum, d) => sum + d.patientCount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">
          {role === "admin" ? "Analytics & Reports" : "My Analytics"}
        </h1>
        <div className="flex gap-2 flex-wrap">
          {/* Time period selector */}
          <div className="flex gap-1 border rounded-lg p-0.5">
            {(["week", "month", "quarter", "year"] as const).map((p) => (
              <Button
                key={p}
                variant={timePeriod === p ? "default" : "ghost"}
                size="sm"
                onClick={() => setTimePeriod(p)}
                className="text-xs h-7 px-2.5"
              >
                {PERIOD_LABELS[p]}
              </Button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => {
            exportToCSV(
              dailyAnalytics.map((d) => ({
                date: d.date,
                patients: d.patientCount,
                revenue: d.revenue,
                noShows: d.noShows,
                onlineBookings: d.onlineBookings,
                walkIns: d.walkIns,
              })),
              [
                { key: "date", label: "Date" },
                { key: "patients", label: "Patients" },
                { key: "revenue", label: "Revenue (MAD)" },
                { key: "noShows", label: "No-Shows" },
                { key: "onlineBookings", label: "Online Bookings" },
                { key: "walkIns", label: "Walk-Ins" },
              ],
              `analytics-${new Date().toISOString().split("T")[0]}.csv`,
            );
          }}>
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
          <Badge variant="outline" className="text-xs">
            <RefreshCw className="h-3 w-3 mr-1" />
            Live Data
          </Badge>
        </div>
      </div>

      {/* KPI Cards with period comparison */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Users className="h-5 w-5 text-blue-600" />
              <ChangeIndicator value={periodComparison.patientChange} />
            </div>
            <p className="text-2xl font-bold">{periodComparison.currentPatients}</p>
            <p className="text-xs text-muted-foreground">Patients ({PERIOD_LABELS[timePeriod]})</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">vs prev: {periodComparison.previousPatients}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <ChangeIndicator value={periodComparison.revenueChange} />
            </div>
            <p className="text-2xl font-bold">{periodComparison.currentRevenue.toLocaleString()} MAD</p>
            <p className="text-xs text-muted-foreground">Revenue ({PERIOD_LABELS[timePeriod]})</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">vs prev: {periodComparison.previousRevenue.toLocaleString()} MAD</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <ChangeIndicator value={periodComparison.noShowChange} inverted />
            </div>
            <p className="text-2xl font-bold">{noShowRate}%</p>
            <p className="text-xs text-muted-foreground">No-show Rate</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{periodComparison.currentNoShows} no-shows ({PERIOD_LABELS[timePeriod]})</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Footprints className="h-5 w-5 text-purple-600" />
              <ChangeIndicator value={periodComparison.appointmentChange} />
            </div>
            <p className="text-2xl font-bold">{periodComparison.currentAppointments}</p>
            <p className="text-xs text-muted-foreground">Appointments ({PERIOD_LABELS[timePeriod]})</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">vs prev: {periodComparison.previousAppointments}</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Revenue Overview
            </CardTitle>
            <div className="flex gap-1">
              {(["daily", "weekly", "monthly"] as const).map((p) => (
                <Button
                  key={p}
                  variant={revenuePeriod === p ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRevenuePeriod(p)}
                  className="capitalize text-xs"
                >
                  {p}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value) => [`${Number(value).toLocaleString()} MAD`, "Revenue"]}
                contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#2563eb"
                fill="#2563eb"
                fillOpacity={0.15}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Daily Patient Count */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Daily Patient Count
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dailyAnalytics.map((d) => ({ name: d.date.slice(8), patients: d.patientCount }))}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: "8px", fontSize: "12px" }} />
                <Bar dataKey="patients" fill="#7c3aed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Most Popular Services */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Most Popular Services
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={servicePopularity}
                  dataKey="count"
                  nameKey="serviceName"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={({ name, percent }) => `${name} ${((percent as number) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {servicePopularity.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [Number(value), String(name)]}
                  contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Booking Source */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Booking Source (Online vs Walk-in)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-8">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie
                    data={bookingSourceData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                  >
                    <Cell fill="#2563eb" />
                    <Cell fill="#f97316" />
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: "8px", fontSize: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-4">
                {bookingSourceData.map((source, i) => (
                  <div key={source.name} className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: i === 0 ? "#2563eb" : "#f97316" }} />
                    <div>
                      <p className="text-sm font-medium">{source.name}</p>
                      <p className="text-xs text-muted-foreground">{source.value} bookings ({source.percentage}%)</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Patient Retention */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Patient Retention Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={patientRetention}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis domain={[60, 100]} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value) => [`${value}%`, "Retention Rate"]}
                  contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                />
                <Line type="monotone" dataKey="retentionRate" stroke="#16a34a" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Busiest Hours Heatmap */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Busiest Hours Heatmap
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div className="min-w-[400px]">
                <div className="flex gap-1 mb-1 pl-10">
                  {[9, 10, 11, 12, 14, 15, 16, 17].map((h) => (
                    <div key={h} className="flex-1 text-center text-[10px] text-muted-foreground">{h}:00</div>
                  ))}
                </div>
                {hourlyHeatmap.map((day) => (
                  <div key={day.day} className="flex gap-1 mb-1 items-center">
                    <span className="w-8 text-xs text-muted-foreground font-medium">{day.day}</span>
                    {[9, 10, 11, 12, 14, 15, 16, 17].map((hour) => {
                      const entry = day.hours.find((h) => h.hour === hour);
                      const count = entry?.count ?? 0;
                      const maxCount = 9;
                      const intensity = count / maxCount;
                      return (
                        <div
                          key={hour}
                          className="flex-1 h-8 rounded text-center flex items-center justify-center text-[10px] font-medium"
                          style={{
                            backgroundColor: count === 0
                              ? "var(--muted)"
                              : `rgba(37, 99, 235, ${0.15 + intensity * 0.75})`,
                            color: intensity > 0.5 ? "white" : "inherit",
                          }}
                          title={`${day.day} ${hour}:00 - ${count} patients`}
                        >
                          {count > 0 ? count : ""}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 justify-end">
              <span className="text-[10px] text-muted-foreground">Less</span>
              {[0.15, 0.35, 0.55, 0.75, 0.9].map((o, i) => (
                <div key={i} className="h-3 w-6 rounded" style={{ backgroundColor: `rgba(37, 99, 235, ${o})` }} />
              ))}
              <span className="text-[10px] text-muted-foreground">More</span>
            </div>
          </CardContent>
        </Card>

        {/* Review Score Over Time */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="h-4 w-4" />
              Review Score Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={reviewTrends}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis domain={[3, 5]} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value, name) => {
                    if (name === "averageScore") return [Number(value).toFixed(1), "Avg Score"];
                    return [Number(value), "Reviews"];
                  }}
                  contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                />
                <Legend />
                <Line type="monotone" dataKey="averageScore" stroke="#eab308" strokeWidth={2} dot={{ r: 4 }} name="Avg Score" />
                <Line type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} name="Review Count" yAxisId="right" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Stats Tabs */}
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="services">
            <TabsList className="mb-4">
              <TabsTrigger value="services">Service Revenue</TabsTrigger>
              <TabsTrigger value="retention">Retention Details</TabsTrigger>
              <TabsTrigger value="monthly">Monthly Summary</TabsTrigger>
            </TabsList>

            <TabsContent value="services">
              <div className="space-y-3">
                {servicePopularity.map((service) => (
                  <div key={service.serviceName}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>{service.serviceName}</span>
                      <span className="font-medium">{service.revenue.toLocaleString()} MAD</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${service.percentage}%` }} />
                      </div>
                      <Badge variant="outline" className="text-[10px]">{service.count} visits</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="retention">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={patientRetention}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: "8px", fontSize: "12px" }} />
                  <Legend />
                  <Bar dataKey="newPatients" fill="#2563eb" radius={[4, 4, 0, 0]} name="New Patients" />
                  <Bar dataKey="returningPatients" fill="#16a34a" radius={[4, 4, 0, 0]} name="Returning" />
                </BarChart>
              </ResponsiveContainer>
            </TabsContent>

            <TabsContent value="monthly">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value) => [`${Number(value).toLocaleString()} MAD`]}
                    contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                  />
                  <Legend />
                  <Bar dataKey="revenue" fill="#7c3aed" radius={[4, 4, 0, 0]} name="Revenue (MAD)" />
                </BarChart>
              </ResponsiveContainer>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
