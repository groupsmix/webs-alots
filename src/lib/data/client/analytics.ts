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

export type AnalyticsPeriod = "week" | "month" | "quarter" | "year";

export interface PeriodComparison {
  currentRevenue: number;
  previousRevenue: number;
  revenueChange: number;
  currentPatients: number;
  previousPatients: number;
  patientChange: number;
  currentAppointments: number;
  previousAppointments: number;
  appointmentChange: number;
  currentNoShows: number;
  previousNoShows: number;
  noShowChange: number;
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
  periodComparison: PeriodComparison;
  period: AnalyticsPeriod;
}

function getPeriodRange(period: AnalyticsPeriod): { start: Date; end: Date; prevStart: Date; prevEnd: Date } {
  const now = new Date();
  const end = new Date(now);
  let start: Date;
  let prevStart: Date;
  let prevEnd: Date;

  switch (period) {
    case "week": {
      start = new Date(now);
      start.setDate(start.getDate() - 7);
      prevEnd = new Date(start);
      prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - 7);
      break;
    }
    case "month": {
      start = new Date(now);
      start.setMonth(start.getMonth() - 1);
      prevEnd = new Date(start);
      prevStart = new Date(prevEnd);
      prevStart.setMonth(prevStart.getMonth() - 1);
      break;
    }
    case "quarter": {
      start = new Date(now);
      start.setMonth(start.getMonth() - 3);
      prevEnd = new Date(start);
      prevStart = new Date(prevEnd);
      prevStart.setMonth(prevStart.getMonth() - 3);
      break;
    }
    case "year": {
      start = new Date(now);
      start.setFullYear(start.getFullYear() - 1);
      prevEnd = new Date(start);
      prevStart = new Date(prevEnd);
      prevStart.setFullYear(prevStart.getFullYear() - 1);
      break;
    }
  }

  return { start, end, prevStart, prevEnd };
}

function computeComparison(
  appts: ApptRow[],
  payments: PaymentRow[],
  period: AnalyticsPeriod,
): PeriodComparison {
  const { start, end, prevStart, prevEnd } = getPeriodRange(period);
  const startStr = getLocalDateStr(start);
  const endStr = getLocalDateStr(end);
  const prevStartStr = getLocalDateStr(prevStart);
  const prevEndStr = getLocalDateStr(prevEnd);

  const currentAppts = appts.filter((a) => a.appointment_date >= startStr && a.appointment_date <= endStr);
  const prevAppts = appts.filter((a) => a.appointment_date >= prevStartStr && a.appointment_date <= prevEndStr);

  const currentPayments = payments.filter((p) => {
    const d = p.created_at?.split("T")[0];
    return d && d >= startStr && d <= endStr;
  });
  const prevPayments = payments.filter((p) => {
    const d = p.created_at?.split("T")[0];
    return d && d >= prevStartStr && d <= prevEndStr;
  });

  const currentRevenue = currentPayments.reduce((s, p) => s + p.amount, 0);
  const previousRevenue = prevPayments.reduce((s, p) => s + p.amount, 0);
  const currentPatients = new Set(currentAppts.map((a) => a.patient_id)).size;
  const previousPatients = new Set(prevAppts.map((a) => a.patient_id)).size;
  const currentNoShows = currentAppts.filter((a) => a.status === "no_show").length;
  const previousNoShows = prevAppts.filter((a) => a.status === "no_show").length;

  function pctChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  return {
    currentRevenue,
    previousRevenue,
    revenueChange: pctChange(currentRevenue, previousRevenue),
    currentPatients,
    previousPatients,
    patientChange: pctChange(currentPatients, previousPatients),
    currentAppointments: currentAppts.length,
    previousAppointments: prevAppts.length,
    appointmentChange: pctChange(currentAppts.length, prevAppts.length),
    currentNoShows,
    previousNoShows,
    noShowChange: pctChange(currentNoShows, previousNoShows),
  };
}

type ApptRow = { id: string; appointment_date: string; start_time: string; status: string; patient_id: string; service_id: string | null; booking_source: string | null };
type PaymentRow = { id: string; amount: number; created_at: string };
type ReviewRow = { id: string; stars: number; created_at: string };
type PatientRow = { id: string; created_at: string };

export async function fetchAnalytics(clinicId: string, period: AnalyticsPeriod = "month"): Promise<AnalyticsData> {
  const supabase = createClient();

  const [apptsRes, paymentsRes, reviewsRes, patientsRes] = await Promise.all([
  supabase.from("appointments").select("id, appointment_date, start_time, status, patient_id, service_id, booking_source").eq("clinic_id", clinicId),
  supabase.from("payments").select("id, amount, created_at").eq("clinic_id", clinicId).eq("status", "completed"),
  supabase.from("reviews").select("id, stars, created_at").eq("clinic_id", clinicId),
  supabase.from("users").select("id, created_at").eq("clinic_id", clinicId).eq("role", "patient"),
  ]);

  const appts = (apptsRes.data ?? []) as ApptRow[];
  const payments = (paymentsRes.data ?? []) as PaymentRow[];
  const reviews = (reviewsRes.data ?? []) as ReviewRow[];
  const allPatients = (patientsRes.data ?? []) as PatientRow[];

  await ensureLookups(clinicId);

  // Period comparison
  const periodComparison = computeComparison(appts, payments, period);

  // Daily analytics — adjust range based on selected period
  const periodDays = period === "week" ? 7 : period === "month" ? 30 : period === "quarter" ? 90 : 365;
  const dailyMap = new Map<string, DailyAnalyticsView>();
  const now = new Date();
  for (let i = Math.min(periodDays, 30) - 1; i >= 0; i--) {
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
    periodComparison,
    period,
  };
}

// ─────────────────────────────────────────────
