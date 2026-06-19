/**
 * GET /api/auth/impersonate-callback?session=<uuid>
 *
 * Consumes an impersonation session created by
 * `POST /api/super-admin/users/:id/impersonate` and activates the
 * clinic-scoped impersonation cookies that the rest of the app
 * (`GET /api/impersonate`, the ImpersonationBanner, tenant scoping) already
 * understands. The super_admin stays authenticated as themselves — this does
 * NOT mint a session for the target user; impersonation is a server-trusted
 * view scope keyed on `clinic_id`.
 *
 * P1-2 (audit): previously this route did not exist, so the redirect returned
 * by the impersonate POST was a dead link and the whole user-level flow was
 * broken. The session id was also passed in a URL query param — that is only
 * safe because this handler treats it as a *lookup* key, not a capability:
 * it independently re-authenticates the caller via `withAuth(["super_admin"])`
 * and verifies the session's `actor_id` matches the caller's own profile, so
 * a leaked/guessed session id cannot be replayed by anyone else.
 */

import { type NextRequest, NextResponse } from "next/server";
import { logSecurityEvent } from "@/lib/audit-log";
import {
  COOKIE_CLINIC_ID,
  COOKIE_CLINIC_NAME,
  COOKIE_SESSION_ID,
  impersonationCookieOptions,
} from "@/lib/impersonation-cookies";
import { logger } from "@/lib/logger";
import { createAdminClient, createUntypedAdminClient } from "@/lib/supabase-server";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const UUID_RE = /^[0-9a-f-]{36}$/i;

/** Build an absolute redirect URL on the current origin (open-redirect safe). */
function redirectTo(request: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, request.nextUrl.origin));
}

export const GET = (request: NextRequest) =>
  withAuth(
    async (req: NextRequest, { supabase, user, profile }: AuthContext) => {
      // nosemgrep: semgrep.env-access
      if (process.env.IMPERSONATION_ENABLED !== "true") {
        return redirectTo(req, "/unauthorized");
      }

      const sessionId = req.nextUrl.searchParams.get("session");
      if (!sessionId || !UUID_RE.test(sessionId)) {
        return redirectTo(req, "/unauthorized");
      }

      // Look up the session with the untyped admin client (the table is not in
      // the generated Database type and RLS is super_admin-only anyway).
      const untypedClient = createUntypedAdminClient("impersonate-callback");
      // nosemgrep: semgrep.tenant-scoping — impersonation_sessions is a super_admin session table looked up by session id, not clinic-scoped
      const { data: sessionRow } = await untypedClient
        .from("impersonation_sessions")
        .select("id, actor_id, clinic_id, expires_at, ended_at")
        .eq("id", sessionId)
        .maybeSingle();

      const session = sessionRow as {
        id: string;
        actor_id: string;
        clinic_id: string;
        expires_at: string;
        ended_at: string | null;
      } | null;

      // P1-2: The session id from the URL is NOT a bearer token. Bind it to the
      // caller: it must exist, be unexpired/unended, and its actor_id must equal
      // THIS super_admin's profile id. Otherwise a leaked id is inert.
      if (
        !session ||
        session.ended_at !== null ||
        new Date(session.expires_at).getTime() <= Date.now() ||
        session.actor_id !== profile.id
      ) {
        logger.warn("Rejected impersonation callback (missing/expired/foreign session)", {
          context: "impersonate-callback",
          actorProfileId: profile.id,
          // Do not log the session id at info level; it's a lookup key.
          hasSession: Boolean(session),
        });
        return redirectTo(req, "/unauthorized");
      }

      // Resolve the clinic name for the cookie + banner. Soft-deleted clinics
      // cannot be impersonated.
      // nosemgrep: semgrep.admin-client-guard — intentional cross-tenant: super_admin resolves the clinic name across tenants
      const adminClient = createAdminClient("impersonate-callback");
      const { data: clinic } = await adminClient
        .from("clinics")
        .select("id, name")
        .eq("id", session.clinic_id)
        .is("deleted_at", null)
        .maybeSingle();

      if (!clinic) {
        // Clinic vanished/soft-deleted after the session was created — end it.
        // nosemgrep: semgrep.tenant-scoping — ends this super_admin's own session by id; not clinic-scoped
        await untypedClient
          .from("impersonation_sessions")
          .update({ ended_at: new Date().toISOString(), ended_reason: "clinic_unavailable" })
          .eq("id", session.id)
          .is("ended_at", null);
        return redirectTo(req, "/unauthorized");
      }

      // Cookie lifetime tracks the session's remaining lifetime (never longer).
      const remainingMs = new Date(session.expires_at).getTime() - Date.now();
      const maxAge = Math.max(1, Math.floor(remainingMs / 1000));
      const cookieOpts = impersonationCookieOptions(maxAge);

      await logSecurityEvent({
        supabase,
        action: "impersonate.activate",
        actor: user.email || user.id,
        clinicId: session.clinic_id,
        clinicName: clinic.name,
        description: `Super admin ${profile.id} activated impersonation of clinic ${clinic.name}`,
        metadata: { sessionId: session.id, targetClinicId: session.clinic_id },
      });

      // Land on the super-admin dashboard with the impersonation scope active.
      const response = redirectTo(req, "/super-admin");
      response.cookies.set(COOKIE_CLINIC_ID, session.clinic_id, cookieOpts);
      response.cookies.set(COOKIE_CLINIC_NAME, encodeURIComponent(clinic.name), cookieOpts);
      response.cookies.set(COOKIE_SESSION_ID, session.id, cookieOpts);
      return response;
    },
    ["super_admin"],
  )(request);
