import { type NextRequest } from "next/server";
import {
  buildClinicNarrativeFallback,
  buildPlatformNarrativeFallback,
  computeHealthScoreRecords,
  mapLatestHealthRowsToRecords,
  summariseHealthScores,
  toLatestHealthRows,
  type LatestClinicHealthScoreRow,
  type OwnerClinicSignals,
  type PersistedClinicHealthRecord,
} from "@/lib/ai/owner-analytics";
import { loadProviderConfigs, routeAIRequest, AllProvidersFailedError } from "@/lib/ai/router";
import { validateAIOutput } from "@/lib/ai/validate-output";
import { apiInternalError, apiNotFound, apiSuccess, apiValidationError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { createAdminClient, createUntypedAdminClient } from "@/lib/supabase-server";
import type { UserRole } from "@/lib/types/database";
import { clinicNarrativeRequestSchema } from "@/lib/validations/super-admin";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const ALLOWED_ROLES: UserRole[] = ["super_admin"];

function isMissingRelationError(error: { code?: string; message?: string } | null): boolean {
  return !!error && (error.code === "42P01" || error.message?.includes("does not exist") === true);
}

function isMissingFunctionError(error: { code?: string; message?: string } | null): boolean {
  return (
    !!error &&
    (error.code === "42883" || error.message?.includes("get_latest_clinic_health_scores") === true)
  );
}

async function loadClinicNames(clinicIds: string[]): Promise<Map<string, string>> {
  if (clinicIds.length === 0) return new Map();

  const typedAdmin = createAdminClient("super_admin");
  const { data, error } = await typedAdmin
    .from("clinics")
    .select("id, name")
    .in("id", clinicIds)
    .is("deleted_at", null);

  if (error) {
    logger.warn("Failed to load clinic names for narrative", {
      context: "clinic-narrative",
      clinicIds,
      error: error.message,
    });
    return new Map();
  }

  const clinics = (data ?? []) as Array<{ id: string; name: string }>;
  return new Map(clinics.map((clinic) => [clinic.id, clinic.name]));
}

async function loadStoredHealthRecordsLegacy(
  clinicId?: string | null,
): Promise<PersistedClinicHealthRecord[]> {
  const admin = createUntypedAdminClient("super_admin");
  const query = admin
    .from("clinic_health_scores")
    .select(
      "clinic_id, score, grade, churn_risk, trend, top_risk_signal, top_strength_signal, signals_snapshot, computed_at",
    )
    .order("computed_at", { ascending: false })
    .limit(clinicId ? 50 : 500);

  const { data, error } = clinicId ? await query.eq("clinic_id", clinicId) : await query;

  if (isMissingRelationError(error)) {
    return [];
  }

  if (error) {
    throw new Error(`Failed to load stored health records: ${error.message}`);
  }

  const latestRows = toLatestHealthRows((data ?? []) as LatestClinicHealthScoreRow[], clinicId);
  const clinicNames = await loadClinicNames([...new Set(latestRows.map((row) => row.clinic_id))]);
  return mapLatestHealthRowsToRecords(latestRows, clinicNames);
}

async function loadStoredHealthRecords(
  auth: AuthContext,
  clinicId?: string | null,
): Promise<PersistedClinicHealthRecord[]> {
  const { data, error } = await auth.supabase.rpc(
    "get_latest_clinic_health_scores" as never,
    {
      p_clinic_id: clinicId ?? null,
    } as never,
  );

  if (isMissingFunctionError(error)) {
    return loadStoredHealthRecordsLegacy(clinicId);
  }

  if (isMissingRelationError(error)) {
    return [];
  }

  if (error) {
    throw new Error(`Failed to load stored health records: ${error.message}`);
  }

  const latestRows = toLatestHealthRows(
    (data ?? []) as unknown as LatestClinicHealthScoreRow[],
    clinicId,
  );
  const clinicNames = await loadClinicNames([...new Set(latestRows.map((row) => row.clinic_id))]);
  return mapLatestHealthRowsToRecords(latestRows, clinicNames);
}

async function loadLiveHealthRecords(
  auth: AuthContext,
  clinicId?: string | null,
): Promise<PersistedClinicHealthRecord[]> {
  const { data: signalRows, error } = await auth.supabase.rpc("get_all_clinic_signals" as never);
  if (error) {
    throw new Error(`Failed to compute live health records: ${error.message}`);
  }

  const stored = await loadStoredHealthRecords(auth, clinicId);
  const previousByClinicId = new Map(stored.map((record) => [record.clinicId, record.score]));

  const filteredSignals = ((signalRows ?? []) as unknown as OwnerClinicSignals[]).filter(
    (row) => !clinicId || row.clinicId === clinicId,
  );

  return computeHealthScoreRecords(filteredSignals, previousByClinicId).map((record) => ({
    clinicId: record.clinicId,
    clinicName: record.clinicName,
    score: record.score,
    grade: record.grade,
    topRiskSignal: record.topRiskSignal,
    topStrengthSignal: record.topStrengthSignal,
    trend: record.trend,
    churnRisk: record.churnRisk,
    computedAt: record.computedAt,
    signalsSnapshot: record.signalsSnapshot,
  }));
}

async function loadRecentAlerts(clinicId?: string | null, limit = 5) {
  const admin = createUntypedAdminClient("super_admin");
  const query = admin
    .from("platform_alerts")
    .select("id, clinic_id, alert_type, severity, is_read, created_at")
    .eq("is_read", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  const { data, error } = clinicId ? await query.eq("clinic_id", clinicId) : await query;

  if (isMissingRelationError(error)) return [];
  if (error) {
    logger.warn("Failed to load alerts for clinic narrative", {
      context: "clinic-narrative",
      clinicId,
      error: error.message,
    });
    return [];
  }

  return data ?? [];
}

async function loadStalledOnboardings(clinicId?: string | null, limit = 5) {
  const admin = createUntypedAdminClient("super_admin");
  const query = admin
    .from("clinic_onboardings")
    .select(
      "id, clinic_id, clinic_name, current_step, status, completion_percentage, nudge_count, step_entered_at, last_nudge_at",
    )
    .in("status", ["pending", "in_progress"])
    .order("step_entered_at", { ascending: true })
    .limit(limit);

  const { data, error } = clinicId ? await query.eq("clinic_id", clinicId) : await query;

  if (isMissingRelationError(error)) return [];
  if (error) {
    logger.warn("Failed to load onboarding status for narrative", {
      context: "clinic-narrative",
      clinicId,
      error: error.message,
    });
    return [];
  }

  const threshold = Date.now() - 3 * 24 * 60 * 60 * 1000;
  const onboardingRows = (data ?? []) as Array<{
    id: string;
    clinic_id: string | null;
    clinic_name: string;
    current_step: string;
    status: string;
    completion_percentage: number;
    nudge_count: number;
    step_entered_at: string;
    last_nudge_at: string | null;
  }>;

  return onboardingRows.filter((row) => new Date(row.step_entered_at).getTime() < threshold);
}

async function loadSupportCounts(clinicId?: string | null) {
  const admin = createUntypedAdminClient("super_admin");

  const openQuery = admin
    .from("support_tickets")
    .select("id", { count: "exact", head: true })
    .in("status", ["open", "in_progress"]);

  const urgentQuery = admin
    .from("support_tickets")
    .select("id", { count: "exact", head: true })
    .in("status", ["open", "in_progress"])
    .in("ai_priority", ["critical", "high"]);

  const [openResult, urgentResult] = clinicId
    ? await Promise.all([
        openQuery.eq("clinic_id", clinicId),
        urgentQuery.eq("clinic_id", clinicId),
      ])
    : await Promise.all([openQuery, urgentQuery]);

  if (openResult.error || urgentResult.error) {
    logger.warn("Failed to load support counts for narrative", {
      context: "clinic-narrative",
      clinicId,
      openError: openResult.error?.message,
      urgentError: urgentResult.error?.message,
    });
    return { openCount: 0, urgentCount: 0 };
  }

  return {
    openCount: openResult.count ?? 0,
    urgentCount: urgentResult.count ?? 0,
  };
}

function buildNarrativePrompt(
  mode: "platform" | "clinic",
  payload: Record<string, unknown>,
): string {
  return `Rédige un résumé opérationnel en français pour l'équipe super admin d'Oltigo.
- Utilise uniquement les données agrégées ci-dessous.
- N'invente rien.
- Aucune PHI, aucun détail patient.
- Format attendu: 4 à 6 puces courtes, orientées décision.
- Mentionne au moins 2 actions recommandées.

Type de rapport: ${mode}
Données:
${JSON.stringify(payload, null, 2)}`;
}

async function handlePost(request: NextRequest, auth: AuthContext) {
  let body: unknown = {};
  try {
    const raw = await request.text();
    body = raw ? (JSON.parse(raw) as unknown) : {};
  } catch {
    return apiValidationError("Invalid JSON body");
  }

  const parsed = clinicNarrativeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationError("Invalid request body");
  }

  const clinicId = parsed.data.clinic_id ?? null;
  const mode = clinicId ? "clinic" : "platform";

  try {
    const records = parsed.data.refresh
      ? await loadLiveHealthRecords(auth, clinicId)
      : await loadStoredHealthRecords(auth, clinicId);

    const usableRecords =
      records.length > 0 ? records : await loadLiveHealthRecords(auth, clinicId);

    if (mode === "clinic") {
      const record = usableRecords[0];
      if (!record) {
        return apiNotFound("No clinic health data available for this clinic");
      }

      const [alerts, onboardings, support] = await Promise.all([
        loadRecentAlerts(clinicId, 5),
        loadStalledOnboardings(clinicId, 1),
        loadSupportCounts(clinicId),
      ]);

      const payload = {
        clinic: record,
        alerts,
        onboarding: onboardings[0] ?? null,
        support,
      };

      const fallback = buildClinicNarrativeFallback({
        record,
        unreadAlerts: alerts.length,
        onboardingStep:
          typeof onboardings[0]?.current_step === "string" ? onboardings[0].current_step : null,
        supportBacklog: support.openCount,
      });

      const admin = createUntypedAdminClient("super_admin");
      let narrative = fallback;
      let provider: string | null = null;
      let model: string | null = null;

      try {
        const configs = await loadProviderConfigs(admin);
        const aiResponse = await routeAIRequest(
          {
            task: "summarize",
            complexity: "medium",
            prompt: buildNarrativePrompt(mode, payload),
            systemPrompt:
              "You are a healthcare SaaS operations analyst. Use only aggregate data. No PHI. Respond in French.",
            maxTokens: 500,
            temperature: 0.2,
            context: "clinic-narrative",
          },
          configs,
          admin,
        );

        const validated = validateAIOutput(aiResponse.text);
        if (validated) {
          narrative = validated;
          provider = aiResponse.provider;
          model = aiResponse.model;
        }
      } catch (error) {
        if (!(error instanceof AllProvidersFailedError)) {
          logger.warn("Clinic narrative AI fallback used", {
            context: "clinic-narrative",
            clinicId,
            error,
          });
        }
      }

      await logAuditEvent({
        supabase: auth.supabase,
        action: "clinic_narrative_generated",
        type: "admin",
        clinicId: clinicId ?? "system",
        actor: auth.profile.id,
        description: `Narrative generated for clinic ${clinicId}`,
        metadata: {
          mode,
          usedAi: provider !== null,
          provider,
          model,
        },
      });

      return apiSuccess({
        mode,
        clinic: record,
        narrative,
        provider,
        model,
        fallbackUsed: provider === null,
        payload,
      });
    }

    const [alerts, stalledOnboardings, support] = await Promise.all([
      loadRecentAlerts(null, 5),
      loadStalledOnboardings(null, 5),
      loadSupportCounts(null),
    ]);

    const summary = summariseHealthScores(usableRecords);
    const payload = {
      summary,
      alerts,
      stalledOnboardings,
      support,
    };

    const fallback = buildPlatformNarrativeFallback({
      summary,
      unreadAlerts: alerts.length,
      stalledOnboardings: stalledOnboardings.length,
    });

    const admin = createUntypedAdminClient("super_admin");
    let narrative = fallback;
    let provider: string | null = null;
    let model: string | null = null;

    try {
      const configs = await loadProviderConfigs(admin);
      const aiResponse = await routeAIRequest(
        {
          task: "summarize",
          complexity: "complex",
          prompt: buildNarrativePrompt(mode, payload),
          systemPrompt:
            "You are a healthcare SaaS operations analyst. Use only aggregate data. No PHI. Respond in French.",
          maxTokens: 650,
          temperature: 0.2,
          context: "platform-narrative",
        },
        configs,
        admin,
      );

      const validated = validateAIOutput(aiResponse.text);
      if (validated) {
        narrative = validated;
        provider = aiResponse.provider;
        model = aiResponse.model;
      }
    } catch (error) {
      if (!(error instanceof AllProvidersFailedError)) {
        logger.warn("Platform narrative AI fallback used", {
          context: "clinic-narrative",
          error,
        });
      }
    }

    await logAuditEvent({
      supabase: auth.supabase,
      action: "platform_narrative_generated",
      type: "admin",
      clinicId: "system",
      actor: auth.profile.id,
      description: "Platform narrative generated for super admin analytics",
      metadata: {
        mode,
        usedAi: provider !== null,
        provider,
        model,
      },
    });

    return apiSuccess({
      mode,
      summary,
      narrative,
      provider,
      model,
      fallbackUsed: provider === null,
      payload,
    });
  } catch (error) {
    logger.error("Clinic narrative route failed", {
      context: "clinic-narrative",
      clinicId,
      error,
    });
    return apiInternalError("Failed to generate clinic narrative");
  }
}

export const POST = withAuth(handlePost, ALLOWED_ROLES);
