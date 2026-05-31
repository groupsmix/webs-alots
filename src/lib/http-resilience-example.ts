/**
 * A62-D1 / A62-D2 / A62-D3: Example usage of HTTP resilience patterns.
 *
 * This file documents how to use the resilience library in actual route handlers
 * and service functions.
 */

import { resilientFetch, HTTP_TIMEOUTS } from "@/lib/http-resilience";

/**
 * Example 1: Simple external API call with timeout and retries.
 */
export async function fetchPatientFromExternalSystem(patientId: string): Promise<unknown> {
  const response = await resilientFetch(
    `https://external-ehr.example.com/api/patients/${patientId}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${process.env.EXTERNAL_EHR_API_KEY}` },
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
 */
export async function chargePaymentCard(cardToken: string, amountCents: number): Promise<string> {
  const response = await resilientFetch(
    "https://api.stripe.com/v1/payment_intents",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
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
      serviceName: "stripe-payments",
      timeoutMs: HTTP_TIMEOUTS.CRITICAL, // 5s — fail fast for payments
      retryConfig: {
        maxAttempts: 2, // Minimal retries for payments (idempotency risk)
        baseDelayMs: 100,
        maxDelayMs: 5000,
        retryableStatuses: [408, 429, 500, 502, 503, 504],
      },
      circuitBreakerConfig: {
        failureThreshold: 3, // Open after 3 failures
        resetTimeout: 30000, // Try again after 30 seconds
        successThreshold: 1, // One success to close
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Payment failed: ${response.status}`);
  }

  const result = (await response.json()) as Record<string, unknown>;
  return String(result.id);
}

/**
 * Example 4: Health check with streaming timeout.
 */
export async function checkDownstreamHealth(endpoint: string): Promise<boolean> {
  try {
    const response = await resilientFetch(
      endpoint,
      { method: "GET" },
      {
        serviceName: "health-check",
        timeoutMs: HTTP_TIMEOUTS.CRITICAL, // 5s
        retryConfig: {
          maxAttempts: 1, // No retries — just check once
          baseDelayMs: 0,
          maxDelayMs: 0,
          retryableStatuses: [],
        },
      },
    );
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Example 5: Migration guide — replacing old fetch() calls.
 *
 * OLD:
 *   const response = await fetch(url, { method: "POST" });
 *
 * NEW:
 *   const response = await resilientFetch(url, { method: "POST" }, {
 *     serviceName: "my-service",
 *     timeoutMs: 10000,
 *   });
 *
 * Benefits:
 *   - Timeout protection (prevents hanging)
 *   - Circuit breaker (prevents cascading failures)
 *   - Exponential backoff (reduces thundering herd on transients)
 *   - Structured logging (easier debugging)
 */
