/**
 * GET /api/auth/clear-site
 *
 * A56.10: Emit `Clear-Site-Data: "cookies", "storage", "cache"` so the
 * browser discards all authentication cookies and local storage entries
 * immediately on logout — before the Supabase signOut redirect lands.
 *
 * Browsers only honour Clear-Site-Data on an HTTP response header; it
 * cannot be emitted from a Next.js server action (which produces a
 * redirect, not a header-bearing response). This lightweight route is
 * fetched client-side by SignOutButton before `signOut()` is called.
 *
 * Security notes:
 *   - No auth required — the call is intentionally unauthenticated
 *     because the point is to clear credentials that may already be
 *     invalid (expired token, corrupted session).
 *   - The response body is empty; the only meaningful payload is the
 *     Clear-Site-Data header.
 *   - Cache-Control: no-store prevents the browser from caching this
 *     response itself, which would defeat the purpose.
 */

import { NextResponse } from "next/server";

export function GET(): NextResponse {
  const response = new NextResponse(null, { status: 200 });
  // A56.10: Direct the browser to purge cookies, web storage (localStorage,
  // sessionStorage, IndexedDB) and the HTTP cache for this origin.
  response.headers.set(
    "Clear-Site-Data",
    '"cookies", "storage", "cache"',
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
}
