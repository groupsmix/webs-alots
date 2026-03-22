/**
 * Shared cron endpoint authentication helper.
 *
 * DRY: Previously duplicated in cron/reminders/route.ts and cron/billing/route.ts.
 * Verifies the Authorization: Bearer <CRON_SECRET> header using timing-safe comparison.
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "@/lib/crypto-utils";

/**
 * Verify that a cron request carries a valid CRON_SECRET bearer token.
 * Returns `null` if the request is authorized, or a 401 NextResponse to return immediately.
 */
export function verifyCronSecret(request: NextRequest): NextResponse | null {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const providedToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!timingSafeEqual(providedToken, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null; // Authorized
}
