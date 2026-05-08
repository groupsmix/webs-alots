import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { apiSuccess } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { isR2Configured } from "@/lib/r2";
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
 *
 * Audit P2 #23: Deeper monitoring checks (latency, auth probe, etc.)
 * are also exposed via /api/health/internal which is gated by
 * CRON_SECRET to prevent abuse.
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

      // L6-H2: Deep Supabase connectivity check — verify Auth service is reachable
      // beyond the basic PostgREST query above. This catches scenarios where the
      // database is up but the Auth or GoTrue service is degraded.
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
    logger.warn("Operation failed", { context: "health", error: err });
    checks.database = {
      status: "down",
      error: "Database unreachable",
    };
  }

  // R2 storage availability check
  // A40.4: Enhanced R2 check - verify bucket access, not just configuration
  try {
    if (isR2Configured()) {
      const r2Start = Date.now();
      // Attempt to list objects in the bucket (lightweight operation)
      // This verifies we have valid credentials and the bucket is accessible
      const { listR2Objects } = await import("@/lib/r2");
      await listR2Objects("health-check/", { limit: 1 });
      const r2Latency = Date.now() - r2Start;
      checks.r2 = { status: "ok", latencyMs: r2Latency };
    } else {
      checks.r2 = { status: "degraded", error: "R2 storage not configured" };
    }
  } catch (err) {
    logger.warn("R2 bucket access check failed", { context: "health", error: err });
    checks.r2 = {
      status: "degraded",
      error: "R2 bucket access failed",
    };
  }

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

  // A40.4: Per-tenant routing check - verify subdomain resolution works
  // This checks that the middleware can resolve tenant context from subdomains
  try {
    const tenantRoutingStart = Date.now();
    // Import tenant utilities dynamically to avoid circular dependencies
    const { getTenant } = await import("@/lib/tenant");
    const tenant = await getTenant();
    const tenantRoutingLatency = Date.now() - tenantRoutingStart;
    
    // Health check is typically called without a subdomain (root domain)
    // so tenant will be null, which is expected and healthy
    checks.tenantRouting = {
      status: "ok",
      latencyMs: tenantRoutingLatency,
    };
  } catch (err) {
    logger.warn("Tenant routing check failed", { context: "health", error: err });
    checks.tenantRouting = {
      status: "degraded",
      error: "Tenant routing resolution failed",
    };
  }

  const overallStatus = Object.values(checks).every((c) => c.status === "ok")
    ? "ok"
    : Object.values(checks).some((c) => c.status === "down")
      ? "down"
      : "degraded";

  // O-04: Anon /api/health returns only `{ ok: boolean }` plus the HTTP
  // status code (200 when healthy/degraded, 503 when down). Status
  // strings, timestamps, and per-dependency detail are reserved for the
  // gated /api/health/internal endpoint so unauthenticated callers cannot
  // fingerprint our infrastructure.
  return apiSuccess(
    { ok: overallStatus !== "down" },
    overallStatus === "down" ? 503 : 200,
    { "Cache-Control": "public, max-age=30" },
  );
}
