"use client";

import { createClient } from "@/lib/supabase-client";
import { getLocalDateStr } from "@/lib/utils";
import { ensureLookups, _activeServiceMap } from "./_core";

// ─────────────────────────────────────────────
// Analytics (computed from real data)
// ─────────────────────────────────────────────

interface DailyAnalyticsView {
  date: string;
  patientCount: number;
  revenue: number;
  appointments: number;
  noShows: number;
  walkIns: number;
  onlineBookings: number;
}

interface WeeklyRevenueView {
  week: string;
  revenue: number;
  patients: number;
}

interface MonthlyRevenueView {
  month: string;
  revenue: number;
  patients: number;
  appointments: number;
}

interface ServicePopularityView {
  serviceName: string;
  count: number;
  revenue: number;
  percentage: number;
}

interface HourlyHeatmapView {
  day: string;
  hours: { hour: number; count: number }[];
}

interface ReviewTrendView {
  month: string;
  averageScore: number;
  count: number;
}

interface PatientRetentionView {
  month: string;
  newPatients: number;
  returningPatients: number;
  retentionRate: number;
}

export type AnalyticsPeriod = "week" | "month" | "quarter" | "year";

interface PeriodComparison {
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

const ANALYTICS_CACHE_TTL_MS = 5 * 60_000;

const analyticsCache = new Map<
  string,
  {
    expiresAt: number;
    data: AnalyticsData;
  }
>();

function getAnalyticsCacheKey(clinicId: string, period: AnalyticsPeriod): string {
  return `analytics:${clinicId}:${period}`;
}

function getPeriodRange(period: AnalyticsPeriod): {
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
} {
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

  const currentAppts = appts.filter(
    (a) => a.appointment_date >= startStr && a.appointment_date <= endStr,
  );
  const prevAppts = appts.filter(
    (a) => a.appointment_date >= prevStartStr && a.appointment_date <= prevEndStr,
  );

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

type ApptRow = {
  id: string;
  appointment_date: string;
  start_time: string;
  status: string;
  patient_id: string;
  service_id: string | null;
  booking_source: string | null;
  doctor_id: string | null;
};
type PaymentRow = {
  id: string;
  amount: number;
  created_at: string;
  payment_method: string | null;
  doctor_id: string | null;
  service_id: string | null;
};
type ReviewRow = { id: string; stars: number; created_at: string };
type PatientRow = { id: string; created_at: string };

export interface RateLimitStatus {
  limit: string | null;
  remaining: string | null;
  reset: string | null;
}

export type FetchAnalyticsResponse = AnalyticsData & { rateLimit?: RateLimitStatus };

export async function fetchAnalytics(
  clinicId: string,
  period: AnalyticsPeriod = "month",
): Promise<FetchAnalyticsResponse> {
  const cacheKey = getAnalyticsCacheKey(clinicId, period);
  const cached = analyticsCache.get(cacheKey);
  const nowMs = Date.now();

  if (cached && cached.expiresAt > nowMs) {
    // Re-return cached data, but without rate limits
    return cached.data;
  }
  if (cached) {
    analyticsCache.delete(cacheKey);
  }

  // Hit the Next.js API route so it passes through middleware for rate-limiting
  const res = await fetch(`/api/analytics/dashboard?period=${period}`);
  const json = await res.json();

  if (!json.ok) {
    throw new Error(json.error ?? "Failed to load analytics");
  }

  const rateLimit = {
    limit: res.headers.get("X-RateLimit-Limit"),
    remaining: res.headers.get("X-RateLimit-Remaining"),
    reset: res.headers.get("X-RateLimit-Reset"),
  };

  const data = json.data as AnalyticsData;

  analyticsCache.set(cacheKey, {
    expiresAt: nowMs + ANALYTICS_CACHE_TTL_MS,
    data,
  });

  return { ...data, rateLimit };
}

// ── Revenue Analytics (Feature 15) ──────────────────────

interface DoctorRevenueView {
  doctorId: string;
  doctorName: string;
  revenue: number;
  patients: number;
}

interface ServiceRevenueView {
  serviceId: string;
  serviceName: string;
  revenue: number;
  count: number;
}

interface PaymentMethodView {
  method: string;
  label: string;
  revenue: number;
  count: number;
  percentage: number;
}

interface RevenueAnalyticsData {
  revenueByDoctor: DoctorRevenueView[];
  revenueByService: ServiceRevenueView[];
  revenueByMethod: PaymentMethodView[];
  totalRevenue: number;
  patientsSeen: number;
  averagePerPatient: number;
  noShowRate: number;
  revenueChange: number;
  patientsChange: number;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  insurance: "Insurance",
  online_transfer: "Online Transfer",
  cheque: "Cheque",
  other: "Other",
};

async function _fetchRevenueAnalytics(
  clinicId: string,
  period: AnalyticsPeriod = "month",
): Promise<RevenueAnalyticsData> {
  const supabase = createClient();

  const [apptsRes, paymentsRes, doctorsRes] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, appointment_date, status, patient_id, doctor_id, service_id")
      .eq("clinic_id", clinicId),
    supabase
      .from("payments")
      .select("id, amount, created_at, payment_method, doctor_id, service_id")
      .eq("clinic_id", clinicId)
      .eq("status", "completed"),
    supabase.from("users").select("id, name").eq("clinic_id", clinicId).eq("role", "doctor"),
  ]);

  const appts = (apptsRes.data ?? []) as unknown as ApptRow[];
  const payments = (paymentsRes.data ?? []) as unknown as PaymentRow[];
  const doctors = (doctorsRes.data ?? []) as { id: string; name: string }[];

  await ensureLookups(clinicId);

  const { start, end, prevStart, prevEnd } = getPeriodRange(period);
  const startStr = getLocalDateStr(start);
  const endStr = getLocalDateStr(end);
  const prevStartStr = getLocalDateStr(prevStart);
  const prevEndStr = getLocalDateStr(prevEnd);

  const currentAppts = appts.filter(
    (a) => a.appointment_date >= startStr && a.appointment_date <= endStr,
  );
  const prevAppts = appts.filter(
    (a) => a.appointment_date >= prevStartStr && a.appointment_date <= prevEndStr,
  );

  const currentPayments = payments.filter((p) => {
    const d = p.created_at?.split("T")[0];
    return d && d >= startStr && d <= endStr;
  });
  const prevPayments = payments.filter((p) => {
    const d = p.created_at?.split("T")[0];
    return d && d >= prevStartStr && d <= prevEndStr;
  });

  const totalRevenue = currentPayments.reduce((s, p) => s + p.amount, 0);
  const prevRevenue = prevPayments.reduce((s, p) => s + p.amount, 0);
  const patientsSeen = new Set(currentAppts.map((a) => a.patient_id)).size;
  const prevPatientsSeen = new Set(prevAppts.map((a) => a.patient_id)).size;
  const noShows = currentAppts.filter((a) => a.status === "no_show").length;
  const noShowRate =
    currentAppts.length > 0 ? Math.round((noShows / currentAppts.length) * 100) : 0;
  const averagePerPatient = patientsSeen > 0 ? Math.round(totalRevenue / patientsSeen) : 0;

  function pctChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  // Revenue by doctor
  const doctorMap = new Map<string, string>();
  for (const d of doctors) doctorMap.set(d.id, d.name);

  const doctorRevMap = new Map<string, { revenue: number; patients: Set<string> }>();
  for (const p of currentPayments) {
    const dId = p.doctor_id ?? "unknown";
    const entry = doctorRevMap.get(dId) ?? { revenue: 0, patients: new Set<string>() };
    entry.revenue += p.amount;
    doctorRevMap.set(dId, entry);
  }
  for (const a of currentAppts) {
    const dId = a.doctor_id ?? "unknown";
    const entry = doctorRevMap.get(dId);
    if (entry) entry.patients.add(a.patient_id);
  }

  const revenueByDoctor: DoctorRevenueView[] = [...doctorRevMap.entries()]
    .map(([id, val]) => ({
      doctorId: id,
      doctorName: doctorMap.get(id) ?? "Other",
      revenue: val.revenue,
      patients: val.patients.size,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // Revenue by service
  const serviceRevMap = new Map<string, { revenue: number; count: number }>();
  for (const p of currentPayments) {
    const sId = p.service_id ?? "unknown";
    const svcName =
      sId !== "unknown" ? (_activeServiceMap?.get(sId)?.name ?? "Other") : "Consultation";
    const entry = serviceRevMap.get(svcName) ?? { revenue: 0, count: 0 };
    entry.revenue += p.amount;
    entry.count++;
    serviceRevMap.set(svcName, entry);
  }

  const revenueByService: ServiceRevenueView[] = [...serviceRevMap.entries()]
    .map(([name, val]) => ({
      serviceId: name,
      serviceName: name,
      revenue: val.revenue,
      count: val.count,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // Revenue by payment method
  const methodRevMap = new Map<string, { revenue: number; count: number }>();
  for (const p of currentPayments) {
    const method = p.payment_method ?? "other";
    const entry = methodRevMap.get(method) ?? { revenue: 0, count: 0 };
    entry.revenue += p.amount;
    entry.count++;
    methodRevMap.set(method, entry);
  }

  const totalMethodRevenue = totalRevenue || 1;
  const revenueByMethod: PaymentMethodView[] = [...methodRevMap.entries()]
    .map(([method, val]) => ({
      method,
      label: PAYMENT_METHOD_LABELS[method] ?? method,
      revenue: val.revenue,
      count: val.count,
      percentage: Math.round((val.revenue / totalMethodRevenue) * 100),
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    revenueByDoctor,
    revenueByService,
    revenueByMethod,
    totalRevenue,
    patientsSeen,
    averagePerPatient,
    noShowRate,
    revenueChange: pctChange(totalRevenue, prevRevenue),
    patientsChange: pctChange(patientsSeen, prevPatientsSeen),
  };
}

// ── Feedback / Review Stats ──────────────────────────────

interface FeedbackStatsData {
  averageRating: number;
  totalReviews: number;
  positiveReviews: number;
  negativeReviews: number;
  googleReviewsSent: number;
  recentRatings: { month: string; average: number; count: number }[];
}

type FeedbackRow = { id: string; rating: number; google_review_sent: boolean; created_at: string };

async function _fetchFeedbackStats(clinicId: string): Promise<FeedbackStatsData> {
  const supabase = createClient();

  // patient_feedback table added by migration 00055 — cast through unknown
  type FbQuery = {
    from(t: string): {
      select(s: string): {
        eq(
          c: string,
          v: string,
        ): { gt(c2: string, v2: number): Promise<{ data: FeedbackRow[] | null }> };
      };
    };
  };
  const { data: feedback } = await (supabase as unknown as FbQuery)
    .from("patient_feedback")
    .select("id, rating, google_review_sent, created_at")
    .eq("clinic_id", clinicId)
    .gt("rating", 0);

  const allFeedback: FeedbackRow[] = feedback ?? [];
  const totalReviews = allFeedback.length;
  const positiveReviews = allFeedback.filter((f) => f.rating >= 4).length;
  const negativeReviews = allFeedback.filter((f) => f.rating > 0 && f.rating < 4).length;
  const googleReviewsSent = allFeedback.filter((f) => f.google_review_sent).length;
  const averageRating =
    totalReviews > 0 ? allFeedback.reduce((s, f) => s + f.rating, 0) / totalReviews : 0;

  const now = new Date();
  const recentRatings: { month: string; average: number; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStr = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    const monthFeedback = allFeedback.filter((f) => f.created_at?.startsWith(monthStr));
    const avg =
      monthFeedback.length > 0
        ? monthFeedback.reduce((s, f) => s + f.rating, 0) / monthFeedback.length
        : 0;
    recentRatings.push({
      month: label,
      average: Math.round(avg * 10) / 10,
      count: monthFeedback.length,
    });
  }

  return {
    averageRating: Math.round(averageRating * 10) / 10,
    totalReviews,
    positiveReviews,
    negativeReviews,
    googleReviewsSent,
    recentRatings,
  };
}
