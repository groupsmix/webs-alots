/**
 * POST /api/booking/verify
 *
 * Issues a booking verification token after validating the patient's
 * phone number.  The token is an HMAC-SHA256 signature over the
 * tenant's clinic id, the phone number, and an expiry timestamp,
 * matching the format expected by `verifyBookingToken` in the main
 * booking route.
 *
 * Token format: "clinicId:phone:expiryTimestamp:signature"
 *
 * A6-13: The `clinicId` is part of the signed payload (not just the
 * token plaintext) so a token issued under tenant A cannot be replayed
 * against tenant B even if both tenants share `BOOKING_TOKEN_SECRET`.
 *
 * NOTE: Full OTP verification (Twilio SMS) is deferred.  Currently
 * this endpoint issues a token for any syntactically valid phone
 * number so the booking flow works end-to-end.  When phone OTP is
 * activated, an OTP check should be added before token issuance.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiRateLimited, apiSuccess } from "@/lib/api-response";
import { withValidation } from "@/lib/api-validate";
import { logger } from "@/lib/logger";
import { createRateLimiter, extractClientIp } from "@/lib/rate-limit";
import { requireTenantWithConfig } from "@/lib/tenant";
const bookingVerifySchema = z.object({
  phone: z.string().min(6).max(30),
});

/** Token validity period: 15 minutes. */
const TOKEN_TTL_MS = 15 * 60 * 1000;

// SECURITY FIX: Rate limit token issuance to prevent bots from flooding
// the system with booking tokens. 10 requests per IP per 15 minutes,
// fail-closed to prevent abuse during rate-limit backend outages.
const verifyLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10, failClosed: true });

export const POST = withValidation(bookingVerifySchema, async (data, request: NextRequest) => {
  // Rate limit before any processing
  const clientIp = extractClientIp(request);
  const allowed = await verifyLimiter.check(`booking-verify:${clientIp}`);
  if (!allowed) {
    return apiRateLimited("Too many verification requests. Please try again later.");
  }

  // Ensure we are in a valid tenant context (subdomain resolved) and
  // pull the clinicId — it becomes part of the signed token payload
  // so the issued token is bound to this tenant (A6-13).
  const { tenant } = await requireTenantWithConfig();
  const clinicId = tenant.clinicId;

  const { phone } = data;

  const secret = process.env.BOOKING_TOKEN_SECRET;
  if (!secret) {
    logger.error(
      "BOOKING_TOKEN_SECRET is not configured — cannot issue booking tokens",
      { context: "booking/verify" },
    );
    return apiError("Booking verification is not available. Contact the clinic.", 503);
  }

  // Build the token: clinicId:phone:expiryTimestamp:hmacSignature
  // The clinicId is part of the signed payload (not just the token
  // plaintext) so a token issued for clinic A cannot be replayed
  // against clinic B with the same shared secret.
  const expiry = Date.now() + TOKEN_TTL_MS;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigData = encoder.encode(`${clinicId}:${phone}:${expiry}`);
  const sig = await crypto.subtle.sign("HMAC", key, sigData);
  const signature = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const token = `${clinicId}:${phone}:${expiry}:${signature}`;

  return apiSuccess({
    token,
    expiresAt: new Date(expiry).toISOString(),
  });
});
