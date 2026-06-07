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

  // CMP-006 / PR #980 corridor-security follow-up:
  //
  // Also write to consent_records (structured 00160 table) when the
  // caller is authenticated. This populates the compliance-grade ledger
  // without breaking the legacy consent_logs flow used for pre-auth
  // cookie consent.
  //
  // SECURITY MODEL
  // --------------
  // 1.  We refuse to write consent_records without an authenticated
  //     Supabase session (`user` from supabase.auth.getUser()).
  //     Pre-auth cookie consent stays on consent_logs only.
  // 2.  We use the user's own tenant-scoped client — NOT a service-role
  //     client — so RLS enforces ownership at the database level.
  //     Migration 00163 adds:
  //       CREATE POLICY user_inserts_own_consent_records
  //         ON public.consent_records FOR INSERT TO authenticated
  //         WITH CHECK (
  //           user_id  = (SELECT id        FROM users WHERE auth_id = auth.uid())
  //           AND clinic_id = (SELECT clinic_id FROM users WHERE auth_id = auth.uid())
  //         );
  //     Even if a future change accidentally takes user_id from the
  //     request body, the database will reject the write.
  // 3.  Defense in depth: we re-verify in code that the resolved
  //     profile (`userId`) still maps back to the authenticated user
  //     via auth_id, and that profile.clinic_id matches the resolved
  //     tenant.clinicId, before issuing the insert.
  if (user && userId) {
    const VALID_CONSENT_TYPES = [
      "terms_of_service",
      "privacy_policy",
      "health_data_processing",
      "marketing_communications",
      "whatsapp_notifications",
      "data_sharing_with_clinic",
    ] as const;
    const normalizedType = VALID_CONSENT_TYPES.includes(
      consentType as (typeof VALID_CONSENT_TYPES)[number],
    )
      ? (consentType as (typeof VALID_CONSENT_TYPES)[number])
      : null;

    if (normalizedType) {
      // Defense-in-depth re-verification of ownership. The profile row
      // must (a) belong to the authenticated auth user and (b) be
      // attached to the resolved tenant. If either invariant fails we
      // log and skip the structured write — never fall back to a
      // service-role client.
      const { data: profileCheck } = await supabase
        .from("users")
        .select("id, auth_id, clinic_id")
        .eq("id", userId)
        .maybeSingle();

      const ownsProfile =
        profileCheck?.auth_id === user.id && profileCheck?.clinic_id === tenant.clinicId;

      if (!ownsProfile) {
        logger.warn("Skipping consent_records write: profile/tenant mismatch", {
          context: "consent",
          authUser: user.id,
          resolvedUserId: userId,
          resolvedClinic: tenant.clinicId,
        });
      } else {
        // Use the user's own tenant client. RLS policy
        // user_inserts_own_consent_records (00163) enforces ownership
        // server-side as the final authorization barrier.
        const { error: crError } = await supabase.from("consent_records").insert({
          user_id: userId,
          clinic_id: tenant.clinicId,
          consent_type: normalizedType,
          granted,
          version: "1.0",
          ip_address: ip,
          user_agent: request.headers.get("user-agent") ?? null,
        });
        if (crError) {
          logger.warn("Failed to write consent_records", {
            context: "consent",
            error: crError.message,
          });
        }
      }
    }
  }

  return apiSuccess({ logged: true });
});
