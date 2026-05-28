import { cookies } from "next/headers";
import { apiSuccess, apiInternalError, apiNotFound, apiUnauthorized } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logSecurityEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { createClient, createAdminClient, createUntypedAdminClient } from "@/lib/supabase-server";
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
const COOKIE_SESSION_ID = `${COOKIE_PREFIX}sa_impersonate_session_id`;

/**
 * POST /api/impersonate
 *
 * Allows a super_admin to impersonate a clinic. Creates a server-side
 * impersonation session (audit finding #6) and stores only the session
 * UUID + clinic identifiers in secure cookies.
 *
 * Body: { clinicId: string, clinicName: string, reason: string }
 *
 * DELETE /api/impersonate
 *
 * Ends the impersonation session by marking the DB row as ended and
 * clearing the cookies.
 */
export const POST = withAuthValidation(
  impersonateSchema,
  async (body, request, { supabase, user }) => {
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
    const clientIp =
      request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
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

    const sessionMaxAge = 60 * 30; // 30 minutes — time-limited for safety

    // AUDIT FINDING #6: Create a server-side impersonation session.
    // The reason is stored in the DB, not in the cookie. This enables
    // server-side invalidation, audit queries, and concurrent session limits.
    let sessionId: string | null = null;
    try {
      const adminClient = createAdminClient("impersonate");
      const expiresAt = new Date(Date.now() + sessionMaxAge * 1000).toISOString();

      // Look up the user's profile ID for the actor_id FK
      const { data: profile } = await adminClient
        .from("users")
        .select("id")
        .eq("auth_id", user.id)
        .single();

      if (profile) {
        const untypedClient = createUntypedAdminClient("impersonate");
        const { data: session, error: sessionError } = await untypedClient
          .from("impersonation_sessions")
          .insert({
            actor_id: profile.id,
            clinic_id: clinicId,
            reason,
            expires_at: expiresAt,
          })
          .select("id")
          .single();

        if (sessionError) {
          logger.warn("Failed to create impersonation session row", {
            context: "impersonate",
            error: sessionError,
          });
        } else if (session) {
          sessionId = (session as { id: string }).id;
        }
      }
    } catch (err) {
      logger.warn("Impersonation session creation failed (non-blocking)", {
        context: "impersonate",
        error: err,
      });
    }

    const response = apiSuccess({
      success: true,
      clinicId,
      clinicName: clinicName || clinic.name,
    });

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
    response.cookies.set(
      COOKIE_CLINIC_NAME,
      encodeURIComponent(clinicName || clinic.name),
      cookieOpts,
    );

    // Store the session UUID in the cookie instead of the reason text.
    // GET /api/impersonate reads the reason from the DB by session UUID.
    if (sessionId) {
      response.cookies.set(COOKIE_SESSION_ID, sessionId, cookieOpts);
    }

    return response;
  },
  ["super_admin"],
);

/**
 * GET /api/impersonate
 *
 * S-11: Returns the current impersonation state for the signed-in user.
 * The impersonation cookies (`sa_impersonate_clinic_name`,
 * `sa_impersonate_session_id`) are `httpOnly: true` — the banner cannot read
 * them via `document.cookie`, so it calls this endpoint instead. Response
 * is `{ clinicName: string, reason: string } | { clinicName: null }`.
 *
 * AUDIT FINDING #6: Reads the reason from the server-side
 * impersonation_sessions table by session UUID, not from a cookie.
 */
export const GET = withAuth(async () => {
  const cookieStore = await cookies();
  const clinicName = cookieStore.get(COOKIE_CLINIC_NAME)?.value ?? null;
  const sessionId = cookieStore.get(COOKIE_SESSION_ID)?.value ?? null;

  if (!clinicName) {
    return apiSuccess({ clinicName: null, reason: null });
  }

  let reason: string | null = null;
  if (sessionId) {
    try {
      const untypedClient = createUntypedAdminClient("impersonate");
      const { data: session } = await untypedClient
        .from("impersonation_sessions")
        .select("reason, ended_at, expires_at")
        .eq("id", sessionId)
        .single();

      const s = session as { reason: string; ended_at: string | null; expires_at: string } | null;
      if (s && !s.ended_at && new Date(s.expires_at) > new Date()) {
        reason = s.reason;
      }
    } catch {
      // Fall back to no reason if DB lookup fails
    }
  }

  return apiSuccess({
    clinicName: decodeURIComponent(clinicName),
    reason,
  });
}, ["super_admin"]);

export const DELETE = withAuth(
  async (_request, { supabase, user }) => {
    try {
      const cookieStore = await cookies();
      const sessionId = cookieStore.get(COOKIE_SESSION_ID)?.value ?? null;

      // AUDIT FINDING #6: Mark the server-side session as ended
      if (sessionId) {
        try {
          const untypedClient = createUntypedAdminClient("impersonate");
          await untypedClient
            .from("impersonation_sessions")
            .update({ ended_at: new Date().toISOString(), ended_reason: "manual" })
            .eq("id", sessionId)
            .is("ended_at", null);
        } catch (err) {
          logger.warn("Failed to end impersonation session row", {
            context: "impersonate",
            error: err,
          });
        }
      }

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
      response.cookies.set(COOKIE_SESSION_ID, "", clearOpts);

      return response;
    } catch (err) {
      logger.warn("Failed to process impersonation request", {
        context: "impersonate/route",
        error: err,
      });
      return apiInternalError("Failed to end impersonation");
    }
  },
  ["super_admin"],
);
