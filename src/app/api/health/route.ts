import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

/**
 * GET /api/health
 *
 * Health check endpoint for monitoring and load balancer probes.
 * Returns service status and basic connectivity checks.
 */
export async function GET() {
  const checks: Record<string, "ok" | "error"> = {};

  // Database connectivity check
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("clinics").select("id").limit(1);
    checks.database = error ? "error" : "ok";
  } catch {
    checks.database = "error";
  }

  const allOk = Object.values(checks).every((v) => v === "ok");

  return NextResponse.json(
    {
      status: allOk ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: allOk ? 200 : 503 },
  );
}
