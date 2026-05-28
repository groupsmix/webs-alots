import { createClient as _createSupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api-response";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger as _logger } from "@/lib/logger";
import { isR2Configured as _isR2Configured } from "@/lib/r2";

export async function GET(request: NextRequest) {
  // L6-F1: Use shared timing-safe helper (was inline string compare)
  const authErr = verifyCronSecret(request);
  if (authErr) return authErr;

  const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};

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
      const supabase = _createSupabaseClient(supabaseUrl, supabaseAnonKey);
      const { error } = await supabase.from("clinics").select("id").limit(1);
      const dbLatency = Date.now() - dbStart;

      checks.database = error
        ? { status: "degraded", latencyMs: dbLatency, error: "Database query failed" }
        : { status: "ok", latencyMs: dbLatency };

      if (!error) {
        try {
          const authStart = Date.now();
          const { error: authError } = await supabase.auth.getSession();
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

  // R-14: Surface pending_audit_logs count so operators detect accumulation
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && serviceKey) {
      const adminClient = _createSupabaseClient(supabaseUrl, serviceKey);
      const { count, error: palErr } = await adminClient
        .from("pending_audit_logs")
        .select("id", { count: "exact", head: true });
      if (!palErr) {
        const pending = count ?? 0;
        checks.pendingAuditLogs = {
          status: pending > 100 ? "degraded" : "ok",
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

  const rateLimitBackend = process.env.RATE_LIMIT_BACKEND || "auto";
  const hasKV = rateLimitBackend === "kv";
  const hasSupabase = !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  checks.rateLimiter = {
    status: hasKV || hasSupabase ? "ok" : "degraded",
    error:
      !hasKV && !hasSupabase ? "Using in-memory fallback (not shared across isolates)" : undefined,
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
