/**
 * AI-powered daily clinic briefing generator.
 *
 * Fetches aggregate clinic metrics (no PHI) and generates an executive
 * narrative summary using LLM. Designed to run as a nightly cron job.
 *
 * OWASP A03: Patient names never sent to LLM — only aggregate numbers.
 * OWASP A05: API key resolved via resolveAIConfig() — never hardcoded.
 * OWASP A04: All DB queries scoped to clinic_id.
 */

import { resolveAIConfig } from "@/lib/ai/config";
import { validateAIOutput } from "@/lib/ai/validate-output";
import { isAIEnabled } from "@/lib/features";
import { logger } from "@/lib/logger";

// ── Types ──

export interface ClinicMetrics {
  clinicId: string;
  clinicName: string;
  yesterday: {
    totalAppointments: number;
    completed: number;
    cancelled: number;
    noShows: number;
    newPatients: number;
    revenue: number;
    currency: string;
    peakHour?: string;
  };
  weekComparison: {
    appointmentsChange: number; // % vs same day last week
    revenueChange: number;
    noShowRateChange: number;
  };
  upcomingToday: {
    totalBooked: number;
    slotsAvailable: number;
  };
  openAlerts: number;
  triageStats?: {
    totalTriaged: number;
    byUrgency: Record<string, number>;
    byTag: Record<string, number>;
    unansweredUrgent: number;
    topTags: string[];
  };
}

export interface GeneratedBriefing {
  content: string;
  overallSentiment: "positive" | "neutral" | "concerning" | "critical";
  metricsSnapshot: ClinicMetrics;
}

// ── System Prompt ──

const BRIEFING_SYSTEM_PROMPT = `Tu es un assistant exécutif pour des cliniques médicales marocaines.
Génère un briefing quotidien concis (150-200 mots maximum) en français pour le directeur de la clinique.

Analyse les métriques et structure ton briefing ainsi:
1. Résumé succinct de la performance d'hier (rendez-vous, revenus, taux d'annulation)
2. Point d'attention si nécessaire (taux de no-show élevé, revenus en baisse)
3. Recommandation concrète pour aujourd'hui
4. Évaluation du sentiment général de la clinique

FORMAT DE RÉPONSE (JSON strict, aucun markdown):
{
  "briefing": "Texte du briefing en français (150-200 mots)...",
  "sentiment": "positive|neutral|concerning|critical"
}

RÈGLES:
- Réponses en FRANÇAIS uniquement
- Jamais de noms de patients, coordonnées ou données personnelles
- Ton professionnel et concis
- Données factuelles uniquement — pas de spéculation`;

// ── Date helpers ──

function getTodayStr(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Casablanca",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getYesterdayStr(): string {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Casablanca",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(yesterday);
}

function getLastWeekStr(): string {
  const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Casablanca",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(lastWeek);
}

// ── Metric fetcher ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedSupabase = any;

export async function fetchClinicMetrics(
  supabase: UntypedSupabase,
  clinicId: string,
  clinicName: string,
): Promise<ClinicMetrics> {
  const yesterdayStr = getYesterdayStr();
  const lastWeekStr = getLastWeekStr();
  const todayStr = getTodayStr();

  // Yesterday's appointments — OWASP A04: always scoped to clinic_id
  let totalAppointments = 0;
  let completed = 0;
  let cancelled = 0;
  let noShows = 0;
  let newPatients = 0;
  let revenue = 0;

  try {
    const { count: totalCount } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("appointment_date", yesterdayStr);
    totalAppointments = totalCount ?? 0;
  } catch {
    /* metric failed — use default 0 */
  }

  try {
    const { count: completedCount } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("appointment_date", yesterdayStr)
      .eq("status", "completed");
    completed = completedCount ?? 0;
  } catch {
    /* metric failed */
  }

  try {
    const { count: cancelledCount } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("appointment_date", yesterdayStr)
      .eq("status", "cancelled");
    cancelled = cancelledCount ?? 0;
  } catch {
    /* metric failed */
  }

  try {
    const { count: noShowCount } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("appointment_date", yesterdayStr)
      .eq("status", "no_show");
    noShows = noShowCount ?? 0;
  } catch {
    /* metric failed */
  }

  try {
    const { count: newPatientCount } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("role", "patient")
      .gte("created_at", `${yesterdayStr}T00:00:00`)
      .lt("created_at", `${todayStr}T00:00:00`);
    newPatients = newPatientCount ?? 0;
  } catch {
    /* metric failed */
  }

  // Revenue from paid invoices yesterday
  try {
    const { data: invoices } = await supabase
      .from("invoices")
      .select("amount")
      .eq("clinic_id", clinicId)
      .eq("status", "paid")
      .gte("paid_at", `${yesterdayStr}T00:00:00`)
      .lt("paid_at", `${todayStr}T00:00:00`);

    if (invoices) {
      revenue = (invoices as { amount: number }[]).reduce((sum, inv) => sum + (inv.amount ?? 0), 0);
    }
  } catch {
    /* metric failed */
  }

  // Last week same day comparison
  let lastWeekTotal = 0;
  let lastWeekRevenue = 0;
  let lastWeekNoShows = 0;

  try {
    const { count: lwCount } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("appointment_date", lastWeekStr);
    lastWeekTotal = lwCount ?? 0;
  } catch {
    /* metric failed */
  }

  try {
    const { count: lwNoShow } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("appointment_date", lastWeekStr)
      .eq("status", "no_show");
    lastWeekNoShows = lwNoShow ?? 0;
  } catch {
    /* metric failed */
  }

  try {
    const lastWeekEnd = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    const lwEndStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Casablanca",
    }).format(lastWeekEnd);
    const { data: lwInvoices } = await supabase
      .from("invoices")
      .select("amount")
      .eq("clinic_id", clinicId)
      .eq("status", "paid")
      .gte("paid_at", `${lastWeekStr}T00:00:00`)
      .lt("paid_at", `${lwEndStr}T00:00:00`);

    if (lwInvoices) {
      lastWeekRevenue = (lwInvoices as { amount: number }[]).reduce(
        (sum, inv) => sum + (inv.amount ?? 0),
        0,
      );
    }
  } catch {
    /* metric failed */
  }

  // Today's upcoming bookings
  let todayBooked = 0;
  try {
    const { count: todayCount } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("appointment_date", todayStr)
      .in("status", ["confirmed", "pending", "scheduled"]);
    todayBooked = todayCount ?? 0;
  } catch {
    /* metric failed */
  }

  // Compute % changes (safe division)
  const appointmentsChange =
    lastWeekTotal > 0 ? Math.round(((totalAppointments - lastWeekTotal) / lastWeekTotal) * 100) : 0;

  const revenueChange =
    lastWeekRevenue > 0 ? Math.round(((revenue - lastWeekRevenue) / lastWeekRevenue) * 100) : 0;

  const yesterdayNoShowRate = totalAppointments > 0 ? noShows / totalAppointments : 0;
  const lastWeekNoShowRate = lastWeekTotal > 0 ? lastWeekNoShows / lastWeekTotal : 0;
  const noShowRateChange =
    lastWeekNoShowRate > 0
      ? Math.round(((yesterdayNoShowRate - lastWeekNoShowRate) / lastWeekNoShowRate) * 100)
      : 0;

  // D2: Fetch yesterday's triage stats from support_tickets
  let triageStats: ClinicMetrics["triageStats"] | undefined;
  try {
    const { data: triagedTickets } = await supabase
      .from("support_tickets")
      .select("ai_urgency, ai_tags, status")
      .eq("clinic_id", clinicId)
      .not("ai_triage_at", "is", null)
      .gte("ai_triage_at", `${yesterdayStr}T00:00:00`)
      .lt("ai_triage_at", `${todayStr}T00:00:00`);

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
        byTag: tagCounts,
        unansweredUrgent,
        topTags,
      };
    }
  } catch {
    /* triage stats metric failed — non-critical */
  }

  return {
    clinicId,
    clinicName,
    yesterday: {
      totalAppointments,
      completed,
      cancelled,
      noShows,
      newPatients,
      revenue,
      currency: "MAD",
    },
    weekComparison: {
      appointmentsChange,
      revenueChange,
      noShowRateChange,
    },
    upcomingToday: {
      totalBooked: todayBooked,
      slotsAvailable: 0, // Would require slot calculation — set to 0 as not critical
    },
    openAlerts: 0,
    triageStats,
  };
}

// ── Briefing generator ──

export async function generateClinicBriefing(
  apiKey: string,
  model: string,
  baseUrl: string,
  metrics: ClinicMetrics,
): Promise<GeneratedBriefing | null> {
  const yesterday = metrics.yesterday;
  const noShowRate =
    yesterday.totalAppointments > 0
      ? Math.round((yesterday.noShows / yesterday.totalAppointments) * 100)
      : 0;

  const cancellationRate =
    yesterday.totalAppointments > 0
      ? Math.round((yesterday.cancelled / yesterday.totalAppointments) * 100)
      : 0;

  const dayOfWeek = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Casablanca",
    weekday: "long",
  }).format(new Date());

  const userMessage = `Briefing pour: ${metrics.clinicName}
Date: ${getYesterdayStr()} (${dayOfWeek})

MÉTRIQUES D'HIER:
- Rendez-vous total: ${yesterday.totalAppointments}
- Complétés: ${yesterday.completed}
- Annulés: ${yesterday.cancelled} (${cancellationRate}%)
- No-shows: ${yesterday.noShows} (${noShowRate}%)
- Nouveaux patients: ${yesterday.newPatients}
- Revenus: ${yesterday.revenue.toLocaleString("fr-MA")} MAD

COMPARAISON SEMAINE PRÉCÉDENTE:
- Rendez-vous: ${metrics.weekComparison.appointmentsChange > 0 ? "+" : ""}${metrics.weekComparison.appointmentsChange}%
- Revenus: ${metrics.weekComparison.revenueChange > 0 ? "+" : ""}${metrics.weekComparison.revenueChange}%
- Taux de no-show: ${metrics.weekComparison.noShowRateChange > 0 ? "+" : ""}${metrics.weekComparison.noShowRateChange}%

AUJOURD'HUI:
- Rendez-vous prévus: ${metrics.upcomingToday.totalBooked}
${
  metrics.triageStats
    ? `
TRIAGE SUPPORT (HIER):
- Tickets triés par AI: ${metrics.triageStats.totalTriaged}
- Répartition urgence: ${Object.entries(metrics.triageStats.byUrgency)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ")}
- Tickets urgents non résolus: ${metrics.triageStats.unansweredUrgent}
- Top tags: ${metrics.triageStats.topTags.join(", ") || "aucun"}
`
    : ""
}
Génère le briefing exécutif.`;

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: BRIEFING_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        max_tokens: 800,
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      logger.error("AI briefing generation failed", {
        context: "clinic-briefings",
        clinicId: metrics.clinicId,
        status: response.status,
      });
      return null;
    }

    const aiData = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const rawContent = aiData.choices?.[0]?.message?.content;

    if (!rawContent) return null;

    // F-AI-10: Output safety validation
    const safeContent = validateAIOutput(rawContent);
    if (!safeContent) {
      logger.warn("AI briefing output rejected by safety validator", {
        context: "clinic-briefings",
        clinicId: metrics.clinicId,
      });
      return null;
    }

    // Parse JSON response
    let jsonStr = safeContent.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch?.[1]) jsonStr = jsonMatch[1].trim();

    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

    const validSentiments = new Set(["positive", "neutral", "concerning", "critical"]);
    const sentiment = validSentiments.has(String(parsed.sentiment))
      ? (parsed.sentiment as GeneratedBriefing["overallSentiment"])
      : "neutral";

    return {
      content: typeof parsed.briefing === "string" ? parsed.briefing.slice(0, 2000) : "",
      overallSentiment: sentiment,
      metricsSnapshot: metrics,
    };
  } catch (err) {
    logger.error("Failed to generate clinic briefing", {
      context: "clinic-briefings",
      clinicId: metrics.clinicId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ── Main exported function — called by cron ──

export async function generateDailyClinicBriefings(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<number> {
  // F-AI-01: Kill switch
  if (!(await isAIEnabled())) {
    logger.info("AI briefings skipped — AI features disabled", {
      context: "clinic-briefings",
    });
    return 0;
  }

  const aiResult = await resolveAIConfig();
  if (!aiResult.ok) {
    logger.warn("AI briefings skipped — AI not configured", {
      context: "clinic-briefings",
      reason: aiResult.reason,
    });
    return 0;
  }
  const { apiKey, model, baseUrl } = aiResult.config;

  const todayStr = getTodayStr();

  // Load active clinics
  const { data: clinics, error: clinicsError } = await supabase
    .from("clinics")
    .select("id, name")
    .eq("status", "active")
    .is("deleted_at", null);

  if (clinicsError || !clinics || clinics.length === 0) {
    logger.warn("No active clinics found for AI briefings", {
      context: "clinic-briefings",
      error: clinicsError?.message,
    });
    return 0;
  }

  let generatedCount = 0;

  for (const clinic of clinics as { id: string; name: string }[]) {
    const clinicId = clinic.id;
    const clinicName = clinic.name ?? "Clinique";

    try {
      // Check if briefing already generated today (idempotency guard)
      const { data: existingBriefing } = await supabase
        .from("clinic_ai_briefings")
        .select("id")
        .eq("clinic_id", clinicId)
        .eq("briefing_date", todayStr)
        .single();

      if (existingBriefing) {
        logger.debug("Briefing already generated for clinic today", {
          context: "clinic-briefings",
          clinicId,
        });
        continue;
      }

      // Fetch metrics — OWASP A04: all queries scoped to clinicId
      const metrics = await fetchClinicMetrics(supabase, clinicId, clinicName);

      // Generate AI briefing
      const briefing = await generateClinicBriefing(apiKey, model, baseUrl, metrics);

      if (!briefing) {
        logger.warn("Failed to generate briefing for clinic", {
          context: "clinic-briefings",
          clinicId,
        });
        continue;
      }

      // Store briefing
      const { error: insertError } = await supabase.from("clinic_ai_briefings").insert({
        clinic_id: clinicId,
        briefing_date: todayStr,
        content: briefing.content,
        metrics_snapshot: briefing.metricsSnapshot,
        overall_sentiment: briefing.overallSentiment,
        ai_model: model,
        generated_at: new Date().toISOString(),
      });

      if (insertError) {
        logger.error("Failed to persist AI briefing", {
          context: "clinic-briefings",
          clinicId,
          error: insertError,
        });
        continue;
      }

      generatedCount++;

      logger.info("AI clinic briefing generated", {
        context: "clinic-briefings",
        clinicId,
        sentiment: briefing.overallSentiment,
      });
    } catch (clinicErr) {
      // Per-clinic error — continue to next clinic
      logger.warn("Error processing AI briefing for clinic", {
        context: "clinic-briefings",
        clinicId,
        error: clinicErr instanceof Error ? clinicErr.message : String(clinicErr),
      });
    }
  }

  return generatedCount;
}
