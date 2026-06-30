/**
 * Supabase server client for the AI Worker.
 *
 * This is a standalone Cloudflare Worker (NOT a Next.js route), so we cannot
 * use `next/headers` like the main app's `src/lib/supabase-server.ts` does.
 * Instead we parse the Cookie header directly from the incoming Request and
 * hand it to @supabase/ssr's createServerClient.
 *
 * The auth flow is identical to the main app:
 *   1. Browser sends request with sb-<project>-auth-token cookies.
 *   2. We construct a server client bound to those cookies.
 *   3. supabase.auth.getUser() validates the JWT against Supabase Auth.
 *
 * This Worker never SETS cookies (it does not perform sign-in / sign-out);
 * setAll is a no-op.
 */

import { createServerClient } from "@supabase/ssr";

export interface Env {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  // ── AI provider secrets ───────────────────────────────────────────────
  // The CopilotKit handler (handlers/copilotkit.ts) uses exactly one of these
  // provider configs — at least one MUST be set:
  //   • OPENAI_API_KEY (+ optional OPENAI_BASE_URL / OPENAI_MODEL) for any
  //     OpenAI-compatible endpoint, OR
  //   • ANTHROPIC_API_KEY for the Anthropic adapter.
  // No other provider keys are consumed by this Worker (the GROQ/Google/
  // DeepSeek/Mistral/xAI/E2B keys belonged to the removed AI Builder).
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string; // OpenAI-compatible endpoint (e.g. mimo)
  OPENAI_MODEL?: string; // model id for the OpenAI-compatible provider
  ANTHROPIC_API_KEY?: string; // consumed by the CopilotKit Anthropic adapter
}

interface ParsedCookie {
  name: string;
  value: string;
}

/**
 * Parse a "Cookie:" header value into an array of { name, value } objects.
 * Matches the shape @supabase/ssr expects from getAll().
 */
function parseCookieHeader(cookieHeader: string | null): ParsedCookie[] {
  if (!cookieHeader) return [];
  return cookieHeader
    .split(";")
    .map((pair) => {
      const eq = pair.indexOf("=");
      if (eq === -1) return null;
      const name = pair.slice(0, eq).trim();
      const rawValue = pair.slice(eq + 1).trim();
      if (!name) return null;
      // Cookie values are percent-encoded by @supabase/ssr when set, but a
      // malformed value (e.g. a stray "%" that isn't a valid escape) would make
      // decodeURIComponent throw URIError and 500 the whole request. Fall back
      // to the raw value rather than crashing on a single bad cookie.
      let value: string;
      try {
        value = decodeURIComponent(rawValue);
      } catch {
        value = rawValue;
      }
      return { name, value };
    })
    .filter((c): c is ParsedCookie => c !== null);
}

/**
 * Create a Supabase server client bound to the cookies of the incoming
 * Request. Matches the auth semantics of the main app's createClient().
 */
export function createSupabaseClient(request: Request, env: Env) {
  const cookies = parseCookieHeader(request.headers.get("cookie"));

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookies;
      },
      setAll() {
        // No-op: this Worker is read-only with respect to auth state.
        // The main Worker (webs-alots) owns sign-in / sign-out flows.
      },
    },
  });
}

/**
 * Verify the calling user is authenticated AND has super_admin role.
 * Returns the user record on success, or a Response (401/403) to return
 * immediately on failure.
 *
 * Mirrors the auth check in the original src/app/api/copilotkit/route.ts.
 */
export async function requireSuperAdmin(
  request: Request,
  env: Env,
): Promise<
  | {
      ok: true;
      userId: string;
      userEmail: string | undefined;
    }
  | { ok: false; response: Response }
> {
  const supabase = createSupabaseClient(request, env);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      ok: false,
      response: jsonResponse({ error: "Unauthorized" }, 401),
    };
  }

  // super_admin users have no clinic_id; this query fetches the calling
  // user's own role, scoped by their auth UID.
  //
  // BUGFIX: the auth UID (auth.users.id / user.id) maps to the public.users
  // `auth_id` column, NOT the `users.id` primary key. Querying `.eq("id",
  // user.id)` matched zero rows for every account (no row has id == auth_id),
  // so this returned 403 Forbidden for ALL callers — including valid
  // super_admins — silently breaking the CopilotKit endpoint even when keys
  // were configured. The rest of the app (with-auth.ts, AgentWidgetMount)
  // correctly keys on `auth_id`.
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role")
    .eq("auth_id", user.id)
    .single();

  // Distinguish "no matching user / not a super_admin" (legitimate 403) from a
  // real backend failure (500). .single() returns PGRST116 when zero rows
  // match — that means the auth user has no profile row, which is a Forbidden
  // case. Any OTHER error is an infrastructure fault and must NOT be masked as
  // a permission denial (the previous code ignored the error entirely and
  // returned 403 for transient DB outages).
  if (profileError) {
    if (profileError.code === "PGRST116") {
      return { ok: false, response: jsonResponse({ error: "Forbidden" }, 403) };
    }
    console.error("[webs-alots-ai] role lookup failed", profileError);
    return { ok: false, response: jsonResponse({ error: "Internal Server Error" }, 500) };
  }

  if (profile?.role !== "super_admin") {
    return {
      ok: false,
      response: jsonResponse({ error: "Forbidden" }, 403),
    };
  }

  return { ok: true, userId: user.id, userEmail: user.email };
}

export function jsonResponse(body: unknown, status = 200, extraHeaders: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}
