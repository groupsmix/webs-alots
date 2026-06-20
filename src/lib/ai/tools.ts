import type { SupabaseClient } from "@supabase/supabase-js";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { getLocalDateStr } from "@/lib/utils";
import {
  lookupDrugInteraction,
  formatDrugInteractionForTool,
  formatDrugInteractionNotFound,
} from "./knowledge/loader";
import type { SiteTeamAgentType } from "./prompts";
import { createTeamTask, buildHistoryEvent } from "./team-data";

export interface AgentToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface AgentToolContext {
  supabase: SupabaseClient;
  clinicId: string | null;
  userId: string;
  profileId: string;
  userRole: string;
  agentType: SiteTeamAgentType;
}

type ToolInput = Record<string, unknown>;

type ToolResult = { ok: true; data: unknown } | { ok: false; error: string; code?: string };

const READONLY_NOTICE =
  "Cet outil est en lecture seule. Confirmez avec un humain avant toute modification de données.";

const commonTools: AgentToolDefinition[] = [
  {
    name: "get_clinic_info",
    description:
      "Get general information about this clinic: name, address, phone, type and active services",
    input_schema: { type: "object", properties: {} },
  },
];

const doctorTools: AgentToolDefinition[] = [
  ...commonTools,
  {
    name: "get_today_appointments",
    description: "Get today's appointment list for this doctor",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Date in YYYY-MM-DD format. Defaults to today." },
      },
    },
  },
  {
    name: "lookup_patient",
    description: "Look up a patient by name or phone number within the current clinic",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Patient name or phone number" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_drug_info",
    description:
      "Look up a known drug-drug interaction from the Oltigo Clinical Knowledge Pack. " +
      "Returns severity, mechanism, consequence, and recommendation with a pack version citation. " +
      "A 'not found' result does NOT mean the combination is safe — always recommend pharmacist review for unknown pairs.",
    input_schema: {
      type: "object",
      properties: {
        drug_a: {
          type: "string",
          description: "First drug name (generic or brand name, e.g. 'warfarin', 'aspirine')",
        },
        drug_b: {
          type: "string",
          description: "Second drug name (generic or brand name, e.g. 'ibuprofène', 'rifampicin')",
        },
      },
      required: ["drug_a", "drug_b"],
    },
  },
];

// ── C2: Handoff tool (admin + secretary only, never patient) ──

const HANDOFF_ALLOWED_SOURCES: SiteTeamAgentType[] = ["clinic_admin", "secretary", "receptionist"];
const HANDOFF_ALLOWED_TARGETS: SiteTeamAgentType[] = [
  "doctor",
  "secretary",
  "clinic_admin",
  "super_admin",
];

const handoffTool: AgentToolDefinition = {
  name: "handoff_to_agent",
  description:
    "Delegate a subtask to another agent type. Creates a durable task in the queue — does NOT call the agent directly. Use when the question is outside your expertise.",
  input_schema: {
    type: "object",
    properties: {
      target_agent_type: {
        type: "string",
        enum: ["doctor", "secretary", "clinic_admin", "super_admin"],
        description: "The agent type to hand off to",
      },
      task_summary: {
        type: "string",
        description: "Brief title/summary of what needs to be done",
      },
      context: {
        type: "string",
        description: "Relevant context for the target agent (do NOT include patient names or PHI)",
      },
    },
    required: ["target_agent_type", "task_summary"],
  },
};

const secretaryTools: AgentToolDefinition[] = [
  ...commonTools,
  {
    name: "get_today_appointments",
    description: "Get today's appointment list for the clinic",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Date in YYYY-MM-DD format. Defaults to today." },
      },
    },
  },
  {
    name: "check_slot_availability",
    description: "Check if a time slot is available for booking",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Date in YYYY-MM-DD format" },
        time: { type: "string", description: "Time in HH:MM format" },
        doctor_id: { type: "string", description: "Optional doctor UUID" },
      },
      required: ["date", "time"],
    },
  },
  {
    name: "draft_whatsapp_reminder",
    description: "Draft a WhatsApp appointment reminder message without sending it",
    input_schema: {
      type: "object",
      properties: {
        patient_name: { type: "string" },
        appointment_date: { type: "string" },
        appointment_time: { type: "string" },
        doctor_name: { type: "string" },
      },
      required: ["patient_name", "appointment_date", "appointment_time"],
    },
  },
];

const superAdminTools: AgentToolDefinition[] = [
  {
    name: "get_platform_stats",
    description: "Get aggregate platform-wide statistics: clinics, users and appointments",
    input_schema: {
      type: "object",
      properties: {
        period: { type: "string", enum: ["today", "week", "month", "year"] },
      },
    },
  },
  {
    name: "get_clinic_performance",
    description: "Get aggregate performance metrics for one clinic or all clinics",
    input_schema: {
      type: "object",
      properties: {
        clinic_id: { type: "string", description: "Optional clinic UUID. Omit for all clinics." },
        metric: { type: "string", enum: ["revenue", "appointments", "retention", "all"] },
      },
    },
  },
  {
    name: "run_analytics_query",
    description: "Run a pre-approved analytics query on aggregate clinic data",
    input_schema: {
      type: "object",
      properties: {
        query_type: {
          type: "string",
          enum: [
            "top_clinics_by_revenue",
            "busiest_hours_today",
            "no_show_rate_by_clinic",
            "new_clinics_this_month",
            "top_at_risk_clinics",
          ],
        },
      },
      required: ["query_type"],
    },
  },
];

const patientTools: AgentToolDefinition[] = [
  ...commonTools,
  {
    name: "get_my_appointments",
    description: "Get this patient's upcoming appointments",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_available_slots",
    description: "Get available appointment slots for a given week",
    input_schema: {
      type: "object",
      properties: {
        week_start: { type: "string", description: "Week start date in YYYY-MM-DD format" },
        doctor_id: { type: "string", description: "Optional doctor UUID" },
      },
    },
  },
];

export function getAgentTools(agentType: SiteTeamAgentType): AgentToolDefinition[] {
  const toolMap: Record<SiteTeamAgentType, AgentToolDefinition[]> = {
    doctor: doctorTools,
    secretary: [...secretaryTools, handoffTool],
    receptionist: [...secretaryTools, handoffTool],
    super_admin: superAdminTools,
    clinic_admin: [...doctorTools, ...secretaryTools, superAdminTools[1], handoffTool],
    patient: patientTools,
  };

  return dedupeTools(toolMap[agentType] ?? commonTools);
}

export async function executeAgentTool(
  name: string,
  input: ToolInput,
  ctx: AgentToolContext,
): Promise<ToolResult> {
  if (!isToolAllowedForAgent(name, ctx.agentType)) {
    return { ok: false, error: "Tool not allowed for this agent role", code: "TOOL_FORBIDDEN" };
  }

  if (ctx.agentType !== "super_admin" && !ctx.clinicId) {
    return { ok: false, error: "Tenant context is required", code: "NO_CLINIC" };
  }

  switch (name) {
    case "get_clinic_info":
      return getClinicInfo(ctx);
    case "get_today_appointments":
      return getTodayAppointments(input, ctx);
    case "lookup_patient":
      return lookupPatient(input, ctx);
    case "get_drug_info":
      return getDrugInfo(input);
    case "check_slot_availability":
      return checkSlotAvailability(input, ctx);
    case "draft_whatsapp_reminder":
      return draftWhatsAppReminder(input);
    case "get_platform_stats":
      return getPlatformStats(input, ctx);
    case "get_clinic_performance":
      return getClinicPerformance(input, ctx);
    case "run_analytics_query":
      return runAnalyticsQuery(input, ctx);
    case "get_my_appointments":
      return getMyAppointments(ctx);
    case "get_available_slots":
      return getAvailableSlots(input, ctx);
    case "handoff_to_agent":
      return handoffToAgent(input, ctx);
    default:
      return { ok: false, error: `Unknown tool: ${name}`, code: "UNKNOWN_TOOL" };
  }
}

function dedupeTools(tools: AgentToolDefinition[]): AgentToolDefinition[] {
  const seen = new Set<string>();
  return tools.filter((tool) => {
    if (seen.has(tool.name)) return false;
    seen.add(tool.name);
    return true;
  });
}

function isToolAllowedForAgent(name: string, agentType: SiteTeamAgentType): boolean {
  return getAgentTools(agentType).some((tool) => tool.name === name);
}

function stringInput(input: ToolInput, key: string): string | null {
  const value = input[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function startOfPeriod(period: string): string {
  const now = new Date();
  const start = new Date(now);
  if (period === "today") start.setHours(0, 0, 0, 0);
  else if (period === "week") start.setDate(now.getDate() - 7);
  else if (period === "year") start.setFullYear(now.getFullYear() - 1);
  else start.setMonth(now.getMonth() - 1);
  return start.toISOString();
}

async function getClinicInfo(ctx: AgentToolContext): Promise<ToolResult> {
  if (!ctx.clinicId) return { ok: false, error: "Clinic context is required", code: "NO_CLINIC" };

  const [clinicRes, servicesRes, doctorsRes] = await Promise.all([
    ctx.supabase
      .from("clinics")
      .select("id, name, type, address, city, phone, status, tier")
      .eq("id", ctx.clinicId)
      .single(),
    ctx.supabase
      .from("services")
      .select("id, name, price, duration_minutes, category")
      .eq("clinic_id", ctx.clinicId)
      .eq("is_active", true)
      .limit(20),
    ctx.supabase
      .from("users")
      .select("id, name, role")
      .eq("clinic_id", ctx.clinicId)
      .eq("role", "doctor")
      .eq("is_active", true)
      .limit(20),
  ]);

  if (clinicRes.error) return { ok: false, error: "Clinic not found", code: "CLINIC_NOT_FOUND" };

  return {
    ok: true,
    data: {
      clinic: clinicRes.data,
      services: servicesRes.data ?? [],
      doctors: doctorsRes.data ?? [],
      notice: READONLY_NOTICE,
    },
  };
}

async function getTodayAppointments(input: ToolInput, ctx: AgentToolContext): Promise<ToolResult> {
  if (!ctx.clinicId) return { ok: false, error: "Clinic context is required", code: "NO_CLINIC" };
  const requestedDate = stringInput(input, "date");
  const date = requestedDate && isDateString(requestedDate) ? requestedDate : getLocalDateStr();

  let query = ctx.supabase
    .from("appointments")
    .select(
      "id, appointment_date, start_time, end_time, slot_start, slot_end, status, patient_id, doctor_id, service_id, patients:users!appointments_patient_id_fkey(id, name, phone), doctors:users!appointments_doctor_id_fkey(id, name), services(id, name)",
    )
    .eq("clinic_id", ctx.clinicId)
    .eq("appointment_date", date)
    .order("slot_start", { ascending: true })
    .limit(50);

  if (ctx.agentType === "doctor") {
    query = query.eq("doctor_id", ctx.profileId);
  }

  const { data, error } = await query;
  if (error) return { ok: false, error: "Failed to load appointments", code: "APPOINTMENTS_ERROR" };

  return { ok: true, data: { date, appointments: data ?? [], notice: READONLY_NOTICE } };
}

async function lookupPatient(input: ToolInput, ctx: AgentToolContext): Promise<ToolResult> {
  if (!ctx.clinicId) return { ok: false, error: "Clinic context is required", code: "NO_CLINIC" };
  const query = stringInput(input, "query");
  if (!query || query.length < 2) {
    return { ok: false, error: "Patient search query is required", code: "VALIDATION_ERROR" };
  }

  const [byName, byPhone] = await Promise.all([
    ctx.supabase
      .from("users")
      .select("id, name, phone, email, created_at")
      .eq("clinic_id", ctx.clinicId)
      .eq("role", "patient")
      .ilike("name", `%${query}%`)
      .limit(10),
    ctx.supabase
      .from("users")
      .select("id, name, phone, email, created_at")
      .eq("clinic_id", ctx.clinicId)
      .eq("role", "patient")
      .ilike("phone", `%${query}%`)
      .limit(10),
  ]);

  if (byName.error || byPhone.error) {
    return { ok: false, error: "Failed to search patients", code: "PATIENT_SEARCH_ERROR" };
  }

  const patientsById = new Map<string, unknown>();
  for (const patient of [...(byName.data ?? []), ...(byPhone.data ?? [])]) {
    patientsById.set(patient.id, patient);
  }

  return { ok: true, data: { patients: [...patientsById.values()], notice: READONLY_NOTICE } };
}

async function checkSlotAvailability(input: ToolInput, ctx: AgentToolContext): Promise<ToolResult> {
  if (!ctx.clinicId) return { ok: false, error: "Clinic context is required", code: "NO_CLINIC" };
  const date = stringInput(input, "date");
  const time = stringInput(input, "time");
  const doctorId = stringInput(input, "doctor_id");

  if (!date || !isDateString(date) || !time || !/^\d{2}:\d{2}$/.test(time)) {
    return {
      ok: false,
      error: "date YYYY-MM-DD and time HH:MM are required",
      code: "VALIDATION_ERROR",
    };
  }

  let query = ctx.supabase
    .from("appointments")
    .select("id, status, doctor_id")
    .eq("clinic_id", ctx.clinicId)
    .eq("appointment_date", date)
    .eq("start_time", time)
    .in("status", ["pending", "confirmed", "checked_in", "in_progress"]);

  if (doctorId) query = query.eq("doctor_id", doctorId);

  const { data, error } = await query.limit(5);
  if (error)
    return { ok: false, error: "Failed to check availability", code: "AVAILABILITY_ERROR" };

  return {
    ok: true,
    data: {
      date,
      time,
      doctorId,
      available: (data ?? []).length === 0,
      conflicts: data ?? [],
      notice: READONLY_NOTICE,
    },
  };
}

function getDrugInfo(input: ToolInput): ToolResult {
  const drugA = stringInput(input, "drug_a");
  const drugB = stringInput(input, "drug_b");

  if (!drugA || !drugB) {
    return {
      ok: false,
      error: "drug_a and drug_b are both required",
      code: "VALIDATION_ERROR",
    };
  }

  const interaction = lookupDrugInteraction(drugA, drugB);

  return {
    ok: true,
    data: {
      found: interaction !== null,
      severity: interaction?.severity ?? null,
      formatted: interaction
        ? formatDrugInteractionForTool(interaction)
        : formatDrugInteractionNotFound(drugA, drugB),
      notice:
        "Les informations sur les interactions médicamenteuses sont fournies à titre indicatif. " +
        "Consultez toujours un pharmacien ou une source de référence complète avant de prescrire.",
    },
  };
}

function draftWhatsAppReminder(input: ToolInput): ToolResult {
  const patientName = stringInput(input, "patient_name");
  const appointmentDate = stringInput(input, "appointment_date");
  const appointmentTime = stringInput(input, "appointment_time");
  const doctorName = stringInput(input, "doctor_name") ?? "votre médecin";

  if (!patientName || !appointmentDate || !appointmentTime) {
    return {
      ok: false,
      error: "patient_name, appointment_date and appointment_time are required",
      code: "VALIDATION_ERROR",
    };
  }

  return {
    ok: true,
    data: {
      message: `Bonjour ${patientName}, rappel de votre rendez-vous le ${appointmentDate} à ${appointmentTime} avec ${doctorName}. Merci de confirmer votre présence. — Clinique Oltigo`,
      language: "fr",
      sent: false,
      notice: "Brouillon uniquement: aucun message n'a été envoyé.",
    },
  };
}

async function getPlatformStats(input: ToolInput, ctx: AgentToolContext): Promise<ToolResult> {
  if (ctx.userRole !== "super_admin") {
    return { ok: false, error: "Super admin only", code: "FORBIDDEN" };
  }
  const period = stringInput(input, "period") ?? "month";
  const since = startOfPeriod(period);

  const [clinics, newClinics, users, appointments] = await Promise.all([
    ctx.supabase.from("clinics").select("id", { count: "exact", head: true }),
    ctx.supabase
      .from("clinics")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since),
    // Platform-wide aggregates: super_admin-gated, count-only (head: true), no row data.
    ctx.supabase.from("users").select("id", { count: "exact", head: true }), // nosemgrep: semgrep.tenant-scoping
    ctx.supabase // nosemgrep: semgrep.tenant-scoping
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since),
  ]);

  return {
    ok: true,
    data: {
      period,
      totalClinics: clinics.count ?? 0,
      newClinics: newClinics.count ?? 0,
      totalUsers: users.count ?? 0,
      appointmentsInPeriod: appointments.count ?? 0,
      aggregatedOnly: true,
    },
  };
}

async function getClinicPerformance(input: ToolInput, ctx: AgentToolContext): Promise<ToolResult> {
  if (ctx.agentType !== "clinic_admin" && ctx.userRole !== "super_admin") {
    return { ok: false, error: "Not allowed", code: "FORBIDDEN" };
  }

  const requestedClinicId = stringInput(input, "clinic_id");
  const clinicId = ctx.userRole === "super_admin" ? requestedClinicId : ctx.clinicId;
  const metric = stringInput(input, "metric") ?? "all";

  if (clinicId) {
    const [appointments, revenue, patients] = await Promise.all([
      ctx.supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId),
      ctx.supabase
        .from("billing_events")
        .select("amount, type")
        .eq("clinic_id", clinicId)
        .eq("type", "payment_received"),
      ctx.supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId)
        .eq("role", "patient"),
    ]);

    const revenueMad = ((revenue.data ?? []) as Array<{ amount: number | null }>).reduce(
      (sum: number, row) => sum + (row.amount ?? 0),
      0,
    );
    return {
      ok: true,
      data: {
        clinicId,
        metric,
        appointments: appointments.count ?? 0,
        revenueMad,
        patients: patients.count ?? 0,
        aggregatedOnly: true,
      },
    };
  }

  const { data, error } = await ctx.supabase
    .from("clinics")
    .select("id, name, status, tier, created_at")
    .order("created_at", { ascending: false })
    .limit(25);

  if (error)
    return { ok: false, error: "Failed to load clinic performance", code: "PERFORMANCE_ERROR" };
  return { ok: true, data: { metric, clinics: data ?? [], aggregatedOnly: true } };
}

async function runAnalyticsQuery(input: ToolInput, ctx: AgentToolContext): Promise<ToolResult> {
  if (ctx.userRole !== "super_admin") {
    return { ok: false, error: "Super admin only", code: "FORBIDDEN" };
  }

  const queryType = stringInput(input, "query_type");
  if (!queryType) return { ok: false, error: "query_type is required", code: "VALIDATION_ERROR" };

  if (queryType === "new_clinics_this_month") {
    const since = startOfPeriod("month");
    const { data, error } = await ctx.supabase
      .from("clinics")
      .select("id, name, type, tier, status, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return { ok: false, error: "Analytics query failed", code: "ANALYTICS_ERROR" };
    return { ok: true, data: { queryType, clinics: data ?? [], aggregatedOnly: true } };
  }

  if (queryType === "busiest_hours_today") {
    const today = getLocalDateStr();
    // Platform-wide hour histogram: super_admin-gated, aggregatedOnly output.
    const { data, error } = await ctx.supabase // nosemgrep: semgrep.tenant-scoping
      .from("appointments")
      .select("start_time")
      .eq("appointment_date", today)
      .limit(500);
    if (error) return { ok: false, error: "Analytics query failed", code: "ANALYTICS_ERROR" };
    const hours = new Map<string, number>();
    for (const row of data ?? []) {
      const hour = row.start_time?.slice(0, 2) ?? "unknown";
      hours.set(hour, (hours.get(hour) ?? 0) + 1);
    }
    return {
      ok: true,
      data: {
        queryType,
        date: today,
        hours: [...hours.entries()].map(([hour, count]) => ({ hour, count })),
        aggregatedOnly: true,
      },
    };
  }

  if (queryType === "top_at_risk_clinics") {
    const sql = `
WITH latest_scores AS (
  SELECT DISTINCT ON (clinic_id)
    clinic_id,
    score,
    grade,
    churn_risk,
    trend,
    top_risk_signal,
    computed_at
  FROM clinic_health_scores
  ORDER BY clinic_id, computed_at DESC
)
SELECT
  c.id,
  c.name,
  c.tier,
  c.status,
  ls.score,
  ls.grade,
  ls.churn_risk,
  ls.trend,
  ls.top_risk_signal,
  ls.computed_at
FROM latest_scores ls
JOIN clinics c ON c.id = ls.clinic_id
WHERE c.deleted_at IS NULL
ORDER BY ls.score ASC, ls.computed_at DESC
LIMIT 10`;

    const { data, error } = await ctx.supabase.rpc("execute_admin_query", { p_sql: sql });
    if (error) return { ok: false, error: "Analytics query failed", code: "ANALYTICS_ERROR" };

    return {
      ok: true,
      data: {
        queryType,
        clinics: Array.isArray(data) ? data : [],
        aggregatedOnly: true,
      },
    };
  }

  return {
    ok: true,
    data: {
      queryType,
      message:
        "Cette requête analytique pré-approuvée n'a pas encore de calcul spécialisé. Utilisez les statistiques plateforme ou performance clinique disponibles.",
      aggregatedOnly: true,
    },
  };
}

async function getMyAppointments(ctx: AgentToolContext): Promise<ToolResult> {
  if (!ctx.clinicId) return { ok: false, error: "Clinic context is required", code: "NO_CLINIC" };
  const now = new Date().toISOString();
  const { data, error } = await ctx.supabase
    .from("appointments")
    .select(
      "id, appointment_date, start_time, end_time, slot_start, slot_end, status, doctors:users!appointments_doctor_id_fkey(id, name), services(id, name)",
    )
    .eq("clinic_id", ctx.clinicId)
    .eq("patient_id", ctx.profileId)
    .gte("slot_start", now)
    .order("slot_start", { ascending: true })
    .limit(10);

  if (error) return { ok: false, error: "Failed to load appointments", code: "APPOINTMENTS_ERROR" };
  return { ok: true, data: { appointments: data ?? [], notice: READONLY_NOTICE } };
}

async function getAvailableSlots(input: ToolInput, ctx: AgentToolContext): Promise<ToolResult> {
  if (!ctx.clinicId) return { ok: false, error: "Clinic context is required", code: "NO_CLINIC" };
  const weekStart = stringInput(input, "week_start") ?? getLocalDateStr();
  const doctorId = stringInput(input, "doctor_id");
  if (!isDateString(weekStart)) {
    return { ok: false, error: "week_start must be YYYY-MM-DD", code: "VALIDATION_ERROR" };
  }

  let query = ctx.supabase
    .from("time_slots")
    .select("id, doctor_id, day_of_week, start_time, end_time, is_available")
    .eq("clinic_id", ctx.clinicId)
    .eq("is_available", true)
    .limit(50);

  if (doctorId) query = query.eq("doctor_id", doctorId);

  const { data, error } = await query;
  if (error) return { ok: false, error: "Failed to load available slots", code: "SLOTS_ERROR" };

  return {
    ok: true,
    data: {
      weekStart,
      doctorId,
      recurringAvailability: data ?? [],
      notice:
        "Disponibilités indicatives basées sur le planning récurrent; vérifier les rendez-vous existants avant confirmation.",
    },
  };
}

// ── C2: Agent-to-agent handoff ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedClient = { from(table: string): any };

async function handoffToAgent(input: ToolInput, ctx: AgentToolContext): Promise<ToolResult> {
  if (!ctx.clinicId) return { ok: false, error: "Clinic context is required", code: "NO_CLINIC" };

  const targetType = stringInput(input, "target_agent_type") as SiteTeamAgentType | null;
  const taskSummary = stringInput(input, "task_summary");
  const context = stringInput(input, "context");

  if (!targetType || !taskSummary) {
    return {
      ok: false,
      error: "target_agent_type and task_summary are required",
      code: "VALIDATION_ERROR",
    };
  }

  // Guard: only allowed sources
  if (!HANDOFF_ALLOWED_SOURCES.includes(ctx.agentType)) {
    return {
      ok: false,
      error: "This agent type cannot initiate handoffs",
      code: "HANDOFF_FORBIDDEN",
    };
  }

  // Guard: patient can never be target
  if (!HANDOFF_ALLOWED_TARGETS.includes(targetType)) {
    return {
      ok: false,
      error: `Cannot hand off to agent type: ${targetType}`,
      code: "HANDOFF_TARGET_FORBIDDEN",
    };
  }

  // Guard: no self-handoff
  if (targetType === ctx.agentType) {
    return { ok: false, error: "Cannot hand off to the same agent type", code: "HANDOFF_SELF" };
  }

  // Guard: depth max 1 — check if this was already a handoff (source_task_id would be set)
  // We check by looking at the context for a handoff marker
  const isChained = typeof input._source_task_id === "string";
  if (isChained) {
    return {
      ok: false,
      error: "Handoff depth max 1: cannot chain handoffs",
      code: "HANDOFF_DEPTH_EXCEEDED",
    };
  }

  const untypedSupa = ctx.supabase as unknown as UntypedClient;

  const result = await createTeamTask(untypedSupa, ctx.clinicId, {
    title: taskSummary.slice(0, 255),
    description: context?.slice(0, 2000),
    agentType: targetType,
    createdBy: ctx.userId,
  });

  if (!result) {
    return { ok: false, error: "Failed to create handoff task", code: "HANDOFF_CREATE_FAILED" };
  }

  // Append handoff history event
  const event = buildHistoryEvent("handoff", ctx.userId, {
    sourceAgentType: ctx.agentType,
    targetAgentType: targetType,
    taskSummary,
  });

  try {
    await untypedSupa
      .from("ai_team_tasks")
      .update({
        history_events: [event],
      })
      .eq("id", result.id)
      .eq("clinic_id", ctx.clinicId);
  } catch (err) {
    logger.warn("Failed to add handoff event to task history", {
      context: "ai-tools-handoff",
      error: err,
      taskId: result.id,
    });
  }

  // Audit log
  void logAuditEvent({
    supabase: ctx.supabase,
    action: "ai_agent_handoff",
    type: "admin",
    clinicId: ctx.clinicId,
    actor: ctx.userId,
    description: `${ctx.agentType} handed off to ${targetType}: ${taskSummary}`,
    metadata: {
      taskId: result.id,
      sourceAgentType: ctx.agentType,
      targetAgentType: targetType,
    },
  });

  return {
    ok: true,
    data: {
      taskId: result.id,
      targetAgentType: targetType,
      message: `Tâche déléguée à l'agent ${targetType}. Elle apparaîtra dans le tableau de bord.`,
    },
  };
}
