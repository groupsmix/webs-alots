import { NextRequest } from "next/server";
import { apiInternalError, apiSuccess } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { withSentryCron } from "@/lib/sentry-cron";
import { createAdminClient } from "@/lib/supabase-server";
import { sendTextMessage } from "@/lib/whatsapp";

interface BriefingSummary {
  totalAppointments: number;
  cancellations: number;
  waitlistCount: number;
  overduePayments: number;
  birthdays: string[];
  triageStats?: {
    totalTriaged: number;
    byUrgency: Record<string, number>;
    unansweredUrgent: number;
    topTags: string[];
  };
}

interface BriefingConfig {
  clinic_id: string;
  enabled: boolean;
  send_hour: number;
  timezone: string;
  recipient_roles: string[];
  include_appointments: boolean;
  include_cancellations: boolean;
  include_waitlist: boolean;
  include_overdue_payments: boolean;
  include_birthdays: boolean;
}

interface QueryResult {
  data: Array<Record<string, unknown>> | null;
  error: unknown;
}

interface CountResult {
  count: number | null;
  error: unknown;
}

interface SingleResult {
  data: Record<string, unknown> | null;
  error: unknown;
}

interface QueryChain {
  eq(col: string, val: unknown): QueryChain;
  not(col: string, op: string, val: unknown): QueryChain;
  is(col: string, val: null): QueryChain & Promise<QueryResult>;
  in(col: string, val: unknown[]): QueryChain & Promise<QueryResult> & Promise<CountResult>;
  gte(col: string, val: unknown): QueryChain;
  lt(col: string, val: unknown): QueryChain & Promise<CountResult>;
  order(col: string, opts: { ascending: boolean }): QueryChain;
  limit(n: number): QueryChain;
  single(): Promise<SingleResult>;
}

type UntypedClient = {
  from(table: string): {
    select(cols: string): QueryChain;
    select(cols: string, opts: { count: "exact"; head: true }): QueryChain;
    insert(row: Record<string, unknown>): {
      select(): Promise<{ error: { code?: string } | null }>;
    };
  };
};

function formatBriefingMessage(
  clinicName: string,
  date: string,
  summary: BriefingSummary,
  config: BriefingConfig,
): string {
  const lines: string[] = [];
  lines.push(`📋 Briefing du jour — ${clinicName}`);
  lines.push(`📅 ${date}`);
  lines.push("");

  if (config.include_appointments) {
    lines.push(`📊 Rendez-vous aujourd'hui: ${summary.totalAppointments}`);
  }
  if (config.include_cancellations) {
    lines.push(`❌ Annulations: ${summary.cancellations}`);
  }
  if (config.include_waitlist) {
    lines.push(`⏳ Liste d'attente: ${summary.waitlistCount}`);
  }
  if (config.include_overdue_payments) {
    lines.push(`💰 Paiements en retard: ${summary.overduePayments}`);
  }
  if (config.include_birthdays && summary.birthdays.length > 0) {
    lines.push(`🎂 Anniversaires: ${summary.birthdays.join(", ")}`);
  }

  // D2: Triage stats section
  if (summary.triageStats && summary.triageStats.totalTriaged > 0) {
    lines.push("");
    lines.push(`🤖 Triage AI: ${summary.triageStats.totalTriaged} ticket(s)`);
    const urgencyParts = Object.entries(summary.triageStats.byUrgency)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    lines.push(`   Répartition: ${urgencyParts}`);
    if (summary.triageStats.unansweredUrgent > 0) {
      lines.push(`   ⚠️ Urgents non résolus: ${summary.triageStats.unansweredUrgent}`);
    }
    if (summary.triageStats.topTags.length > 0) {
      lines.push(`   Top sujets: ${summary.triageStats.topTags.join(", ")}`);
    }
  }

  lines.push("");
  lines.push("Bonne journée! 🏥");
  return lines.join("\n");
}

function getClinicLocalDate(timezone: string): { todayStr: string; tomorrowStr: string } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayStr = formatter.format(now);

  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStr = formatter.format(tomorrow);

  return { todayStr, tomorrowStr };
}

function getClinicLocalHour(timezone: string): number {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  });
  return parseInt(formatter.format(now), 10);
}

async function gatherBriefingSummary(
  supabase: UntypedClient,
  clinicId: string,
  todayStr: string,
  tomorrowStr: string,
  config: BriefingConfig,
): Promise<BriefingSummary> {
  let totalAppointments = 0;
  let cancellations = 0;
  let waitlistCount = 0;
  let overduePayments = 0;
  const birthdays: string[] = [];

  if (config.include_appointments) {
    const { count } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("appointment_date", todayStr)
      .in("status", ["confirmed", "pending", "scheduled"]);
    totalAppointments = count ?? 0;
  }

  if (config.include_cancellations) {
    const { count } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("appointment_date", todayStr)
      .in("status", ["cancelled"]);
    cancellations = count ?? 0;
  }

  if (config.include_waitlist) {
    const { count } = await supabase
      .from("waiting_list")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .in("status", ["waiting"]);
    waitlistCount = count ?? 0;
  }

  if (config.include_overdue_payments) {
    const { count } = await supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("status", "overdue")
      .gte("due_date", "1970-01-01")
      .lt("due_date", todayStr);
    overduePayments = count ?? 0;
  }

  if (config.include_birthdays) {
    const monthDay = todayStr.slice(5);
    const { data: birthdayPatients } = await supabase
      .from("users")
      .select("name, date_of_birth")
      .eq("clinic_id", clinicId)
      .eq("role", "patient")
      .in("date_of_birth_mmdd", [monthDay]);
    if (birthdayPatients) {
      for (const p of birthdayPatients) {
        if (typeof p.name === "string") {
          birthdays.push(p.name);
        }
      }
    }
  }

  // D2: Gather yesterday's triage stats
  let triageStats: BriefingSummary["triageStats"] | undefined;
  try {
    const { data: triagedTickets } = (await supabase
      .from("support_tickets")
      .select("ai_urgency, ai_tags, status")
      .eq("clinic_id", clinicId)
      .not("ai_triage_at", "is", null)
      .gte("ai_triage_at", `${todayStr}T00:00:00`)
      .lt("ai_triage_at", `${tomorrowStr}T00:00:00`)) as unknown as QueryResult;

    if (triagedTickets && triagedTickets.length > 0) {
      const byUrgency: Record<string, number> = {};
      const tagCounts: Record<string, number> = {};
      let unansweredUrgent = 0;

      for (const t of triagedTickets as Array<{
        ai_urgency: string | null;
        ai_tags: string[] | null;
        status: string;
      }>) {
        const u = t.ai_urgency ?? "unknown";
        byUrgency[u] = (byUrgency[u] ?? 0) + 1;
        if (t.ai_tags) {
          for (const tag of t.ai_tags) {
            tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
          }
        }
        if (u === "urgent" && t.status !== "resolved" && t.status !== "closed") {
          unansweredUrgent++;
        }
      }

      const topTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tag]) => tag);

      triageStats = {
        totalTriaged: triagedTickets.length,
        byUrgency,
        unansweredUrgent,
        topTags,
      };
    }
  } catch {
    /* triage stats non-critical */
  }

  return {
    totalAppointments,
    cancellations,
    waitlistCount,
    overduePayments,
    birthdays,
    triageStats,
  };
}

/**
 * GET /api/cron/daily-briefing
 *
 * Sends morning WhatsApp briefing to clinic staff.
 * Called by Cloudflare Worker cron at every hour. The handler checks
 * each clinic's configured send_hour against the current hour in
 * the clinic's timezone (default Africa/Casablanca).
 *
 * Protected by CRON_SECRET via Authorization: Bearer header.
 */
async function handler(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  try {
    const supabase = createAdminClient("cron") as unknown as UntypedClient;

    // MA-04: filter soft-deleted clinics
    const { data: clinics } = await supabase
      .from("clinics")
      .select("id, name")
      .eq("status", "active")
      .is("deleted_at", null);

    if (!clinics || clinics.length === 0) {
      return apiSuccess({ message: "Aucune clinique active", sent: 0 });
    }

    let totalSent = 0;

    for (const clinic of clinics) {
      const clinicId = clinic.id as string;
      const clinicName = (clinic.name as string) || "Clinique";

      try {
        const { data: configData } = await supabase
          .from("daily_briefing_config")
          .select("*")
          .eq("clinic_id", clinicId)
          .single();

        const config: BriefingConfig = configData
          ? (configData as unknown as BriefingConfig)
          : {
              clinic_id: clinicId,
              enabled: true,
              send_hour: 7,
              timezone: "Africa/Casablanca",
              recipient_roles: ["receptionist", "clinic_admin"],
              include_appointments: true,
              include_cancellations: true,
              include_waitlist: true,
              include_overdue_payments: true,
              include_birthdays: true,
            };

        if (!config.enabled) continue;

        const currentHour = getClinicLocalHour(config.timezone);
        if (currentHour !== config.send_hour) continue;

        const { todayStr, tomorrowStr } = getClinicLocalDate(config.timezone);

        const { data: existingLog } = await supabase
          .from("daily_briefing_log")
          .select("id")
          .eq("clinic_id", clinicId)
          .eq("briefing_date", todayStr)
          .single();

        if (existingLog) continue;

        const summary = await gatherBriefingSummary(
          supabase,
          clinicId,
          todayStr,
          tomorrowStr,
          config,
        );

        const message = formatBriefingMessage(clinicName, todayStr, summary, config);

        const { data: recipients } = await supabase
          .from("users")
          .select("id, name, phone")
          .eq("clinic_id", clinicId)
          .in("role", config.recipient_roles);

        if (!recipients || recipients.length === 0) continue;

        for (const recipient of recipients) {
          const phone = recipient.phone as string | null;
          const userId = recipient.id as string;
          if (!phone) continue;

          try {
            const result = await sendTextMessage(phone, message);

            await supabase
              .from("daily_briefing_log")
              .insert({
                clinic_id: clinicId,
                briefing_date: todayStr,
                recipient_user_id: userId,
                recipient_phone: phone,
                message_id: result.messageId ?? null,
                summary: {
                  totalAppointments: summary.totalAppointments,
                  cancellations: summary.cancellations,
                  waitlistCount: summary.waitlistCount,
                  overduePayments: summary.overduePayments,
                  birthdays: summary.birthdays,
                },
              })
              .select();

            totalSent++;
          } catch (sendErr) {
            logger.warn("Failed to send daily briefing to recipient", {
              context: "cron/daily-briefing",
              clinicId,
              userId,
              error: sendErr,
            });
          }
        }

        const adminClient = createAdminClient("cron");
        await logAuditEvent({
          supabase: adminClient,
          action: "daily_briefing_sent",
          type: "admin",
          clinicId,
          clinicName,
          description: `Rapport quotidien envoyé à ${recipients.length} destinataire(s)`,
          metadata: {
            totalAppointments: summary.totalAppointments,
            cancellations: summary.cancellations,
            waitlistCount: summary.waitlistCount,
            overduePayments: summary.overduePayments,
            birthdayCount: summary.birthdays.length,
          },
        });
      } catch (clinicErr) {
        logger.warn("Failed to process daily briefing for clinic", {
          context: "cron/daily-briefing",
          clinicId,
          error: clinicErr,
        });
      }
    }

    return apiSuccess({ message: "Rapports quotidiens envoyés", sent: totalSent });
  } catch (err) {
    logger.error("Daily briefing cron failed", {
      context: "cron/daily-briefing",
      error: err,
    });
    return apiInternalError("Échec de l'envoi des rapports quotidiens");
  }
}

export const GET = withSentryCron("daily-briefing", "0 * * * *", handler);
