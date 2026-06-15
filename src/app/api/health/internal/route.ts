import { createClient as _createSupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api-response";
import { verifyPoolerEndpoint, verifyDirectDbPooler } from "@/lib/connection-pooling";
import { verifyCronSecret } from "@/lib/cron-auth";
import { getCronSecretRotatedAt } from "@/lib/env";
import { logger as _logger } from "@/lib/logger";
import { isR2Configured as _isR2Configured } from "@/lib/r2";
import { applyRequestScopedResponseHeaders } from "@/lib/request-context-response-headers";

interface HealthCheck {
  status: string;
  latencyMs?: number;
  error?: string;
  [key: string]: unknown;
}

interface InternalHealthMetricsRow {
  postgres_version: string;
  postgres_version_major: number;
  max_connections: number;
  current_connections: number;
  active_connections: number;
  idle_connections: number;
  waiting_connections: number;
  pool_utilization_pct: number | null;
}

interface AgeStatusInput {
  label: string;
  rawTimestamp: string | undefined;
  warnAfterDays: number;
  missingError: string;
}

function toWholeDays(milliseconds: number): number {
  return Math.floor(milliseconds / 86_400_000);
}

function evaluateAgeStatus(input: AgeStatusInput): HealthCheck {
  if (!input.rawTimestamp) {
    return {
      status: "degraded",
      error: input.missingError,
    };
  }

  const parsed = Date.parse(input.rawTimestamp);
  if (Number.isNaN(parsed)) {
    return {
      status: "degraded",
      error: `${input.label} timestamp is invalid`,
      value: input.rawTimestamp,
    };
  }

  const ageDays = toWholeDays(Date.now() - parsed);
  return {
    status: ageDays > input.warnAfterDays ? "degraded" : "ok",
    lastUpdatedAt: new Date(parsed).toISOString(),
    ageDays,
    thresholdDays: input.warnAfterDays,
    error:
      ageDays > input.warnAfterDays
        ? `${input.label} age is ${ageDays} day(s); threshold is ${input.warnAfterDays}`
        : undefined,
  };
}

export async function GET(request: NextRequest) {
  // L6-F1: Use shared timing-safe helper (was inline string compare)
  const authErr = verifyCronSecret(request);
  if (authErr) return applyRequestScopedResponseHeaders(request, authErr);

  const checks: Record<string, HealthCheck> = {};

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      checks.database = {
        status: "degraded",
        error: "Supabase credentials not configured",
      };
    } else {
      const dbStart = Date.now();
      const supabase = _createSupabaseClient(supabaseUrl, supabaseAnonKey);
      const { error } = await supabase.from("clinics").select("id").limit(1);
      const dbLatency = Date.now() - dbStart;

      checks.database = error
        ? { status: "degraded", latencyMs: dbLatency, error: "Database query failed" }
        : { status: "ok", latencyMs: dbLatency };

      if (!error) {
        try {
          const authStart = Date.now();
          const authClient = supabase.auth as unknown as {
            getSession: () => Promise<{ error: { message?: string } | null }>;
          };
          const { error: authError } = await authClient.getSession();
          const authLatency = Date.now() - authStart;
          checks.auth = authError
            ? { status: "degraded", latencyMs: authLatency, error: "Auth service query failed" }
            : { status: "ok", latencyMs: authLatency };
        } catch {
          checks.auth = { status: "degraded", error: "Auth service unreachable" };
        }
      }
    }
  } catch (err) {
    _logger.warn("Internal health check failed", { context: "health-internal", error: err });
    checks.database = {
      status: "down",
      error: "Database unreachable",
    };
  }

  let internalMetrics: InternalHealthMetricsRow | null = null;
  if (supabaseUrl && serviceKey) {
    try {
      const adminClient = _createSupabaseClient(supabaseUrl, serviceKey);
      const { data, error } = await adminClient.rpc("internal_health_metrics");
      if (error) {
        checks.postgres = {
          status: "degraded",
          error: "Internal Postgres metrics RPC failed",
          details: error.message,
        };
      } else {
        internalMetrics = Array.isArray(data)
          ? ((data[0] ?? null) as InternalHealthMetricsRow | null)
          : (data as InternalHealthMetricsRow | null);

        if (internalMetrics) {
          checks.postgres = {
            status: "ok",
            version: internalMetrics.postgres_version,
            major: internalMetrics.postgres_version_major,
          };
        } else {
          checks.postgres = {
            status: "degraded",
            error: "Internal Postgres metrics RPC returned no data",
          };
        }
      }
    } catch (err) {
      checks.postgres = {
        status: "degraded",
        error: "Failed to query internal Postgres metrics",
        details: err instanceof Error ? err.message : String(err),
      };
    }
  } else {
    checks.postgres = {
      status: "degraded",
      error: "SUPABASE_SERVICE_ROLE_KEY not configured; internal DB metrics unavailable",
    };
  }

  // R-14: Surface pending_audit_logs count so operators detect accumulation
  try {
    if (supabaseUrl && serviceKey) {
      const adminClient = _createSupabaseClient(supabaseUrl, serviceKey);
      const { count, error: palErr } = await adminClient
        .from("pending_audit_logs")
        .select("id", { count: "exact", head: true });
      if (!palErr) {
        const pending = count ?? 0;
        checks.pendingAuditLogs = {
          status: pending > 100 ? "degraded" : "ok",
          pending,
          ...(pending > 0 && { error: `${pending} pending audit log(s)` }),
        };
      }
    }
  } catch {
    // Non-critical — skip if table doesn't exist
  }

  checks.r2 = _isR2Configured()
    ? { status: "ok" }
    : { status: "degraded", error: "R2 storage not configured" };

  const whatsappConfigured =
    !!(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN) ||
    !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
  checks.whatsapp = whatsappConfigured
    ? { status: "ok" }
    : { status: "degraded", error: "WhatsApp API not configured" };

  // Connection pooling verification
  const poolerCheck = verifyPoolerEndpoint();
  const directDbCheck = verifyDirectDbPooler();
  const utilizationPct = internalMetrics?.pool_utilization_pct ?? null;
  const utilizationWarning = utilizationPct !== null && utilizationPct >= 70;
  checks.connectionPooling = {
    status: !poolerCheck.isPooled || utilizationWarning ? "degraded" : "ok",
    error:
      poolerCheck.recommendation ??
      directDbCheck.recommendation ??
      (utilizationWarning ? `Connection pool utilization at ${utilizationPct}%` : undefined),
    url: poolerCheck.url,
    maxConnections: internalMetrics?.max_connections,
    currentConnections: internalMetrics?.current_connections,
    activeConnections: internalMetrics?.active_connections,
    idleConnections: internalMetrics?.idle_connections,
    waitingConnections: internalMetrics?.waiting_connections,
    utilizationPct,
  };

  const rateLimitBackend = process.env.RATE_LIMIT_BACKEND || "auto";
  const hasKV = rateLimitBackend === "kv";
  const hasSupabase = !!(supabaseUrl && serviceKey);
  checks.rateLimiter = {
    status: hasKV || hasSupabase ? "ok" : "degraded",
    error:
      !hasKV && !hasSupabase ? "Using in-memory fallback (not shared across isolates)" : undefined,
  };

  checks.restoreDrill = evaluateAgeStatus({
    label: "Restore drill",
    rawTimestamp: process.env.LAST_RESTORE_TEST_AT,
    warnAfterDays: 45,
    missingError: "LAST_RESTORE_TEST_AT not configured",
  });

  const rotationChecks = [
    {
      name: "CRON_SECRET",
      result: evaluateAgeStatus({
        label: "CRON_SECRET rotation",
        rawTimestamp: getCronSecretRotatedAt(),
        warnAfterDays: 120,
        missingError: "CRON_SECRET_ROTATED_AT not configured",
      }),
    },
    {
      name: "PROFILE_HEADER_HMAC_KEY",
      result: evaluateAgeStatus({
        label: "PROFILE_HEADER_HMAC_KEY rotation",
        rawTimestamp: process.env.PROFILE_HEADER_HMAC_KEY_ROTATED_AT,
        warnAfterDays: 120,
        missingError: "PROFILE_HEADER_HMAC_KEY_ROTATED_AT not configured",
      }),
    },
    {
      name: "PHI_ENCRYPTION_KEY",
      result: evaluateAgeStatus({
        label: "PHI_ENCRYPTION_KEY rotation",
        rawTimestamp: process.env.PHI_ENCRYPTION_KEY_ROTATED_AT,
        warnAfterDays: 120,
        missingError: "PHI_ENCRYPTION_KEY_ROTATED_AT not configured",
      }),
    },
  ];

  checks.secretRotation = {
    status: rotationChecks.every((entry) => entry.result.status === "ok") ? "ok" : "degraded",
    secrets: rotationChecks.map((entry) => ({
      name: entry.name,
      ...entry.result,
    })),
    error:
      rotationChecks
        .filter((entry) => entry.result.status !== "ok")
        .map((entry) => entry.result.error)
        .filter((value): value is string => typeof value === "string")
        .join("; ") || undefined,
  };

  const overallStatus = Object.values(checks).every((c) => c.status === "ok")
    ? "ok"
    : Object.values(checks).some((c) => c.status === "down")
      ? "down"
      : "degraded";

  const response = apiSuccess(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
    },
    overallStatus === "down" ? 503 : 200,
  );

  return applyRequestScopedResponseHeaders(request, response);
}
