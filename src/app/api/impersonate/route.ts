import { cookies } from "next/headers";
import { apiSuccess, apiInternalError, apiNotFound, apiUnauthorized } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logSecurityEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase-server";
import { impersonateSchema } from "@/lib/validations";
import { withAuth } from "@/lib/with-auth";

/**
 * A54.2: Use __Host- prefix in production to prevent Domain= attribute
 * on the cookie, which would allow subdomain leakage between clinic tenants
 * (e.g. clinic-a.oltigo.com setting a cookie readable by clinic-b.oltigo.com).
 *
 * __Host- cookies require: Secure, Path=/, no Domain attribute.
 * In dev (non-HTTPS), fall back to unprefixed names since __Host- requires Secure.
 */
const IS_PROD = process.env.NODE_ENV === "production";
const COOKIE_PREFIX = IS_PROD ? "__Host-" : "";
const COOKIE_CLINIC_ID = `${COOKIE_PREFIX}sa_impersonate_clinic_id`;
const COOKIE_CLINIC_NAME = `${COOKIE_PREFIX}sa_impersonate_clinic_name`;
const COOKIE_REASON = `${COOKIE_PREFIX}sa_impersonate_reason`;

/**
 * POST /api/impersonate
 *
 * Allows a super_admin to impersonate a clinic by storing the target clinic_id
 * in a secure cookie. The admin dashboard will read this cookie to switch context.
 *
 * Body: { clinicId: string, clinicName: string, reason: string }
 *
 * DELETE /api/impersonate
 *
 * Ends the impersonation session by clearing the cookie.
 */
export const POST = withAuthValidation(impersonateSchema, async (body, request, { supabase, user }) => {
    const { clinicId, clinicName, password, reason } = body;

    // AUTH-02: Prevent impersonation of other super_admin accounts.
    // Check if the target clinic has any super_admin users — if so, block.
    const { data: superAdminsInClinic } = await supabase
      .from("users")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("role", "super_admin")
      .limit(1);

    if (superAdminsInClinic && superAdminsInClinic.length > 0) {
      return apiUnauthorized("Cannot impersonate a clinic with super_admin accounts");
    }

    const reauthClient = await createClient();
    const { error: reauthError } = await reauthClient.auth.signInWithPassword({
      email: user.email ?? "",
      password,
    });

    if (reauthError) {
      return apiUnauthorized("Re-authentication failed. Please verify your password.");
    }

    // Verify the clinic exists
    const { data: clinic } = await supabase
      .from("clinics")
      .select("id, name")
      .eq("id", clinicId)
      .single();

    if (!clinic) {
      return apiNotFound("Clinic not found");
    }

    // AUTH-02: Log IP and user agent for every impersonation event
    const clientIp = request.headers.get("cf-connecting-ip")
      ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? "unknown";
    const userAgent = request.headers.get("user-agent") ?? "unknown";

    // Log the impersonation for security audit
    await logSecurityEvent({
      supabase,
      action: "impersonate.start",
      actor: user.email || user.id,
      clinicId,
      clinicName: clinicName || clinic.name,
      description: `Super admin started impersonating clinic: ${clinicName || clinic.name}. Reason: ${reason}`,
      metadata: { reason, targetClinicId: clinicId, ipAddress: clientIp, userAgent },
    });

    // Set impersonation cookie
    const response = apiSuccess({
      success: true,
      clinicId,
      clinicName: clinicName || clinic.name,
    });

    const sessionMaxAge = 60 * 30; // 30 minutes — time-limited for safety

    // A54.2: __Host- prefixed cookies (production) prevent Domain= attribute,
    // blocking subdomain leakage between clinic tenants.
    const cookieOpts = {
      httpOnly: true,
      secure: IS_PROD,
      sameSite: "strict" as const,
      path: "/",
      maxAge: sessionMaxAge,
    };

    response.cookies.set(COOKIE_CLINIC_ID, clinicId, cookieOpts);
    response.cookies.set(COOKIE_CLINIC_NAME, encodeURIComponent(clinicName || clinic.name), cookieOpts);

    // S-11 / AUDIT-14: The impersonation reason is stored in an httpOnly cookie
    // for now. This prevents JS-based exfiltration but the reason text still
    // travels in request headers on every request.
    //
    // TODO: Replace with a server-side impersonation_sessions table:
    //   1. Generate an opaque session UUID
    //   2. INSERT { id, actor_id, target_clinic_id, reason, expires_at } into DB
    //   3. Store only the session UUID in the cookie
    //   4. GET /api/impersonate reads reason from DB by session UUID
    //   5. DELETE /api/impersonate marks the DB row as ended
    //
    // This eliminates reason text from HTTP headers and enables server-side
    // session invalidation, audit queries, and concurrent session limits.
    response.cookies.set(COOKIE_REASON, encodeURIComponent(reason), cookieOpts);

    return response;
}, ["super_admin"]);

/**
 * GET /api/impersonate
 *
 * S-11: Returns the current impersonation state for the signed-in user.
 * The impersonation cookies (`sa_impersonate_clinic_name`,
 * `sa_impersonate_reason`) are `httpOnly: true` — the banner cannot read
 * them via `document.cookie`, so it calls this endpoint instead. Response
 * is `{ clinicName: string, reason: string } | { clinicName: null }`.
 *
 * Only super_admins can be impersonating; `withAuth` enforces that.
 */
export const GET = withAuth(async () => {
  const cookieStore = await cookies();
  const clinicName = cookieStore.get(COOKIE_CLINIC_NAME)?.value ?? null;
  const reason = cookieStore.get(COOKIE_REASON)?.value ?? null;

  if (!clinicName) {
    return apiSuccess({ clinicName: null, reason: null });
  }

  return apiSuccess({
    clinicName: decodeURIComponent(clinicName),
    reason: reason ? decodeURIComponent(reason) : null,
  });
}, ["super_admin"]);

export const DELETE = withAuth(async (_request, { supabase, user }) => {
  try {
    // Log the end of impersonation
    if (user) {
      await logSecurityEvent({
        supabase,
        action: "impersonate.end",
        actor: user.email || user.id,
        clinicId: "system",
        description: "Super admin ended impersonation session",
      });
    }

    const response = apiSuccess({ success: true });

    const clearOpts = {
      httpOnly: true,
      secure: IS_PROD,
      sameSite: "strict" as const,
      path: "/",
      maxAge: 0,
    };

    response.cookies.set(COOKIE_CLINIC_ID, "", clearOpts);
    response.cookies.set(COOKIE_CLINIC_NAME, "", clearOpts);
    response.cookies.set(COOKIE_REASON, "", clearOpts);

    return response;
  } catch (err) {
    logger.warn("Operation failed", { context: "impersonate/route", error: err });
    return apiInternalError("Failed to end impersonation");
  }
}, ["super_admin"]);
