/**
 * Consent Logging API
 *
 * Records user consent events for GDPR/Loi 09-08 compliance.
 * Stores consent type, timestamp, and IP for audit trail.
 *
 * POST /api/consent — Log a consent event
 *
 * AUDIT F-02: Replaced inline createServerClient() with createClient() /
 * createTenantClient() to ensure the tenant context header (x-clinic-id)
 * is set on all database operations.
 *
 * X-1: Replaced `as unknown as ConsentInsertClient` with properly-typed
 * SupabaseClient<Database> from database-extended.ts.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { apiError, apiSuccess, apiRateLimited } from "@/lib/api-response";
import { withValidation } from "@/lib/api-validate";
import { logger } from "@/lib/logger";
import { createRateLimiter, extractClientIp } from "@/lib/rate-limit";
import { createTenantClient } from "@/lib/supabase-server";
import { getTenant } from "@/lib/tenant";
import type { Database } from "@/lib/types/database-extended";
import { consentSchema } from "@/lib/validations";

type ExtendedClient = SupabaseClient<Database>;

// S-22: Rate limit keyed on IP + clinic subdomain. Fail-closed if backend unavailable.
const consentLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 60, failClosed: true });

export const POST = withValidation(consentSchema, async (data, request: NextRequest) => {
  // S-22: Enforce rate limit on consent endpoint
  const clientIp = extractClientIp(request);
  const tenant = await getTenant();
  const rateLimitKey = `consent:${clientIp}:${tenant?.clinicId ?? "root"}`;
  const allowed = await consentLimiter.check(rateLimitKey);
  if (!allowed) {
    return apiRateLimited("Too many consent requests. Please try again later.");
  }

  const { consentType, granted } = data;

  // MEDIUM-1: Require tenant context — never fall back to a non-tenant
  // client for a write that creates a tenant-scoped row. Consent without
  // a resolved clinic context (e.g. root-domain hit, broken subdomain
  // cache) is rejected with 400 to maintain defense-in-depth.
  if (!tenant?.clinicId) {
    return apiError("Tenant context required for consent logging", 400, "TENANT_REQUIRED");
  }
  const supabase = (await createTenantClient(tenant.clinicId)) as ExtendedClient;

  // User may or may not be authenticated (cookie consent can happen pre-login)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userId: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .maybeSingle();
    userId = profile?.id ?? null;
  }

  const ip = extractClientIp(request);

  const { error } = await supabase.from("consent_logs").insert({
    clinic_id: tenant.clinicId,
    user_id: userId,
    consent_type: consentType as string,
    granted,
    ip_address: ip,
    user_agent: request.headers.get("user-agent") ?? null,
  });

  if (error) {
    // Table may not exist yet — log but don't fail the user experience
    logger.warn("Failed to log consent", { context: "consent", error: error.message });
    return apiSuccess({ logged: false });
  }

  return apiSuccess({ logged: true });
});
