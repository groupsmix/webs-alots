/**
 * A62-D1 / A62-D2 / A62-D3: Example usage of HTTP resilience patterns.
 *
 * This file documents how to use the resilience library in actual route handlers
 * and service functions.
 *
 * IMPORTANT: This file is bundled and serves as documentation. In production code:
 * - Use `getExternalEhrApiKey()` (or similar) from `src/lib/env.ts` instead of
 *   bare `process.env.*` (which triggers env-access linting).
 * - Use `getStripeSecretKey()` from `src/lib/env.ts` for Stripe credentials.
 */

import { resilientFetch, HTTP_TIMEOUTS } from "@/lib/http-resilience";
import { getStripeSecretKey } from "@/lib/env";

/**
 * Example 1: Simple external API call with timeout and retries.
 *
 * In production, replace process.env.EXTERNAL_EHR_API_KEY with:
 *   const apiKey = getExternalEhrApiKey();
 */
export async function fetchPatientFromExternalSystem(patientId: string): Promise<unknown> {
  // Illustrative: in real code, use a getter from src/lib/env.ts
  const apiKey = process.env.EXTERNAL_EHR_API_KEY;
  if (!apiKey) {
    throw new Error("EXTERNAL_EHR_API_KEY not configured");
  }

  const response = await resilientFetch(
    `https://external-ehr.example.com/api/patients/${patientId}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    },
    {
      serviceName: "external-ehr",
      timeoutMs: HTTP_TIMEOUTS.DEFAULT, // 10s
      // Uses default retry config (3 attempts, exp backoff)
    },
  );

  if (!response.ok) {
    throw new Error(`External EHR returned ${response.status}`);
  }

  return response.json();
}

/**
 * Example 2: Webhook delivery with longer timeout and custom retry logic.
 */
export async function deliverWebhook(
  webhookUrl: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const response = await resilientFetch(
    webhookUrl,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    {
      serviceName: "webhook-delivery",
      timeoutMs: HTTP_TIMEOUTS.ASYNC, // 30s for webhooks
      retryConfig: {
        maxAttempts: 5,
        baseDelayMs: 500, // Start with 500ms backoff
        maxDelayMs: 60000, // Cap at 1 minute
        retryableStatuses: [408, 429, 500, 502, 503, 504], // Standard retryables
      },
      onRetry: (attemptNumber, reason) => {
        console.log(`Webhook retry ${attemptNumber}: ${reason}`);
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Webhook delivery failed with status ${response.status}`);
  }
}

/**
 * Example 3: Payment processor call with tight timeout and circuit breaker.
 *
 * Uses getStripeSecretKey() from src/lib/env.ts to avoid env-access linting.
 */
export async function chargePaymentCard(cardToken: string, amountCents: number): Promise<string> {
  const stripeKey = getStripeSecretKey();
  if (!stripeKey) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }

  const response = await resilientFetch(
    "https://api.stripe.com/v1/payment_intents",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        amount: String(amountCents),
        currency: "usd",
        payment_method: cardToken,
        confirm: "true",
      }).toString(),
    },
    {
      serviceName: "stripe",
      timeoutMs: HTTP_TIMEOUTS.DEFAULT, // 10s for Stripe (fast SLA)
      retryConfig: {
        maxAttempts: 2, // Minimal retries for payments
        baseDelayMs: 100,
        maxDelayMs: 1000,
        retryableStatuses: [429, 500, 502, 503], // Not 408 (ambiguous for payments)
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Payment processing failed: ${response.status}`);
  }

  const result = (await response.json()) as { id?: string };
  if (!result.id) {
    throw new Error("Stripe returned success but no payment intent ID");
  }

  return result.id;
}
