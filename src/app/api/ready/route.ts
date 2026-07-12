import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getPublicAppVersion, getSupabaseAnonKey, getSupabaseUrl } from "@/lib/env";
import { logger } from "@/lib/logger";

export type ReadinessStatus = "ready" | "not_ready";

export interface ReadinessResponse {
  status: ReadinessStatus;
  checks: {
    supabase: "ok" | "degraded" | "down";
  };
  timestamp: string;
  version: string;
}

/**
 * GET /api/ready
 *
 * Kubernetes-style readiness probe. It performs the minimum work required to
 * confirm the app can accept traffic: a cheap, lightweight database query.
 *
 * Unlike `/api/health`, this endpoint does not enumerate every dependency
 * (R2, AI, rate limiter, connection pooler). It returns 200 when the app is
 * ready to serve requests and 503 when the database is unreachable.
 */
export async function GET(request: NextRequest) {
  const traceId = request.headers.get("x-trace-id") ?? undefined;

  let supabaseCheck: "ok" | "down" | "degraded" = "ok";

  try {
    const supabaseUrl = getSupabaseUrl();
    const supabaseAnonKey = getSupabaseAnonKey();

    if (!supabaseUrl || !supabaseAnonKey) {
      supabaseCheck = "degraded";
    } else {
      const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);
      const { error } = await supabase.from("clinics").select("id").limit(1);
      if (error) {
        supabaseCheck = "degraded";
      }
    }
  } catch (err) {
    logger.error("Readiness check failed", {
      context: "ready",
      traceId,
      error: err,
    });
    supabaseCheck = "down";
  }

  const ready: ReadinessStatus = supabaseCheck === "ok" ? "ready" : "not_ready";

  const version = getPublicAppVersion();

  const payload: ReadinessResponse = {
    status: ready,
    checks: {
      supabase: supabaseCheck,
    },
    timestamp: new Date().toISOString(),
    version,
  };

  return NextResponse.json(payload, {
    status: ready === "ready" ? 200 : 503,
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
