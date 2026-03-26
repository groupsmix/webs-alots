"use client";

import { ensureLookups, _activeServiceMap } from "./_core";
import { createClient } from "@/lib/supabase-client";
import { getLocalDateStr } from "@/lib/utils";

// ─────────────────────────────────────────────
// Analytics (computed from real data)
// ─────────────────────────────────────────────

export interface DailyAnalyticsView {
  date: string;
  patientCount: number;
  revenue: number;
  appointments: number;
  noShows: number;
  walkIns: number;
  onlineBookings: number;
}

export interface WeeklyRevenueView {
  week: string;
  revenue: number;
  patients: number;
}

export interface MonthlyRevenueView {
  month: string;
  revenue: number;
  patients: number;
  appointments: number;
}

export interface ServicePopularityView {
  serviceName: string;
  count: number;
  revenue: number;
  percentage: number;
}

export interface HourlyHeatmapView {
  day: string;
  hours: { hour: number; count: number }[];
}

export interface ReviewTrendView {
  month: string;
  averageScore: number;
  count: number;
}

export interface PatientRetentionView {
  month: string;
  newPatients: number;
  returningPatients: number;
  retentionRate: number;
}

export interface AnalyticsData {
  dailyAnalytics: DailyAnalyticsView[];
  weeklyRevenue: WeeklyRevenueView[];
  monthlyRevenue: MonthlyRevenueView[];
  servicePopularity: ServicePopularityView[];
  hourlyHeatmap: HourlyHeatmapView[];
  reviewTrends: ReviewTrendView[];
  patientRetention: PatientRetentionView[];
  totalPatients: number;
  totalAppointments: number;
}

export async function fetchAnalytics(clinicId: string): Promise<AnalyticsData> {
  const supabase = createClient();

  const [apptsRes, paymentsRes, reviewsRes, patientsRes] = await Promise.all([
  supabase.from("appointments").select("*").eq("clinic_id", clinicId),
  supabase.from("payments").select("*").eq("clinic_id", clinicId).eq("status", "completed"),
  supabase.from("reviews").select("*").eq("clinic_id", clinicId),
  supabase.from("users").select("id, created_at").eq("clinic_id", clinicId).eq("role", "patient"),
  ]);

  type ApptRow = { id: string; appointment_date: string; start_time: string; status: string; patient_id: string; service_id: string | null; booking_source: string | null };
  type PaymentRow = { id: string; amount: number; created_at: string };
  type ReviewRow = { id: string; stars: number; created_at: string };
  type PatientRow = { id: string; created_at: string };

  const appts = (apptsRes.data ?? []) as ApptRow[];
  const payments = (paymentsRes.data ?? []) as PaymentRow[];
  const reviews = (reviewsRes.data ?? []) as ReviewRow[];
  const allPatients = (patientsRes.data ?? []) as PatientRow[];

  await ensureLookups(clinicId);

  // Daily analytics (last 20 days)
  const dailyMap = new Map<string, DailyAnalyticsView>();
  const now = new Date();
  for (let i = 19; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = getLocalDateStr(d);
    dailyMap.set(dateStr, { date: dateStr, patientCount: 0, revenue: 0, appointments: 0, noShows: 0, walkIns: 0, onlineBookings: 0 });
  }
  for (const a of appts) {
    const day = dailyMap.get(a.appointment_date);
    if (!day) continue;
    day.appointments++;
    day.patientCount++;
    if (a.status === "no_show") day.noShows++;
    if (a.booking_source === "walk_in") day.walkIns++;
    if (a.booking_source === "online" || a.booking_source === "website") day.onlineBookings++;
  }
  for (const p of payments) {
    const dateStr = p.created_at?.split("T")[0];
    const day = dailyMap.get(dateStr);
    if (day) day.revenue += p.amount;
  }
  const dailyAnalytics = [...dailyMap.values()];

  // Weekly revenue (group daily into weeks)
  const weeklyRevenue: WeeklyRevenueView[] = [];
  for (let i = 0; i < dailyAnalytics.length; i += 7) {
    const chunk = dailyAnalytics.slice(i, i + 7);
    if (chunk.length === 0) break;
    const weekNum = Math.floor(i / 7) + 1;
    weeklyRevenue.push({
      week: `Week ${weekNum} (${chunk[0].date.slice(5)} - ${chunk[chunk.length - 1].date.slice(5)})`,
      revenue: chunk.reduce((s, d) => s + d.revenue, 0),
      patients: chunk.reduce((s, d) => s + d.patientCount, 0),
    });
  }

  // Monthly revenue (last 6 months)
  const monthlyRevenue: MonthlyRevenueView[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStr = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    const monthAppts = appts.filter((a) => a.appointment_date?.startsWith(monthStr));
    const monthPayments = payments.filter((p) => p.created_at?.startsWith(monthStr));
    const uniquePatients = new Set(monthAppts.map((a) => a.patient_id));
    monthlyRevenue.push({
      month: label,
      revenue: monthPayments.reduce((s, p) => s + p.amount, 0),
      patients: uniquePatients.size,
      appointments: monthAppts.length,
    });
  }

  // Service popularity
  const serviceCount = new Map<string, { count: number; revenue: number }>();
  for (const a of appts) {
    const svcName = a.service_id ? (_activeServiceMap?.get(a.service_id)?.name ?? "Other") : "Consultation";
    const entry = serviceCount.get(svcName) ?? { count: 0, revenue: 0 };
    entry.count++;
    if (a.service_id) {
      entry.revenue += _activeServiceMap?.get(a.service_id)?.price ?? 0;
    }
    serviceCount.set(svcName, entry);
  }
  const totalSvcCount = appts.length || 1;
  const servicePopularity: ServicePopularityView[] = [...serviceCount.entries()]
    .map(([name, val]) => ({
      serviceName: name,
      count: val.count,
      revenue: val.revenue,
      percentage: Math.round((val.count / totalSvcCount) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  // Hourly heatmap
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const heatmap = new Map<string, Map<number, number>>();
  for (const name of dayNames) heatmap.set(name, new Map());
  for (const a of appts) {
    const date = new Date(a.appointment_date);
    const dayName = dayNames[date.getDay()];
    const hour = parseInt(a.start_time?.slice(0, 2) ?? "0", 10);
    const dayMap = heatmap.get(dayName)!;
    dayMap.set(hour, (dayMap.get(hour) ?? 0) + 1);
  }
  const hourlyHeatmap: HourlyHeatmapView[] = dayNames.slice(1, 7).map((day) => ({
    day,
    hours: [9, 10, 11, 12, 14, 15, 16, 17]
      .map((hour) => ({ hour, count: heatmap.get(day)?.get(hour) ?? 0 })),
  }));

  // Review trends (last 6 months)
  const reviewTrends: ReviewTrendView[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStr = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    const monthReviews = reviews.filter((r) => r.created_at?.startsWith(monthStr));
    const avg = monthReviews.length > 0
      ? monthReviews.reduce((s, r) => s + r.stars, 0) / monthReviews.length
      : 0;
    reviewTrends.push({ month: label, averageScore: Math.round(avg * 10) / 10, count: monthReviews.length });
  }

  // Patient retention (last 6 months)
  const patientRetention: PatientRetentionView[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStr = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    const newPts = allPatients.filter((p) => p.created_at?.startsWith(monthStr)).length;
    const monthAppts = appts.filter((a) => a.appointment_date?.startsWith(monthStr));
    const returningIds = new Set(monthAppts.map((a) => a.patient_id));
    const returning = returningIds.size;
    const total = newPts + returning || 1;
    patientRetention.push({
      month: label,
      newPatients: newPts,
      returningPatients: returning,
      retentionRate: Math.round((returning / total) * 100),
    });
  }

  return {
    dailyAnalytics,
    weeklyRevenue,
    monthlyRevenue,
    servicePopularity,
    hourlyHeatmap,
    reviewTrends,
    patientRetention,
    totalPatients: allPatients.length,
    totalAppointments: appts.length,
  };
}

// ─────────────────────────────────────────────
