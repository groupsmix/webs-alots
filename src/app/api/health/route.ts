// health endpoint is edge-compatible — no Node-only modules used.
export const runtime = "edge";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { apiSuccess } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { isR2Configured } from "@/lib/r2";

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export interface HealthCheckResult {
  status: string;
  latencyMs?: number;
  error?: string;
  backend?: string;
}

export interface HealthResponse {
  status: HealthStatus;
  checks: {
    supabase: HealthCheckResult;
    r2: HealthCheckResult;
    rateLimiter: HealthCheckResult;
  };
  timestamp: string;
}

/**
 * GET /api/health
 *
 * Enhanced health check endpoint. Returns structured JSON with
 * per-dependency status, latency, and an overall status indicator.
 *
 * Uses a direct Supabase client (anon key, no cookies) instead of the
 * cookie-based `createClient()` from `supabase-server.ts`.  Health
 * checks are hit by load balancers and monitoring tools that don't
 * carry browser cookies.
 */
export async function GET() {
  let supabaseCheck: HealthCheckResult;

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      supabaseCheck = {
        status: "degraded",
        error: "Supabase credentials not configured",
      };
    } else {
      const dbStart = Date.now();
      const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);
      const { error } = await supabase.from("clinics").select("id").limit(1);
      const dbLatency = Date.now() - dbStart;

      supabaseCheck = error
        ? { status: "degraded", latencyMs: dbLatency, error: "Database query failed" }
        : { status: "ok", latencyMs: dbLatency };
    }
  } catch (err) {
    logger.warn("Health check failed", { context: "health", error: err });
    supabaseCheck = { status: "down", error: "Database unreachable" };
  }

  const r2Check: HealthCheckResult = isR2Configured()
    ? { status: "ok" }
    : { status: "degraded", error: "R2 storage not configured" };

  const rateLimitBackend = process.env.RATE_LIMIT_BACKEND || "auto";
  const hasKV = rateLimitBackend === "kv";
  const hasSupabase = !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const resolvedBackend = hasKV ? "kv" : hasSupabase ? "supabase" : "memory";
  const rateLimiterCheck: HealthCheckResult = {
    status: hasKV || hasSupabase ? "ok" : "degraded",
    backend: resolvedBackend,
    error:
      !hasKV && !hasSupabase ? "Using in-memory fallback (not shared across isolates)" : undefined,
  };

  const allChecks = [supabaseCheck, r2Check, rateLimiterCheck];
  const overallStatus: HealthStatus = allChecks.every((c) => c.status === "ok")
    ? "healthy"
    : allChecks.some((c) => c.status === "down")
      ? "unhealthy"
      : "degraded";

  const payload: HealthResponse = {
    status: overallStatus,
    checks: {
      supabase: supabaseCheck,
      r2: r2Check,
      rateLimiter: rateLimiterCheck,
    },
    timestamp: new Date().toISOString(),
  };

  return apiSuccess(payload, overallStatus === "unhealthy" ? 503 : 200, {
    "Cache-Control": "public, max-age=30",
  });
}
