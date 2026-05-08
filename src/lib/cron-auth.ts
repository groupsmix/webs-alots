/**
 * Shared cron endpoint authentication helper.
 *
 * DRY: Previously duplicated in cron/reminders/route.ts and cron/billing/route.ts.
 * Verifies the Authorization: Bearer <CRON_SECRET> header using timing-safe comparison.
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "@/lib/crypto-utils";

/**
 * Minimum acceptable length for CRON_SECRET.
 *
 * A100-05: If CRON_SECRET is an empty string (or very short), the
 * timing-safe comparison `timingSafeEqual("", "")` returns true on some
 * implementations, which would let unauthenticated callers execute cron
 * jobs. Requiring >= 32 characters prevents this and ensures adequate
 * entropy.
 */
const MIN_CRON_SECRET_LENGTH = 32;

/**
 * Verify that a cron request carries a valid CRON_SECRET bearer token.
 * Returns `null` if the request is authorized, or a 401 NextResponse to return immediately.
 */
export function verifyCronSecret(request: NextRequest): NextResponse | null {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // A100-05: Reject if secret is missing or too short (prevents empty-string bypass)
  if (!cronSecret || cronSecret.length < MIN_CRON_SECRET_LENGTH) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const providedToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!providedToken || !timingSafeEqual(providedToken, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null; // Authorized
}
