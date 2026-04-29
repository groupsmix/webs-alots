/**
 * Consent Logging API
 *
 * Records user consent events for GDPR/Loi 09-08 compliance.
 * Stores consent type, timestamp, and IP for audit trail.
 *
 * POST /api/consent — Log a consent event
 */

import { createServerClient } from "@supabase/ssr";
import { NextRequest } from "next/server";
import { apiError, apiSuccess, apiRateLimited } from "@/lib/api-response";
import { withValidation } from "@/lib/api-validate";
import { logger } from "@/lib/logger";
import { createRateLimiter, extractClientIp } from "@/lib/rate-limit";
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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return apiError("Service unavailable", 503);
  }

  const { consentType, granted } = data;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {
        /* read-only */
      },
    },
  });

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
