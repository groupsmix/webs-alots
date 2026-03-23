import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";

export const runtime = "edge";

/**
 * GET /api/health
 *
 * Health check endpoint for monitoring and load balancer probes.
 * Returns service status, uptime, and database connectivity.
 */
export async function GET() {
  const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};

  // Database connectivity check
  try {
    const dbStart = Date.now();
    const supabase = await createClient();
    const { error } = await supabase.from("clinics").select("id").limit(1);
    const dbLatency = Date.now() - dbStart;

    checks.database = error
      ? { status: "degraded", latencyMs: dbLatency, error: "Database query failed" }
      : { status: "ok", latencyMs: dbLatency };
  } catch (err) {
    logger.warn("Operation failed", { context: "route", error: err });
    checks.database = {
      status: "down",
      error: "Database unreachable",
    };
  }

  const overallStatus = Object.values(checks).every((c) => c.status === "ok")
    ? "ok"
    : Object.values(checks).some((c) => c.status === "down")
      ? "down"
      : "degraded";

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: overallStatus === "down" ? 503 : 200 },
  );
}
