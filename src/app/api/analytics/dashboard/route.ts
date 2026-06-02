import { type NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { withAuth, type AuthContext } from "@/lib/with-auth";
import { getLocalDateStr } from "@/lib/utils";

type AnalyticsPeriod = "week" | "month" | "quarter" | "year";

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

function computeComparison(
  appts: ApptRow[],
  payments: PaymentRow[],
  period: AnalyticsPeriod,
) {
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

async function handler(request: NextRequest, auth: AuthContext) {
  const url = new URL(request.url);
  const period = (url.searchParams.get("period") as AnalyticsPeriod) || "month";
  const clinicId = auth.profile.clinic_id;

  if (!clinicId) {
    return apiError("No clinic context", 403);
  }

  const supabase = auth.supabase;
  const { prevStart, end } = getPeriodRange(period);
  const periodStart = getLocalDateStr(prevStart);
  const periodEnd = getLocalDateStr(end);

  const [apptsRes, paymentsRes, reviewsRes, patientsRes, servicesRes] = await Promise.all([
    // nosemgrep: tenant-scoping — .eq("clinic_id", clinicId) filters below
    supabase
      .from("appointments")
      .select(
        "id, appointment_date, start_time, status, patient_id, service_id, booking_source, doctor_id",
      )
      .eq("clinic_id", clinicId)
      .gte("appointment_date", periodStart)
      .lte("appointment_date", periodEnd),
    // nosemgrep: tenant-scoping — .eq("clinic_id", clinicId) filters below
    supabase
      .from("payments")
      .select("id, amount, created_at, payment_method, doctor_id, service_id")
      .eq("clinic_id", clinicId)
      .eq("status", "completed")
      .gte("created_at", `${periodStart}T00:00:00`)
      .lte("created_at", `${periodEnd}T23:59:59`),
    // nosemgrep: tenant-scoping — .eq("clinic_id", clinicId) filters below
    supabase
      .from("reviews")
      .select("id, stars, created_at")
      .eq("clinic_id", clinicId)
      .gte("created_at", `${periodStart}T00:00:00`)
      .lte("created_at", `${periodEnd}T23:59:59`),
    // nosemgrep: tenant-scoping — .eq("clinic_id", clinicId) filters below
    supabase.from("users").select("id, created_at").eq("clinic_id", clinicId).eq("role", "patient"),
    // nosemgrep: tenant-scoping — .eq("clinic_id", clinicId) filters below
    supabase.from("services").select("id, name, price").eq("clinic_id", clinicId),
  ]);

  const appts = (apptsRes.data ?? []) as unknown as ApptRow[];
  const payments = (paymentsRes.data ?? []) as unknown as PaymentRow[];
  const reviews = (reviewsRes.data ?? []) as ReviewRow[];
  const allPatients = (patientsRes.data ?? []) as PatientRow[];
  const services = (servicesRes.data ?? []) as { id: string; name: string; price: number }[];

  const serviceMap = new Map(services.map((s) => [s.id, { name: s.name, price: s.price }]));

  const periodComparison = computeComparison(appts, payments, period);

  const periodDays =
    period === "week" ? 7 : period === "month" ? 30 : period === "quarter" ? 90 : 365;
  const dailyMap = new Map<string, any>();
  const now = new Date();
  for (let i = Math.min(periodDays, 30) - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = getLocalDateStr(d);
    dailyMap.set(dateStr, {
      date: dateStr,
      patientCount: 0,
      revenue: 0,
      appointments: 0,
      noShows: 0,
      walkIns: 0,
      onlineBookings: 0,
    });
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

  const weeklyRevenue: any[] = [];
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

  const monthlyRevenue: any[] = [];
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

  const serviceCount = new Map<string, { count: number; revenue: number }>();
  for (const a of appts) {
    const svcName = a.service_id
      ? (serviceMap.get(a.service_id)?.name ?? "Other")
      : "Consultation";
    const entry = serviceCount.get(svcName) ?? { count: 0, revenue: 0 };
    entry.count++;
    if (a.service_id) {
      entry.revenue += serviceMap.get(a.service_id)?.price ?? 0;
    }
    serviceCount.set(svcName, entry);
  }
  const totalSvcCount = appts.length || 1;
  const servicePopularity = [...serviceCount.entries()]
    .map(([name, val]) => ({
      serviceName: name,
      count: val.count,
      revenue: val.revenue,
      percentage: Math.round((val.count / totalSvcCount) * 100),
    }))
    .sort((a, b) => b.count - a.count);

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
  const hourlyHeatmap = dayNames.slice(1, 7).map((day) => ({
    day,
    hours: [9, 10, 11, 12, 14, 15, 16, 17].map((hour) => ({
      hour,
      count: heatmap.get(day)?.get(hour) ?? 0,
    })),
  }));

  const reviewTrends: any[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStr = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    const monthReviews = reviews.filter((r) => r.created_at?.startsWith(monthStr));
    const avg =
      monthReviews.length > 0
        ? monthReviews.reduce((s, r) => s + r.stars, 0) / monthReviews.length
        : 0;
    reviewTrends.push({
      month: label,
      averageScore: Math.round(avg * 10) / 10,
      count: monthReviews.length,
    });
  }

  const patientRetention: any[] = [];
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

  return apiSuccess({
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
  });
}

export const GET = withAuth(handler, ["clinic_admin", "doctor"]);
