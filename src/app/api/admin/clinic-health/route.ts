import { type NextRequest } from "next/server";
import {
  buildPlatformAlerts,
  computeHealthScoreRecords,
  mapLatestHealthRowsToRecords,
  summariseHealthScores,
  toLatestHealthRows,
  type LatestClinicHealthScoreRow,
  type OwnerClinicSignals,
} from "@/lib/ai/owner-analytics";
import { apiInternalError, apiSuccess, apiValidationError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { createAdminClient, createUntypedAdminClient } from "@/lib/supabase-server";
import type { UserRole } from "@/lib/types/database";
import {
  clinicHealthMutationSchema,
  clinicHealthQuerySchema,
} from "@/lib/validations/super-admin";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const ALLOWED_ROLES: UserRole[] = ["super_admin"];

function isMissingRelationError(error: { code?: string; message?: string } | null): boolean {
  return !!error && (error.code === "42P01" || error.message?.includes("does not exist") === true);
}

function isMissingFunctionError(error: { code?: string; message?: string } | null): boolean {
  return !!error && (error.code === "42883" || error.message?.includes("get_latest_clinic_health_scores") === true);
}

async function loadLatestHealthRowsLegacy(
  clinicId?: string | null,
): Promise<{ rows: LatestClinicHealthScoreRow[]; missingRelation: boolean }> {
  const admin = createUntypedAdminClient("super_admin");
  const query = admin
    .from("clinic_health_scores")
    .select(
      "clinic_id, score, grade, churn_risk, trend, top_risk_signal, top_strength_signal, signals_snapshot, computed_at",
    )
    .order("computed_at", { ascending: false })
    .limit(clinicId ? 100 : 1000);

  const { data, error } = clinicId ? await query.eq("clinic_id", clinicId) : await query;
  if (isMissingRelationError(error)) {
    return { rows: [], missingRelation: true };
  }
  if (error) {
    throw new Error(`Failed to load clinic health scores: ${error.message}`);
  }

  return {
    rows: toLatestHealthRows((data ?? []) as LatestClinicHealthScoreRow[], clinicId),
    missingRelation: false,
  };
}

async function loadLatestHealthRows(
  auth: AuthContext,
  clinicId?: string | null,
): Promise<{ rows: LatestClinicHealthScoreRow[]; missingRelation: boolean }> {
  const { data, error } = await auth.supabase.rpc("get_latest_clinic_health_scores" as never, {
    p_clinic_id: clinicId ?? null,
  } as never);

  if (isMissingFunctionError(error)) {
    return loadLatestHealthRowsLegacy(clinicId);
  }

  if (isMissingRelationError(error)) {
    return { rows: [], missingRelation: true };
  }

  if (error) {
    logger.error("Failed to load clinic health scores", {
      context: "clinic-health",
      clinicId,
      error: error.message,
    });
    throw new Error("Failed to load clinic health scores");
  }

  return {
    rows: toLatestHealthRows((data ?? []) as unknown as LatestClinicHealthScoreRow[], clinicId),
    missingRelation: false,
  };
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
    logger.warn("Failed to load clinic names for health records", {
      context: "clinic-health",
      error: error.message,
      clinicIds,
    });
    return new Map();
  }

  const clinics = (data ?? []) as Array<{ id: string; name: string }>;
  return new Map(clinics.map((clinic) => [clinic.id, clinic.name]));
}

async function loadUnreadAlerts(clinicId?: string | null, limit = 20) {
  const admin = createUntypedAdminClient("super_admin");
  const query = admin
    .from("platform_alerts")
    .select("id, clinic_id, alert_type, severity, is_read, created_at")
    .eq("is_read", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  const { data, error } = clinicId ? await query.eq("clinic_id", clinicId) : await query;

  if (isMissingRelationError(error)) {
    return [];
  }

  if (error) {
    logger.warn("Failed to load platform alerts", {
      context: "clinic-health",
      clinicId,
      error: error.message,
    });
    return [];
  }

  return data ?? [];
}

async function handleGet(request: NextRequest, _auth: AuthContext) {
  const { searchParams } = new URL(request.url);
  const parsed = clinicHealthQuerySchema.safeParse({
    clinic_id: searchParams.get("clinic_id") ?? undefined,
    churn_risk: searchParams.get("churn_risk") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    include_alerts: searchParams.get("include_alerts") ?? undefined,
  });

  if (!parsed.success) {
    return apiValidationError("Invalid query parameters");
  }

  try {
    const { clinic_id: clinicId, churn_risk: churnRisk, limit, include_alerts: includeAlerts } = parsed.data;
    const { rows, missingRelation } = await loadLatestHealthRows(_auth, clinicId ?? null);

    if (missingRelation) {
      return apiSuccess({
        summary: summariseHealthScores([]),
        scores: [],
        alerts: [],
        migrationsApplied: false,
      });
    }

    const clinicNames = await loadClinicNames([...new Set(rows.map((row) => row.clinic_id))]);
    let records = mapLatestHealthRowsToRecords(rows, clinicNames);

    if (churnRisk !== "all") {
      records = records.filter((record) => record.churnRisk === churnRisk);
    }

    const limited = records.slice(0, limit);
    const alerts = includeAlerts ? await loadUnreadAlerts(clinicId ?? null, Math.min(limit, 20)) : [];

    return apiSuccess({
      summary: summariseHealthScores(records),
      scores: limited,
      alerts,
      migrationsApplied: true,
    });
  } catch (error) {
    logger.error("Clinic health GET failed", {
      context: "clinic-health",
      error,
    });
    return apiInternalError("Failed to fetch clinic health scores");
  }
}

async function handlePost(request: NextRequest, auth: AuthContext) {
  let body: unknown = {};
  try {
    const raw = await request.text();
    body = raw ? (JSON.parse(raw) as unknown) : {};
  } catch {
    return apiValidationError("Invalid JSON body");
  }

  const parsed = clinicHealthMutationSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationError("Invalid request body");
  }

  const { clinic_id: clinicId, create_alerts: createAlerts } = parsed.data;

  try {
    const { data: signalRows, error: signalError } = await auth.supabase.rpc("get_all_clinic_signals" as never);

    if (signalError) {
      logger.error("Failed to execute get_all_clinic_signals", {
        context: "clinic-health",
        error: signalError.message,
      });
      return apiInternalError("Owner AI migrations may not be applied yet");
    }

    const typedSignals = (signalRows ?? []) as unknown as OwnerClinicSignals[];
    const filteredSignals = clinicId
      ? typedSignals.filter((row) => row.clinicId === clinicId)
      : typedSignals;

    const { rows: previousRows } = await loadLatestHealthRows(auth, clinicId ?? null);
    const previousByClinicId = new Map(previousRows.map((row) => [row.clinic_id, row.score]));

    const computed = computeHealthScoreRecords(filteredSignals, previousByClinicId);
    if (computed.length === 0) {
      return apiSuccess({
        summary: summariseHealthScores([]),
        scores: [],
        alertsCreated: 0,
      });
    }

    const admin = createUntypedAdminClient("super_admin");

    const { error: insertError } = await admin.from("clinic_health_scores").insert(
      computed.map((record) => ({
        clinic_id: record.clinicId,
        score: record.score,
        grade: record.grade,
        churn_risk: record.churnRisk,
        trend: record.trend,
        top_risk_signal: record.topRiskSignal,
        top_strength_signal: record.topStrengthSignal,
        signals_snapshot: record.signalsSnapshot,
        computed_at: record.computedAt,
      })),
    );

    if (insertError) {
      logger.error("Failed to persist clinic health scores", {
        context: "clinic-health",
        clinicId,
        error: insertError.message,
      });
      return apiInternalError("Failed to save clinic health scores");
    }

    const alerts = createAlerts ? buildPlatformAlerts(computed) : [];
    if (alerts.length > 0) {
      const { error: alertError } = await admin
        .from("platform_alerts")
        .upsert(alerts, { onConflict: "clinic_id,alert_type" });

      if (alertError) {
        logger.warn("Failed to upsert platform alerts from clinic health refresh", {
          context: "clinic-health",
          clinicId,
          error: alertError.message,
        });
      }
    }

    await logAuditEvent({
      supabase: auth.supabase,
      action: "clinic_health_scores_recomputed",
      type: "admin",
      clinicId: clinicId ?? "system",
      actor: auth.profile.id,
      description: clinicId
        ? `Health score recomputed for clinic ${clinicId}`
        : "Health scores recomputed for all clinics",
      metadata: {
        clinicId,
        records: computed.length,
        alertsCreated: alerts.length,
      },
    });

    return apiSuccess({
      summary: summariseHealthScores(computed),
      scores: computed,
      alertsCreated: alerts.length,
    });
  } catch (error) {
    logger.error("Clinic health POST failed", {
      context: "clinic-health",
      clinicId,
      error,
    });
    return apiInternalError("Failed to recompute clinic health scores");
  }
}

export const GET = withAuth(handleGet, ALLOWED_ROLES);
export const POST = withAuth(handlePost, ALLOWED_ROLES);
