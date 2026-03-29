import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { isR2Configured } from "@/lib/r2";
import { apiSuccess } from "@/lib/api-response";
/**
 * GET /api/health
 *
 * Health check endpoint for monitoring and load balancer probes.
 * Returns service status, uptime, database connectivity, and
 * component-level health for R2, WhatsApp, and rate limiter.
 *
 * Uses a direct Supabase client (anon key, no cookies) instead of the
 * cookie-based `createClient()` from `supabase-server.ts`.  Health
 * checks are hit by load balancers and monitoring tools that don't
 * carry browser cookies, and depending on `next/headers` cookies()
 * can fail in certain Cloudflare Workers edge contexts.
 */
export async function GET() {
  const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};

  // Database connectivity check
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      checks.database = {
        status: "degraded",
        error: "Supabase credentials not configured",
      };
    } else {
      const dbStart = Date.now();
      const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);
      const { error } = await supabase.from("clinics").select("id").limit(1);
      const dbLatency = Date.now() - dbStart;

      checks.database = error
        ? { status: "degraded", latencyMs: dbLatency, error: "Database query failed" }
        : { status: "ok", latencyMs: dbLatency };
    }
  } catch (err) {
    logger.warn("Operation failed", { context: "health", error: err });
    checks.database = {
      status: "down",
      error: "Database unreachable",
    };
  }

  // R2 storage availability check
  checks.r2 = isR2Configured()
    ? { status: "ok" }
    : { status: "degraded", error: "R2 storage not configured" };

  // WhatsApp API availability check
  const whatsappConfigured = !!(
    process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN
  ) || !!(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  );
  checks.whatsapp = whatsappConfigured
    ? { status: "ok" }
    : { status: "degraded", error: "WhatsApp API not configured" };

  // Rate limiter backend check
  const rateLimitBackend = process.env.RATE_LIMIT_BACKEND || "auto";
  const hasKV = rateLimitBackend === "kv";
  const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  checks.rateLimiter = {
    status: hasKV || hasSupabase ? "ok" : "degraded",
    error: !hasKV && !hasSupabase ? "Using in-memory fallback (not shared across isolates)" : undefined,
  };

  const overallStatus = Object.values(checks).every((c) => c.status === "ok")
    ? "ok"
    : Object.values(checks).some((c) => c.status === "down")
      ? "down"
      : "degraded";

  return apiSuccess(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
    },
    overallStatus === "down" ? 503 : 200,
  );
}
