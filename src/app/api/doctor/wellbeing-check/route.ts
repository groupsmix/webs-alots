import { NextRequest } from "next/server";
import { apiError, apiSuccess, apiValidationError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { withAuth } from "@/lib/with-auth";
import type { AuthContext } from "@/lib/with-auth";

interface WellbeingMetrics {
  patientsToday: number;
  patientsThisWeek: number;
  hoursWorkedToday: number;
  consecutiveDaysWorked: number;
  lastDayOff: string | null;
}

type BurnoutRisk = "low" | "moderate" | "high" | "critical";

interface WellbeingResult {
  burnoutRisk: BurnoutRisk;
  score: number;
  metrics: WellbeingMetrics;
  recommendations: string[];
  alerts: string[];
}

function computeBurnoutScore(metrics: WellbeingMetrics): number {
  let score = 0;

  if (metrics.patientsToday > 30) score += 30;
  else if (metrics.patientsToday > 20) score += 20;
  else if (metrics.patientsToday > 15) score += 10;

  if (metrics.hoursWorkedToday > 12) score += 25;
  else if (metrics.hoursWorkedToday > 10) score += 15;
  else if (metrics.hoursWorkedToday > 8) score += 5;

  if (metrics.consecutiveDaysWorked > 12) score += 30;
  else if (metrics.consecutiveDaysWorked > 7) score += 20;
  else if (metrics.consecutiveDaysWorked > 5) score += 10;

  if (metrics.patientsThisWeek > 150) score += 15;
  else if (metrics.patientsThisWeek > 100) score += 10;

  return Math.min(score, 100);
}

function getRiskLevel(score: number): BurnoutRisk {
  if (score >= 70) return "critical";
  if (score >= 50) return "high";
  if (score >= 30) return "moderate";
  return "low";
}

function getRecommendations(
  metrics: WellbeingMetrics,
  risk: BurnoutRisk,
  language: string,
): string[] {
  const recs: string[] = [];
  const isFr = language !== "ar";

  if (risk === "critical" || risk === "high") {
    recs.push(
      isFr
        ? "Envisagez de bloquer un après-midi cette semaine pour vous reposer"
        : "فكر في حجب فترة بعد الظهر هذا الأسبوع للراحة",
    );
  }

  if (metrics.consecutiveDaysWorked > 6) {
    recs.push(
      isFr
        ? `Vous travaillez depuis ${metrics.consecutiveDaysWorked} jours consécutifs — prenez un jour de repos`
        : `أنت تعمل منذ ${metrics.consecutiveDaysWorked} أيام متتالية — خذ يوم راحة`,
    );
  }

  if (metrics.hoursWorkedToday > 10) {
    recs.push(
      isFr
        ? "Vous avez dépassé 10 heures aujourd'hui — pensez à déléguer les tâches restantes"
        : "لقد تجاوزت 10 ساعات اليوم — فكر في تفويض المهام المتبقية",
    );
  }

  if (metrics.patientsToday > 25) {
    recs.push(
      isFr
        ? "Plus de 25 patients aujourd'hui — réduisez les créneaux demain si possible"
        : "أكثر من 25 مريض اليوم — قلل المواعيد غداً إن أمكن",
    );
  }

  if (recs.length === 0) {
    recs.push(
      isFr
        ? "Votre charge de travail est dans les limites normales — continuez ainsi"
        : "حجم عملك ضمن الحدود الطبيعية — استمر هكذا",
    );
  }

  return recs;
}

async function handler(req: NextRequest, auth: AuthContext) {
  const clinicId = auth.profile.clinic_id;
  const doctorId = auth.profile.id;

  if (!clinicId) {
    return apiError("No clinic associated with this account", 403);
  }

  const url = new URL(req.url);
  const language = url.searchParams.get("language") ?? "fr";

  if (language !== "fr" && language !== "ar") {
    return apiValidationError("language must be 'fr' or 'ar'");
  }

  try {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);

    const [todayResult, weekResult, lastOffResult] = await Promise.all([
      auth.supabase
        .from("appointments")
        .select("id, start_time", { count: "exact" })
        .eq("clinic_id", clinicId)
        .eq("doctor_id", doctorId)
        .gte("start_time", todayStart.toISOString())
        .lte("start_time", now.toISOString())
        .in("status", ["completed", "in_progress", "confirmed"]),
      auth.supabase
        .from("appointments")
        .select("id", { count: "exact" })
        .eq("clinic_id", clinicId)
        .eq("doctor_id", doctorId)
        .gte("start_time", weekStart.toISOString())
        .lte("start_time", now.toISOString())
        .in("status", ["completed", "in_progress", "confirmed"]),
      auth.supabase
        .from("appointments")
        .select("start_time")
        .eq("clinic_id", clinicId)
        .eq("doctor_id", doctorId)
        .lt("start_time", todayStart.toISOString())
        .order("start_time", { ascending: false })
        .limit(30),
    ]);

    const patientsToday = todayResult.count ?? 0;
    const patientsThisWeek = weekResult.count ?? 0;

    let consecutiveDaysWorked = 1;
    let lastDayOff: string | null = null;

    if (lastOffResult.data && lastOffResult.data.length > 0) {
      const workDates = new Set<string>();
      for (const row of lastOffResult.data) {
        const d = new Date(row.start_time as string);
        workDates.add(d.toISOString().slice(0, 10));
      }
      const sortedDates = Array.from(workDates).sort().reverse();
      const today = now.toISOString().slice(0, 10);
      const checkDate = new Date(today);
      for (let i = 0; i < 30; i++) {
        const dateStr = checkDate.toISOString().slice(0, 10);
        if (workDates.has(dateStr) || dateStr === today) {
          consecutiveDaysWorked = i + 1;
        } else {
          lastDayOff = dateStr;
          break;
        }
        checkDate.setDate(checkDate.getDate() - 1);
      }
      if (!lastDayOff && sortedDates.length > 0) {
        lastDayOff = sortedDates[sortedDates.length - 1] ?? null;
      }
    }

    const firstAppointment = todayResult.data?.[0];
    let hoursWorkedToday = 0;
    if (firstAppointment) {
      const firstTime = new Date(firstAppointment.start_time as string);
      hoursWorkedToday = Math.round(((now.getTime() - firstTime.getTime()) / 3600000) * 10) / 10;
    }

    const metrics: WellbeingMetrics = {
      patientsToday,
      patientsThisWeek,
      hoursWorkedToday,
      consecutiveDaysWorked,
      lastDayOff,
    };

    const score = computeBurnoutScore(metrics);
    const burnoutRisk = getRiskLevel(score);
    const recommendations = getRecommendations(metrics, burnoutRisk, language);

    const alerts: string[] = [];
    const isFr = language !== "ar";
    if (burnoutRisk === "critical") {
      alerts.push(
        isFr
          ? "⚠ Risque d'épuisement critique — prenez des mesures immédiates"
          : "⚠ خطر الإرهاق حرج — اتخذ إجراءات فورية",
      );
    }
    if (metrics.consecutiveDaysWorked > 10) {
      alerts.push(
        isFr
          ? `Vous n'avez pas pris de jour de repos depuis ${metrics.consecutiveDaysWorked} jours`
          : `لم تأخذ يوم راحة منذ ${metrics.consecutiveDaysWorked} يوم`,
      );
    }

    const result: WellbeingResult = {
      burnoutRisk,
      score,
      metrics,
      recommendations,
      alerts,
    };

    return apiSuccess(result);
  } catch (err) {
    logger.error("Wellbeing check failed", {
      context: "wellbeing-check",
      error: err instanceof Error ? err.message : String(err),
      doctorId,
    });
    return apiError("Failed to compute wellbeing metrics", 500);
  }
}

export const GET = withAuth(handler, ["doctor", "clinic_admin"]);
