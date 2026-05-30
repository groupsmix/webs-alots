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
 * FP-07: Reject secrets that consist of a single repeated character or
 * other trivially weak patterns (e.g. "aaaa…", "abcabc…").
 * Returns true if the secret has sufficient entropy to be acceptable.
 */
function hasMinimalEntropy(secret: string): boolean {
  // Reject single-character repetition (e.g. "aaaaaaa…")
  const uniqueChars = new Set(secret);
  if (uniqueChars.size < 2) return false;

  // Reject short repeating patterns up to length 4 (e.g. "abababab…", "abcabc…")
  for (let patLen = 2; patLen <= 4; patLen++) {
    const pattern = secret.slice(0, patLen);
    if (pattern.repeat(Math.ceil(secret.length / patLen)).slice(0, secret.length) === secret) {
      return false;
    }
  }

  return true;
}

/**
 * Verify that a cron request carries a valid CRON_SECRET bearer token.
 * Returns `null` if the request is authorized, or a 401 NextResponse to return immediately.
 */
export function verifyCronSecret(request: NextRequest): NextResponse | null {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // A100-05: Reject if secret is missing or too short (prevents empty-string bypass)
  // FP-07: Also reject low-entropy secrets (single repeated char, trivial patterns)
  if (!cronSecret || cronSecret.length < MIN_CRON_SECRET_LENGTH || !hasMinimalEntropy(cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const providedToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!providedToken || !timingSafeEqual(providedToken, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null; // Authorized
}
