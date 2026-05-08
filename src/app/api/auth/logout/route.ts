/**
 * POST /api/auth/logout
 *
 * A53-01: Dedicated logout endpoint that sets `Clear-Site-Data: "cache",
 * "cookies", "storage"` on the response so the browser purges all
 * origin-scoped state (cookies, localStorage, sessionStorage, Cache API)
 * in a single atomic header, preventing PHI from persisting after sign-out.
 *
 * Why this exists alongside the Server Action signOut():
 * - Server Actions call `redirect()` which emits a 307, and Next.js does not
 *   allow setting arbitrary headers on redirect responses from Server Actions.
 * - The client-side sign-out-button calls this endpoint first, waits for the
 *   browser to process the Clear-Site-Data header, then performs the final
 *   navigation to `/login`.
 *
 * Security notes:
 * - CSRF is protected by the existing middleware Origin check.
 * - The endpoint always responds 200 even on error so the browser still
 *   clears state — the user must never be stuck logged in due to a server error.
 */

import { NextResponse, type NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase-server";

/**
 * A53-01: Clear-Site-Data value.
 * "cache"    — purges Cache API / HTTP cache for the origin
 * "cookies"  — purges all cookies (belt-and-suspenders alongside supabase.auth.signOut)
 * "storage"  — purges localStorage, sessionStorage, IndexedDB
 *
 * NOTE: "executionContexts" is intentionally omitted — it terminates all
 * Service Workers and open windows, which would break any concurrent tabs
 * the user has open and cause a confusing UX.
 */
const CLEAR_SITE_DATA = '"cache", "cookies", "storage"';

export async function POST(_request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (err) {
    // Log but don't fail — browser-side state must still be cleared
    logger.warn("Supabase signOut failed during /api/auth/logout", {
      context: "api/auth/logout",
      error: err,
    });
  }

  // A53-01: Emit Clear-Site-Data to purge all origin-scoped browser state
  const response = NextResponse.json({ ok: true }, { status: 200 });
  response.headers.set("Clear-Site-Data", CLEAR_SITE_DATA);

  // Belt-and-suspenders: also expire the Supabase session cookie explicitly
  // in case signOut() didn't clear it (e.g. cookie was already invalid)
  response.cookies.set("sb-access-token", "", { maxAge: 0, path: "/" });
  response.cookies.set("sb-refresh-token", "", { maxAge: 0, path: "/" });

  return response;
}
