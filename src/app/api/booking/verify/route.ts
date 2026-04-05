/**
 * POST /api/booking/verify
 *
 * Issues a booking verification token after validating the patient's
 * phone number.  The token is an HMAC-SHA256 signature of the phone
 * number, an expiry timestamp, and a random nonce.
 *
 * Token format: "phone:expiryTimestamp:nonce:signature"
 *
 * NOTE: Full OTP verification (Twilio SMS) is deferred.  Currently
 * this endpoint issues a token for any syntactically valid phone
 * number so the booking flow works end-to-end.  When phone OTP is
 * activated, an OTP check should be added before token issuance.
 */

import { NextRequest } from "next/server";
import { requireTenantWithConfig } from "@/lib/tenant";
import { withValidation } from "@/lib/api-validate";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
const bookingVerifySchema = z.object({
  phone: z.string().min(6).max(30),
});

/** Token validity period: 15 minutes. */
const TOKEN_TTL_MS = 15 * 60 * 1000;

export const POST = withValidation(bookingVerifySchema, async (data, _request: NextRequest) => {
  // Ensure we are in a valid tenant context (subdomain resolved)
  await requireTenantWithConfig();

  const { phone } = data;

  // CRITICAL-02 FIX: Import validated secret from config instead of
  // checking at runtime. The app now fails at startup if the secret
  // is missing, so this code path is guaranteed to have a valid secret.
  const { BOOKING_TOKEN_SECRET: secret } = await import("@/lib/config");

  // Build the token: phone:expiryTimestamp:nonce:hmacSignature
  // The nonce prevents predictable tokens when phone + window are known.
  const expiry = Date.now() + TOKEN_TTL_MS;
  const nonce = crypto.randomUUID();
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigData = encoder.encode(`${phone}:${expiry}:${nonce}`);
  const sig = await crypto.subtle.sign("HMAC", key, sigData);
  const signature = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const token = `${phone}:${expiry}:${nonce}:${signature}`;

  return apiSuccess({
    token,
    expiresAt: new Date(expiry).toISOString(),
  });
});
