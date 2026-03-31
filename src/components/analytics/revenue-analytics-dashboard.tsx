"use client";

import { useState, useEffect } from "react";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getCurrentUser,
  fetchRevenueAnalytics,
  fetchFeedbackStats,
  type RevenueAnalyticsData,
  type FeedbackStatsData,
  type AnalyticsPeriod,
} from "@/lib/data/client";
import { RevenueChart, type RevenueDataPoint } from "./revenue-chart";
import { RevenueByDoctor } from "./revenue-by-doctor";
import { RevenueByService } from "./revenue-by-service";
import { RevenueByMethod } from "./revenue-by-method";
import { RevenueKPICards } from "./revenue-kpi-cards";
import { ReviewStatsWidget } from "./review-stats-widget";
import { generateRevenueReport } from "@/lib/revenue-report-pdf";
import { exportToCSV } from "@/lib/export-data";
import { PageLoader } from "@/components/ui/page-loader";

const PERIOD_LABELS: Record<AnalyticsPeriod, string> = {
  week: "This Week",
  month: "This Month",
  quarter: "This Quarter",
  year: "This Year",
};

export function RevenueAnalyticsDashboard() {
  const [timePeriod, setTimePeriod] = useState<AnalyticsPeriod>("month");
  const [revenueData, setRevenueData] = useState<RevenueAnalyticsData | null>(null);
  const [feedbackStats, setFeedbackStats] = useState<FeedbackStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [clinicName, setClinicName] = useState("Clinic");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      const user = await getCurrentUser();
      if (controller.signal.aborted) return;
      if (!user?.clinic_id) { setLoading(false); return; }

      const [revenue, feedback] = await Promise.all([
        fetchRevenueAnalytics(user.clinic_id, timePeriod),
        fetchFeedbackStats(user.clinic_id),
      ]);
      if (controller.signal.aborted) return;

      setRevenueData(revenue);
      setFeedbackStats(feedback);
      setClinicName(user.clinic_id); // Will be replaced by clinic name if available
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
    return <PageLoader message="Loading revenue analytics..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">Failed to load revenue data.</p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
      </div>
    );
  }

  if (!revenueData) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">No revenue data available.</p>
      </div>
    );
  }

  // Build chart data from the revenue analytics
  const dailyData: RevenueDataPoint[] = [
    { name: "Today", revenue: revenueData.totalRevenue, patients: revenueData.patientsSeen },
  ];
  const weeklyData: RevenueDataPoint[] = [
    { name: PERIOD_LABELS[timePeriod], revenue: revenueData.totalRevenue, patients: revenueData.patientsSeen },
  ];
  const monthlyData: RevenueDataPoint[] = [
    { name: PERIOD_LABELS[timePeriod], revenue: revenueData.totalRevenue, patients: revenueData.patientsSeen },
  ];

  const handleExportCSV = () => {
    const rows = [
      ...revenueData.revenueByDoctor.map((d) => ({
        category: "Doctor",
        name: d.doctorName,
        revenue: d.revenue,
        count: d.patients,
      })),
      ...revenueData.revenueByService.map((s) => ({
        category: "Service",
        name: s.serviceName,
        revenue: s.revenue,
        count: s.count,
      })),
      ...revenueData.revenueByMethod.map((m) => ({
        category: "Payment Method",
        name: m.label,
        revenue: m.revenue,
        count: m.count,
      })),
    ];
    exportToCSV(
      rows,
      [
        { key: "category", label: "Category" },
        { key: "name", label: "Name" },
        { key: "revenue", label: "Revenue (MAD)" },
        { key: "count", label: "Count" },
      ],
      `revenue-report-${new Date().toISOString().split("T")[0]}.csv`,
    );
  };

  const handleExportPDF = () => {
    generateRevenueReport({
      clinicName,
      period: PERIOD_LABELS[timePeriod],
      generatedAt: new Date().toLocaleDateString(),
      currency: "MAD",
      totalRevenue: revenueData.totalRevenue,
      totalPatients: revenueData.patientsSeen,
      averagePerPatient: revenueData.averagePerPatient,
      noShowRate: revenueData.noShowRate,
      revenueByDoctor: revenueData.revenueByDoctor.map((d) => ({
        doctorName: d.doctorName,
        revenue: d.revenue,
        patients: d.patients,
      })),
      revenueByService: revenueData.revenueByService.map((s) => ({
        serviceName: s.serviceName,
        revenue: s.revenue,
        count: s.count,
      })),
      revenueByMethod: revenueData.revenueByMethod.map((m) => ({
        method: m.label,
        revenue: m.revenue,
        count: m.count,
        percentage: m.percentage,
      })),
      monthlyBreakdown: [],
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold">Revenue Analytics</h2>
        <div className="flex gap-2 flex-wrap">
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
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-1" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF}>
            <FileText className="h-4 w-4 mr-1" />
            PDF Report
          </Button>
          <Badge variant="outline" className="text-xs">
            {PERIOD_LABELS[timePeriod]}
          </Badge>
        </div>
      </div>

      {/* KPI Cards */}
      <RevenueKPICards
        kpis={{
          totalRevenue: revenueData.totalRevenue,
          patientsSeen: revenueData.patientsSeen,
          averagePerPatient: revenueData.averagePerPatient,
          noShowRate: revenueData.noShowRate,
          revenueChange: revenueData.revenueChange,
          patientsChange: revenueData.patientsChange,
        }}
      />

      {/* Revenue Over Time Chart */}
      <RevenueChart
        dailyData={dailyData}
        weeklyData={weeklyData}
        monthlyData={monthlyData}
      />

      {/* Revenue Breakdown Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <RevenueByDoctor
          data={revenueData.revenueByDoctor.map((d) => ({
            doctorName: d.doctorName,
            revenue: d.revenue,
            patients: d.patients,
          }))}
        />
        <RevenueByService
          data={revenueData.revenueByService.map((s) => ({
            serviceName: s.serviceName,
            revenue: s.revenue,
            count: s.count,
          }))}
        />
      </div>

      {/* Payment Method Breakdown */}
      <RevenueByMethod data={revenueData.revenueByMethod} />

      {/* Review Stats Widget */}
      {feedbackStats && (
        <ReviewStatsWidget
          stats={{
            averageRating: feedbackStats.averageRating,
            totalReviews: feedbackStats.totalReviews,
            positiveReviews: feedbackStats.positiveReviews,
            negativeReviews: feedbackStats.negativeReviews,
            googleReviewsSent: feedbackStats.googleReviewsSent,
            recentRatings: feedbackStats.recentRatings,
          }}
        />
      )}
    </div>
  );
}
