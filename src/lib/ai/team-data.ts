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

// ── Phase C1: AI Team Task State Machine ──

export const TASK_STATUSES = [
  "backlog",
  "in_progress",
  "review",
  "changes_requested",
  "done",
  "cancelled",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** Legal transitions: from → allowed targets */
const TRANSITION_MAP: Record<TaskStatus, readonly TaskStatus[]> = {
  backlog: ["in_progress", "cancelled"],
  in_progress: ["review", "cancelled"],
  review: ["done", "changes_requested", "cancelled"],
  changes_requested: ["in_progress", "cancelled"],
  done: [],
  cancelled: [],
};

/** Max review cycles before escalation to human */
const MAX_REVIEW_CYCLES = 2;

export interface TaskHistoryEvent {
  type: "created" | "transitioned" | "review_submitted" | "escalated" | "handoff";
  actor: string;
  at: string;
  payload: Record<string, unknown>;
}

export interface TransitionResult {
  ok: true;
  newStatus: TaskStatus;
  escalated: boolean;
}

export interface TransitionError {
  ok: false;
  code: "ILLEGAL_TRANSITION" | "TASK_NOT_FOUND" | "OPTIMISTIC_CONFLICT" | "MAX_CYCLES_EXCEEDED";
  message: string;
}

/**
 * Validate a status transition is legal.
 * Returns the target status or throws with a descriptive message.
 */
export function validateTransition(
  from: TaskStatus,
  to: TaskStatus,
): { valid: true } | { valid: false; message: string } {
  const allowed = TRANSITION_MAP[from];
  if (!allowed || !allowed.includes(to)) {
    return {
      valid: false,
      message: `Illegal transition: ${from} → ${to}. Allowed: ${(allowed ?? []).join(", ") || "none (terminal state)"}`,
    };
  }
  return { valid: true };
}

/**
 * Build a history event object.
 */
export function buildHistoryEvent(
  type: TaskHistoryEvent["type"],
  actor: string,
  payload: Record<string, unknown> = {},
): TaskHistoryEvent {
  return { type, actor, at: new Date().toISOString(), payload };
}

/**
 * Transition an AI team task to a new status with optimistic concurrency.
 * Appends a history event atomically.
 *
 * Returns the updated task or an error object.
 */
export async function transitionTask(
  supabase: SupabaseUntyped,
  taskId: string,
  clinicId: string,
  fromStatus: TaskStatus,
  toStatus: TaskStatus,
  actor: string,
  opts: { reviewComments?: string; output?: Record<string, unknown> } = {},
): Promise<TransitionResult | TransitionError> {
  const validation = validateTransition(fromStatus, toStatus);
  if (!validation.valid) {
    return { ok: false, code: "ILLEGAL_TRANSITION", message: validation.message };
  }

  // Fetch current task for optimistic check
  const { data: current, error: fetchErr } = await supabase
    .from("ai_team_tasks")
    .select("id, status, review_cycles, history_events")
    .eq("id", taskId)
    .eq("clinic_id", clinicId)
    .single();

  if (fetchErr || !current) {
    return { ok: false, code: "TASK_NOT_FOUND", message: "Task not found or access denied" };
  }

  const task = current as {
    id: string;
    status: string;
    review_cycles: number;
    history_events: TaskHistoryEvent[];
  };

  if (task.status !== fromStatus) {
    return {
      ok: false,
      code: "OPTIMISTIC_CONFLICT",
      message: `Expected status '${fromStatus}' but found '${task.status}'`,
    };
  }

  // Check max review cycles for changes_requested → in_progress
  let escalated = false;
  let effectiveStatus = toStatus;
  const newCycles = toStatus === "review" ? task.review_cycles + 1 : task.review_cycles;

  if (toStatus === "review" && newCycles > MAX_REVIEW_CYCLES) {
    // Escalate: don't transition to review, keep in_progress for human intervention
    escalated = true;
    effectiveStatus = "review"; // Still goes to review but flagged as escalated
  }

  const event = buildHistoryEvent(
    toStatus === "review" ? "review_submitted" : escalated ? "escalated" : "transitioned",
    actor,
    {
      from: fromStatus,
      to: effectiveStatus,
      ...(opts.reviewComments ? { comments: opts.reviewComments } : {}),
      ...(escalated ? { escalated: true, reason: "max_review_cycles_exceeded" } : {}),
    },
  );

  const updatedEvents = [...(task.history_events ?? []), event];

  const updateData: Record<string, unknown> = {
    status: effectiveStatus,
    review_cycles: newCycles,
    history_events: updatedEvents,
    updated_at: new Date().toISOString(),
  };

  if (opts.reviewComments !== undefined) {
    updateData.review_comments = opts.reviewComments;
  }
  if (opts.output !== undefined) {
    updateData.output = opts.output;
  }

  // Optimistic concurrency: only update if status hasn't changed
  const { error: updateErr } = await supabase
    .from("ai_team_tasks")
    .update(updateData)
    .eq("id", taskId)
    .eq("clinic_id", clinicId)
    .eq("status", fromStatus);

  if (updateErr) {
    logger.error("Task transition update failed", {
      context: "ai-team-tasks",
      taskId,
      error: updateErr,
    });
    return { ok: false, code: "OPTIMISTIC_CONFLICT", message: "Concurrent update detected" };
  }

  return { ok: true, newStatus: effectiveStatus, escalated };
}

/**
 * Create a new AI team task.
 */
export async function createTeamTask(
  supabase: SupabaseUntyped,
  clinicId: string,
  params: {
    title: string;
    description?: string;
    agentType: string;
    reviewerAgentType?: string;
    createdBy?: string;
    sourceTaskId?: string;
  },
): Promise<{ id: string } | null> {
  const event = buildHistoryEvent("created", params.createdBy ?? "system", {
    agentType: params.agentType,
  });

  const { data, error } = await supabase
    .from("ai_team_tasks")
    .insert({
      clinic_id: clinicId,
      title: params.title,
      description: params.description ?? null,
      agent_type: params.agentType,
      status: "backlog",
      reviewer_agent_type: params.reviewerAgentType ?? null,
      created_by: params.createdBy ?? null,
      source_task_id: params.sourceTaskId ?? null,
      history_events: [event],
    })
    .select("id")
    .single();

  if (error || !data) {
    logger.error("Failed to create AI team task", {
      context: "ai-team-tasks",
      clinicId,
      error,
    });
    return null;
  }

  return data as { id: string };
}
