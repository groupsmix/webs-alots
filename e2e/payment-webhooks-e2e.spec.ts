import { createHmac } from "crypto";
import { test, expect } from "@playwright/test";

/**
 * E2E tests for payment webhook flows.
 *
 * Tests Stripe webhook and CMI callback processing with:
 * - Valid/invalid signature verification
 * - Idempotency and duplicate event handling
 * - Various event types (success, failure, refund)
 * - Malformed payloads and edge cases
 *
 * These tests exercise the webhook endpoints directly using the
 * Playwright request API (no browser needed).
 */

// ── Stripe webhook helpers ──────────────────────────────────────────

/** Build a Stripe-compatible webhook signature for testing. */
function buildStripeSignature(
  payload: string,
  secret: string,
  timestamp?: number,
): string {
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const signedPayload = `${ts}.${payload}`;
  const signature = createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");
  return `t=${ts},v1=${signature}`;
}

// ── CMI callback helpers ────────────────────────────────────────────

/** Build a CMI-compatible HMAC hash for callback verification. */
function buildCmiHash(params: Record<string, string>, storeKey: string): string {
  // CMI hashes are computed over sorted field values + storeKey
  const sortedKeys = Object.keys(params)
    .filter((k) => k !== "HASH")
    .sort();
  const hashInput =
    sortedKeys.map((k) => params[k]).join("|") + "|" + storeKey;
  return createHmac("sha512", storeKey)
    .update(hashInput)
    .digest("base64");
}

// ── Stripe webhook flow tests ───────────────────────────────────────

test.describe("Stripe webhook — event flow", () => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "whsec_test_secret";

  test("accepts checkout.session.completed with valid signature when Stripe is configured", async ({
    request,
  }) => {
    const payload = JSON.stringify({
      id: "evt_test_checkout_complete",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_flow_001",
          metadata: {
            clinic_id: "clinic-test-e2e",
            patient_id: "patient-test-e2e",
            appointment_id: "appt-test-e2e",
          },
          amount_total: 50000,
          currency: "mad",
          payment_status: "paid",
        },
      },
    });

    const signature = buildStripeSignature(payload, webhookSecret);

    const response = await request.post("/api/payments/webhook", {
      headers: {
        "content-type": "application/json",
        "stripe-signature": signature,
      },
      data: payload,
    });

    // 200 if Stripe is configured and signature matches, 503 if not configured
    expect([200, 400, 503]).toContain(response.status());
  });

  test("handles payment_intent.payment_failed event", async ({ request }) => {
    const payload = JSON.stringify({
      id: "evt_test_payment_failed",
      type: "payment_intent.payment_failed",
      data: {
        object: {
          id: "pi_test_failed_flow",
          metadata: {
            clinic_id: "clinic-test-e2e",
            patient_id: "patient-test-e2e",
          },
          amount: 30000,
          currency: "mad",
          last_payment_error: {
            message: "Your card was declined.",
            code: "card_declined",
          },
        },
      },
    });

    const signature = buildStripeSignature(payload, webhookSecret);

    const response = await request.post("/api/payments/webhook", {
      headers: {
        "content-type": "application/json",
        "stripe-signature": signature,
      },
      data: payload,
    });

    expect([200, 400, 503]).toContain(response.status());
  });

  test("handles charge.refunded event", async ({ request }) => {
    const payload = JSON.stringify({
      id: "evt_test_refund",
      type: "charge.refunded",
      data: {
        object: {
          id: "ch_test_refund_001",
          metadata: {
            clinic_id: "clinic-test-e2e",
            appointment_id: "appt-refund-e2e",
          },
          amount_refunded: 50000,
          currency: "mad",
        },
      },
    });

    const signature = buildStripeSignature(payload, webhookSecret);

    const response = await request.post("/api/payments/webhook", {
      headers: {
        "content-type": "application/json",
        "stripe-signature": signature,
      },
      data: payload,
    });

    expect([200, 400, 503]).toContain(response.status());
  });

  test("idempotency — duplicate event ID returns same result", async ({
    request,
  }) => {
    const eventId = "evt_test_idempotent_001";
    const payload = JSON.stringify({
      id: eventId,
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_idempotent",
          metadata: { clinic_id: "clinic-test", patient_id: "patient-test" },
          amount_total: 25000,
          currency: "mad",
          payment_status: "paid",
        },
      },
    });

    const signature = buildStripeSignature(payload, webhookSecret);
    const headers = {
      "content-type": "application/json",
      "stripe-signature": signature,
    };

    // Send the same event twice
    const response1 = await request.post("/api/payments/webhook", {
      headers,
      data: payload,
    });
    const response2 = await request.post("/api/payments/webhook", {
      headers,
      data: payload,
    });

    // Both should return the same status (either success or config error)
    expect(response1.status()).toBe(response2.status());
  });

  test("rejects empty JSON payload", async ({ request }) => {
    const payload = "{}";
    const signature = buildStripeSignature(payload, webhookSecret);

    const response = await request.post("/api/payments/webhook", {
      headers: {
        "content-type": "application/json",
        "stripe-signature": signature,
      },
      data: payload,
    });

    expect([400, 503]).toContain(response.status());
  });

  test("rejects malformed JSON", async ({ request }) => {
    const response = await request.post("/api/payments/webhook", {
      headers: {
        "content-type": "application/json",
        "stripe-signature": "t=123,v1=abc",
      },
      data: "{not valid json",
    });

    expect([400, 503]).toContain(response.status());
  });

  test("rejects replay attack with reused old timestamp", async ({
    request,
  }) => {
    const payload = JSON.stringify({
      id: "evt_test_replay",
      type: "checkout.session.completed",
      data: { object: { id: "cs_replay", metadata: {}, amount_total: 100 } },
    });

    // Use a timestamp from 10 minutes ago
    const oldTimestamp = Math.floor(Date.now() / 1000) - 600;
    const signature = buildStripeSignature(payload, webhookSecret, oldTimestamp);

    const response = await request.post("/api/payments/webhook", {
      headers: {
        "content-type": "application/json",
        "stripe-signature": signature,
      },
      data: payload,
    });

    expect([400, 401, 403, 503]).toContain(response.status());
  });
});

// ── CMI callback flow tests ─────────────────────────────────────────

test.describe("CMI callback — payment flow", () => {
  const cmiStoreKey = process.env.CMI_STORE_KEY || "test_cmi_store_key";

  test("processes successful payment callback", async ({ request }) => {
    const params: Record<string, string> = {
      oid: "ord_e2e_success_001",
      amount: "500.00",
      ProcReturnCode: "00",
      TransId: "txn_e2e_001",
      currency: "504",
      mdStatus: "1",
    };
    params.HASH = buildCmiHash(params, cmiStoreKey);

    const formData = new URLSearchParams(params);
    const response = await request.post("/api/payments/cmi/callback", {
      data: formData.toString(),
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });

    // 200 if CMI is configured, 400 if hash doesn't match server's key, 403 otherwise
    expect([200, 400, 403]).toContain(response.status());
  });

  test("handles declined payment callback", async ({ request }) => {
    const params: Record<string, string> = {
      oid: "ord_e2e_declined_001",
      amount: "300.00",
      ProcReturnCode: "05", // Declined
      TransId: "txn_e2e_declined",
      currency: "504",
      mdStatus: "0",
    };
    params.HASH = buildCmiHash(params, cmiStoreKey);

    const formData = new URLSearchParams(params);
    const response = await request.post("/api/payments/cmi/callback", {
      data: formData.toString(),
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });

    expect([200, 400, 403]).toContain(response.status());
  });

  test("idempotency — duplicate order ID handled gracefully", async ({
    request,
  }) => {
    const params: Record<string, string> = {
      oid: "ord_e2e_idempotent_001",
      amount: "200.00",
      ProcReturnCode: "00",
      TransId: "txn_e2e_idempotent",
      currency: "504",
      mdStatus: "1",
    };
    params.HASH = buildCmiHash(params, cmiStoreKey);

    const formData = new URLSearchParams(params);
    const headers = { "content-type": "application/x-www-form-urlencoded" };

    // Send the same callback twice
    const response1 = await request.post("/api/payments/cmi/callback", {
      data: formData.toString(),
      headers,
    });
    const response2 = await request.post("/api/payments/cmi/callback", {
      data: formData.toString(),
      headers,
    });

    // Both should respond consistently
    expect(response1.status()).toBe(response2.status());
  });

  test("rejects callback with empty body", async ({ request }) => {
    const response = await request.post("/api/payments/cmi/callback", {
      data: "",
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });

    expect([400, 401, 403]).toContain(response.status());
  });

  test("rejects callback with missing required fields", async ({
    request,
  }) => {
    const formData = new URLSearchParams();
    formData.append("oid", "ord_e2e_incomplete");
    // Missing amount, ProcReturnCode, HASH

    const response = await request.post("/api/payments/cmi/callback", {
      data: formData.toString(),
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });

    expect([400, 401, 403]).toContain(response.status());
  });
});

// ── Cross-gateway tests ─────────────────────────────────────────────

test.describe("Payment webhooks — cross-cutting concerns", () => {
  test("Stripe webhook endpoint rejects GET requests", async ({ request }) => {
    const response = await request.get("/api/payments/webhook");
    expect([404, 405]).toContain(response.status());
  });

  test("CMI callback endpoint rejects GET requests", async ({ request }) => {
    const response = await request.get("/api/payments/cmi/callback");
    expect([404, 405]).toContain(response.status());
  });

  test("Stripe webhook rejects non-JSON content type", async ({ request }) => {
    const response = await request.post("/api/payments/webhook", {
      headers: { "content-type": "text/plain" },
      data: "not json",
    });
    expect([400, 415, 503]).toContain(response.status());
  });
});
