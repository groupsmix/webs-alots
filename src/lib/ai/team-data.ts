/**
 * Data fetchers for AI team agents.
 * Each function queries clinic-scoped data to feed AI prompts.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import type { Database } from "@/lib/types/database";
import { formatCurrency } from "@/lib/utils";

type Supabase = SupabaseClient<Database>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseUntyped = { from(table: string): any };

export async function fetchMarketingData(supabase: Supabase, clinicId: string) {
  const now = new Date();
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [inactivePatients, newPatients, totalPatients, recentAppointments] = await Promise.all([
    supabase
      .from("users")
      .select("id, name, updated_at")
      .eq("clinic_id", clinicId)
      .eq("role", "patient")
      .lt("updated_at", threeMonthsAgo.toISOString())
      .order("updated_at", { ascending: true })
      .limit(20),

    supabase
      .from("users")
      .select("id", { count: "exact" })
      .eq("clinic_id", clinicId)
      .eq("role", "patient")
      .gte("created_at", startOfMonth.toISOString()),

    supabase
      .from("users")
      .select("id", { count: "exact" })
      .eq("clinic_id", clinicId)
      .eq("role", "patient"),

    supabase
      .from("appointments")
      .select("id, status, patient_id, appointment_date")
      .eq("clinic_id", clinicId)
      .eq("status", "completed")
      .gte(
        "appointment_date",
        new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      )
      .limit(50),
  ]);

  // Fetch patients with upcoming birthdays (next 30 days)
  const untypedSupa = supabase as unknown as SupabaseUntyped;
  let birthdayPatients: { id: string; name: string }[] = [];
  try {
    const { data } = await untypedSupa
      .from("users")
      .select("id, name, metadata")
      .eq("clinic_id", clinicId)
      .eq("role", "patient")
      .limit(100);

    if (data) {
      birthdayPatients = (
        data as { id: string; name: string; metadata: Record<string, unknown> | null }[]
      )
        .filter((p) => {
          const dob = p.metadata?.date_of_birth;
          if (typeof dob !== "string") return false;
          const birth = new Date(dob);
          const thisYear = new Date(now.getFullYear(), birth.getMonth(), birth.getDate());
          const diff = thisYear.getTime() - now.getTime();
          return diff >= 0 && diff <= 30 * 24 * 60 * 60 * 1000;
        })
        .map((p) => ({ id: p.id, name: p.name ?? "Inconnu" }));
    }
  } catch (err) {
    logger.warn("Failed to fetch birthday patients", { context: "ai-team-data", error: err });
  }

  return {
    inactivePatients: (inactivePatients.data ?? []).map((p) => ({
      name: p.name ?? "Inconnu",
      lastActivity: p.updated_at,
    })),
    inactivePatientsCount: (inactivePatients.data ?? []).length,
    newPatientsThisMonth: newPatients.count ?? 0,
    totalPatients: totalPatients.count ?? 0,
    recentCompletedAppointments: (recentAppointments.data ?? []).length,
    birthdayPatients,
    birthdayPatientsCount: birthdayPatients.length,
  };
}

export function buildMarketingDataContext(
  data: Awaited<ReturnType<typeof fetchMarketingData>>,
): string {
  const parts: string[] = [];
  parts.push("DONNÉES MARKETING:");
  parts.push(`- Patients inactifs (3+ mois): ${data.inactivePatientsCount}`);
  if (data.inactivePatients.length > 0) {
    parts.push(
      `- Exemples: ${data.inactivePatients
        .slice(0, 5)
        .map((p) => p.name)
        .join(", ")}`,
    );
  }
  parts.push(`- Nouveaux patients ce mois: ${data.newPatientsThisMonth}`);
  parts.push(`- Total patients: ${data.totalPatients}`);
  parts.push(`- RDV complétés cette semaine: ${data.recentCompletedAppointments}`);
  parts.push(`- Patients anniversaire (30j): ${data.birthdayPatientsCount}`);
  if (data.birthdayPatients.length > 0) {
    parts.push(
      `- Anniversaires: ${data.birthdayPatients
        .slice(0, 5)
        .map((p) => p.name)
        .join(", ")}`,
    );
  }
  return parts.join("\n");
}

export async function fetchSupportData(supabase: Supabase, clinicId: string) {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const untypedSupa = supabase as unknown as SupabaseUntyped;

  let npsScores: { score: number; created_at: string }[] = [];
  try {
    const { data } = await untypedSupa
      .from("nps_surveys")
      .select("score, created_at")
      .eq("clinic_id", clinicId)
      .not("score", "is", null)
      .order("created_at", { ascending: false })
      .limit(50);
    npsScores = (data ?? []) as { score: number; created_at: string }[];
  } catch (err) {
    logger.warn("Failed to fetch NPS scores", { context: "ai-team-data", error: err });
  }

  const [waitingQueue, recentAppointments] = await Promise.all([
    (async () => {
      try {
        const { data } = await untypedSupa
          .from("waiting_queue")
          .select("id, status, checked_in_at, estimated_wait_minutes")
          .eq("clinic_id", clinicId)
          .in("status", ["waiting", "called"])
          .limit(20);
        return (data ?? []) as {
          id: string;
          status: string;
          checked_in_at: string;
          estimated_wait_minutes: number;
        }[];
      } catch {
        return [];
      }
    })(),
    supabase
      .from("appointments")
      .select("id, status, appointment_date")
      .eq("clinic_id", clinicId)
      .eq("status", "no_show")
      .gte("appointment_date", startOfWeek.toISOString().split("T")[0])
      .limit(20),
  ]);

  const avgNps =
    npsScores.length > 0 ? npsScores.reduce((sum, s) => sum + s.score, 0) / npsScores.length : null;

  const promoters = npsScores.filter((s) => s.score >= 9).length;
  const detractors = npsScores.filter((s) => s.score <= 6).length;
  const npsScore =
    npsScores.length > 0 ? Math.round(((promoters - detractors) / npsScores.length) * 100) : null;

  const longWaiting = waitingQueue.filter((q) => {
    const waitMs = now.getTime() - new Date(q.checked_in_at).getTime();
    return waitMs > 2 * 60 * 60 * 1000;
  });

  return {
    npsScore,
    avgNps: avgNps ? avgNps.toFixed(1) : "N/A",
    totalNpsResponses: npsScores.length,
    promoters,
    detractors,
    waitingQueueCount: waitingQueue.length,
    longWaitingCount: longWaiting.length,
    noShowsThisWeek: (recentAppointments.data ?? []).length,
  };
}

export function buildSupportDataContext(
  data: Awaited<ReturnType<typeof fetchSupportData>>,
): string {
  const parts: string[] = [];
  parts.push("DONNÉES SUPPORT:");
  parts.push(`- Score NPS: ${data.npsScore ?? "N/A"}`);
  parts.push(`- NPS moyen: ${data.avgNps}`);
  parts.push(`- Réponses NPS: ${data.totalNpsResponses}`);
  parts.push(`- Promoteurs: ${data.promoters}, Détracteurs: ${data.detractors}`);
  parts.push(`- File d'attente active: ${data.waitingQueueCount}`);
  parts.push(`- Patients en attente > 2h: ${data.longWaitingCount}`);
  parts.push(`- No-shows cette semaine: ${data.noShowsThisWeek}`);
  return parts.join("\n");
}

export async function fetchReminderData(supabase: Supabase, clinicId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const [todayAppointments, upcomingAppointments, revenueThisMonth, pendingAppointments] =
    await Promise.all([
      supabase
        .from("appointments")
        .select("id, status, appointment_date, start_time, doctor_id", { count: "exact" })
        .eq("clinic_id", clinicId)
        .eq("appointment_date", now.toISOString().split("T")[0]),

      supabase
        .from("appointments")
        .select("id, status, appointment_date")
        .eq("clinic_id", clinicId)
        .gte("appointment_date", tomorrow.toISOString().split("T")[0])
        .lte("appointment_date", nextWeek.toISOString().split("T")[0])
        .eq("status", "confirmed"),

      supabase
        .from("billing_events")
        .select("amount, type")
        .eq("clinic_id", clinicId)
        .eq("type", "payment_received")
        .gte("created_at", startOfMonth.toISOString()),

      supabase
        .from("appointments")
        .select("id", { count: "exact" })
        .eq("clinic_id", clinicId)
        .eq("status", "pending"),
    ]);

  const revenueTotal = (revenueThisMonth.data ?? []).reduce((sum, e) => sum + (e.amount ?? 0), 0);

  const todayData = todayAppointments.data ?? [];
  const confirmedToday = todayData.filter((a) => a.status === "confirmed").length;
  const pendingToday = todayData.filter((a) => a.status === "pending").length;

  return {
    todayTotal: todayAppointments.count ?? 0,
    todayConfirmed: confirmedToday,
    todayPending: pendingToday,
    upcomingWeekCount: (upcomingAppointments.data ?? []).length,
    revenueThisMonth: formatCurrency(revenueTotal),
    revenueRaw: revenueTotal,
    totalPendingAppointments: pendingAppointments.count ?? 0,
  };
}

export function buildReminderDataContext(
  data: Awaited<ReturnType<typeof fetchReminderData>>,
): string {
  const parts: string[] = [];
  parts.push("DONNÉES TÂCHES/RAPPELS:");
  parts.push(
    `- RDV aujourd'hui: ${data.todayTotal} (${data.todayConfirmed} confirmés, ${data.todayPending} en attente)`,
  );
  parts.push(`- RDV semaine prochaine: ${data.upcomingWeekCount}`);
  parts.push(`- Revenus ce mois: ${data.revenueThisMonth}`);
  parts.push(`- RDV en attente d'approbation: ${data.totalPendingAppointments}`);
  return parts.join("\n");
}
