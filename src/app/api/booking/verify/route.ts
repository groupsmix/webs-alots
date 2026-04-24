/**
 * POST /api/booking/verify
 *
 * Issues a booking verification token after validating the patient's
 * phone number.  The token is an HMAC-SHA256 signature of the phone
 * number and an expiry timestamp, matching the format expected by
 * `verifyBookingToken` in the main booking route.
 *
 * Token format: "phone:expiryTimestamp:signature"
 *
 * NOTE: Full OTP verification (Twilio SMS) is deferred.  Currently
 * this endpoint issues a token for any syntactically valid phone
 * number so the booking flow works end-to-end.  When phone OTP is
 * activated, an OTP check should be added before token issuance.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withValidation } from "@/lib/api-validate";
import { logger } from "@/lib/logger";
import { requireTenantWithConfig } from "@/lib/tenant";
const bookingVerifySchema = z.object({
  phone: z.string().min(6).max(30),
});

/** Token validity period: 15 minutes. */
const TOKEN_TTL_MS = 15 * 60 * 1000;

export const POST = withValidation(bookingVerifySchema, async (data, _request: NextRequest) => {
  // Ensure we are in a valid tenant context (subdomain resolved)
  await requireTenantWithConfig();

  const { phone } = data;

  const secret = process.env.BOOKING_TOKEN_SECRET;
  if (!secret) {
    logger.error(
      "BOOKING_TOKEN_SECRET is not configured — cannot issue booking tokens",
      { context: "booking/verify" },
    );
    return apiError("Booking verification is not available. Contact the clinic.", 503);
  }

  // Build the token: phone:expiryTimestamp:hmacSignature
  const expiry = Date.now() + TOKEN_TTL_MS;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigData = encoder.encode(`${phone}:${expiry}`);
  const sig = await crypto.subtle.sign("HMAC", key, sigData);
  const signature = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const token = `${phone}:${expiry}:${signature}`;

  return apiSuccess({
    token,
    expiresAt: new Date(expiry).toISOString(),
  });
});
