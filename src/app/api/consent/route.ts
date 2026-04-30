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
 */

import { NextRequest } from "next/server";
import { apiSuccess, apiRateLimited } from "@/lib/api-response";
import { withValidation } from "@/lib/api-validate";
import { logger } from "@/lib/logger";
import { createRateLimiter, extractClientIp } from "@/lib/rate-limit";
import { createClient, createTenantClient } from "@/lib/supabase-server";
import { getTenant } from "@/lib/tenant";
import { consentSchema } from "@/lib/validations";

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

  // AUDIT F-02: Use the standard Supabase client factories so the tenant
  // context header (x-clinic-id) is set, keeping consent records properly
  // scoped by RLS policies. If a tenant subdomain is resolved, use the
  // tenant-scoped client; otherwise fall back to the plain server client
  // (e.g. consent recorded on the root domain before any clinic context).
  const supabase = tenant?.clinicId
    ? await createTenantClient(tenant.clinicId)
    : await createClient();

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

  // consent_logs is not yet in the generated Database types — cast through
  // unknown until types are regenerated (pre-existing issue, not introduced
  // by AUDIT F-02).
  type ConsentInsertClient = {
    from(t: string): {
      insert(row: Record<string, unknown>): Promise<{ error: { message: string } | null }>;
    };
  };
  const consentClient = supabase as unknown as ConsentInsertClient;
  // Include clinic_id when tenant context is available so the log row is
  // scoped for RLS and downstream GDPR queries. Pre-login consent on the
  // root domain has no tenant — leave the column null in that case.
  const { error } = await consentClient.from("consent_logs").insert({
    clinic_id: tenant?.clinicId ?? null,
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
