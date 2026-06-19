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
  // The AI Builder runs on Groq (Llama 3.3 70B) — see handlers/builder-sandbox.ts.
  GROQ_API_KEY: string;
  // Optional: only the (currently dormant) CopilotKit runtime handler still
  // uses Anthropic. Leave unset unless you re-enable the CopilotKit sidebar;
  // handlers/copilotkit.ts returns a 500 "not configured" when it is absent.
  ANTHROPIC_API_KEY?: string;
  // Optional: the builder no longer creates an E2B sandbox per request
  // (generated code is rendered client-side). Retained for when real
  // server-side code execution is wired back into builder-sandbox.ts.
  E2B_API_KEY?: string;
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
      const value = pair.slice(eq + 1).trim();
      if (!name) return null;
      return { name, value: decodeURIComponent(value) };
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
 * Mirrors the auth check in the original src/app/api/copilotkit/route.ts
 * and src/app/api/builder/sandbox/route.ts.
 */
export async function requireSuperAdmin(
  request: Request,
  env: Env,
): Promise<
  | {
      ok: true;
      userId: string;
      userEmail: string | undefined;
      supabase: ReturnType<typeof createSupabaseClient>;
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
  // user's own role, scoped by their auth UID. (Mirrors the // nosemgrep
  // annotation in the original handler.)
  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();

  if (profile?.role !== "super_admin") {
    return {
      ok: false,
      response: jsonResponse({ error: "Forbidden" }, 403),
    };
  }

  return { ok: true, userId: user.id, userEmail: user.email, supabase };
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
