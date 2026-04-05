/**
 * Shared Stripe webhook signature verification.
 *
 * Implements Stripe's HMAC-SHA256 signature scheme without requiring the
 * Stripe SDK. Used by both payment and billing webhook handlers.
 *
 * Stripe signature header format:
 *   stripe-signature: t=<unix_timestamp>,v1=<hex_hmac>
 *
 * Signed payload: "<timestamp>.<raw_body>"
 *
 * References:
 *   https://stripe.com/docs/webhooks/signatures
 */

import { hmacSha256Hex, timingSafeEqual } from "@/lib/crypto-utils";
import { logger } from "@/lib/logger";

// ── Stripe Refund ────────────────────────────────────────────────────────────

/** Base URL for Stripe's REST API (v1). */
const STRIPE_API_BASE = "https://api.stripe.com/v1";

/**
 * Result of a programmatic Stripe refund request.
 *
 * - ok: true  — Stripe accepted the refund; `refundId` is the `re_...` ID.
 * - ok: false — Stripe rejected or the request failed; `error` describes why.
 */
export type StripeRefundResult =
  | { ok: true; refundId: string }
  | { ok: false; error: string };

/**
 * Issue a refund via Stripe's Refunds API.
 *
 * Uses the Stripe Checkout Session ID (stored as `reference` on the payment
 * row) to retrieve the underlying PaymentIntent, then refunds the requested
 * amount in the smallest currency unit (centimes for MAD).
 *
 * @param sessionId   - The Stripe Checkout Session ID (`cs_...`).
 * @param amountMad   - Amount to refund in MAD (e.g. 150.00). Converted to
 *                      centimes (× 100) before sending to Stripe.
 * @param reason      - Optional refund reason shown in Stripe Dashboard.
 *                      One of: "duplicate", "fraudulent", "requested_by_customer".
 */
export async function refundStripePayment(
  sessionId: string,
  amountMad: number,
  reason?: "duplicate" | "fraudulent" | "requested_by_customer",
): Promise<StripeRefundResult> {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return { ok: false, error: "STRIPE_SECRET_KEY is not configured" };
  }

  try {
    // Step 1: Retrieve the session to get the payment_intent ID.
    const sessionRes = await fetch(
      `${STRIPE_API_BASE}/checkout/sessions/${encodeURIComponent(sessionId)}`,
      {
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          "Stripe-Version": "2023-10-16",
        },
      },
    );

    if (!sessionRes.ok) {
      const body = await sessionRes.text();
      logger.error("Failed to retrieve Stripe session for refund", {
        context: "stripe/refund",
        sessionId,
        status: sessionRes.status,
        body,
      });
      return { ok: false, error: `Stripe session lookup failed (HTTP ${sessionRes.status})` };
    }

    const session = await sessionRes.json();
    const paymentIntentId: string | undefined = session.payment_intent;

    if (!paymentIntentId) {
      logger.error("Stripe session has no payment_intent — cannot refund", {
        context: "stripe/refund",
        sessionId,
        mode: session.mode,
      });
      return { ok: false, error: "Session has no associated PaymentIntent" };
    }

    // Step 2: Create a refund against the PaymentIntent.
    // Stripe amounts are in the smallest currency unit (centimes for MAD).
    const amountCentimes = Math.round(amountMad * 100);
    const refundParams = new URLSearchParams({
      payment_intent: paymentIntentId,
      amount: String(amountCentimes),
    });
    if (reason) refundParams.set("reason", reason);

    const refundRes = await fetch(`${STRIPE_API_BASE}/refunds`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Stripe-Version": "2023-10-16",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: refundParams.toString(),
    });

    const refundBody = await refundRes.json();

    if (!refundRes.ok) {
      logger.error("Stripe refund API rejected the request", {
        context: "stripe/refund",
        sessionId,
        paymentIntentId,
        status: refundRes.status,
        stripeError: refundBody?.error,
      });
      return {
        ok: false,
        error: refundBody?.error?.message ?? `Stripe refund failed (HTTP ${refundRes.status})`,
      };
    }

    logger.info("Stripe refund issued successfully", {
      context: "stripe/refund",
      sessionId,
      paymentIntentId,
      refundId: refundBody.id,
      amountCentimes,
    });

    return { ok: true, refundId: refundBody.id as string };
  } catch (err) {
    logger.error("Unexpected error issuing Stripe refund", {
      context: "stripe/refund",
      sessionId,
      error: err,
    });
    return { ok: false, error: "Unexpected error contacting Stripe" };
  }
}

/** Stripe's recommended replay-attack tolerance window (5 minutes). */
const TIMESTAMP_TOLERANCE_SECONDS = 300;

/**
 * Result of webhook signature verification.
 *
 * - "valid"   — signature is correct and timestamp is within tolerance.
 * - "expired" — HMAC is valid but the timestamp is too old (replay attack).
 * - "invalid" — signature is missing, malformed, or HMAC does not match.
 */
export type StripeVerifyResult = "valid" | "expired" | "invalid";

/**
 * Verify a Stripe webhook signature.
 *
 * Returns a discriminated result so callers can distinguish replay-attack
 * rejections from forged-signature rejections in logs and responses.
 *
 * @param rawBody         - The raw request body string (must not be parsed first).
 * @param signatureHeader - Value of the `stripe-signature` request header.
 * @param secret          - The webhook endpoint secret (STRIPE_WEBHOOK_SECRET).
 * @param context         - Logging context label (e.g. "payments/webhook").
 */
export async function verifyStripeWebhook(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  context: string,
): Promise<StripeVerifyResult> {
  try {
    // Parse "t=<timestamp>,v1=<sig>[,v1=<sig2>...]"
    const parts = signatureHeader.split(",");
    let timestampStr = "";
    let signature = "";

    for (const part of parts) {
      const eqIdx = part.indexOf("=");
      if (eqIdx === -1) continue;
      const key = part.slice(0, eqIdx).trim();
      const value = part.slice(eqIdx + 1).trim();
      if (key === "t") timestampStr = value;
      if (key === "v1" && !signature) signature = value; // use first v1 only
    }

    // Both fields are required
    if (!timestampStr || !signature) {
      logger.warn("Stripe webhook missing timestamp or signature", { context });
      return "invalid";
    }

    // Guard against NaN: parseInt("abc", 10) === NaN, and
    // Math.abs(now - NaN) === NaN which is never > 300 — the check would
    // silently pass a malformed header.
    const timestamp = parseInt(timestampStr, 10);
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      logger.warn("Stripe webhook has non-numeric or negative timestamp", {
        context,
        timestampStr,
      });
      return "invalid";
    }

    // Replay-attack check: reject events older than the tolerance window.
    const nowSeconds = Math.floor(Date.now() / 1000);
    const ageSecs = nowSeconds - timestamp;
    if (ageSecs > TIMESTAMP_TOLERANCE_SECONDS) {
      logger.warn("Stripe webhook timestamp too old — possible replay attack", {
        context,
        ageSecs,
        toleranceSecs: TIMESTAMP_TOLERANCE_SECONDS,
      });
      return "expired";
    }

    // Also reject future-dated timestamps (clock skew tolerance: same window)
    if (ageSecs < -TIMESTAMP_TOLERANCE_SECONDS) {
      logger.warn("Stripe webhook timestamp is in the future", {
        context,
        ageSecs,
      });
      return "invalid";
    }

    // Verify HMAC: signed_payload = "<timestamp>.<raw_body>"
    const signedPayload = `${timestampStr}.${rawBody}`;
    const expectedSignature = await hmacSha256Hex(secret, signedPayload);

    if (!timingSafeEqual(expectedSignature, signature)) {
      logger.warn("Stripe webhook HMAC mismatch", { context });
      return "invalid";
    }

    return "valid";
  } catch (err) {
    logger.error("Stripe webhook signature verification threw an error", {
      context,
      error: err,
    });
    return "invalid";
  }
}
