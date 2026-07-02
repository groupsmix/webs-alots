import { createHash, createHmac } from "crypto";
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
 *
 * Two modes (issue #1131):
 *
 * - CONFIGURED (CI): the e2e job exports deterministic test secrets
 *   (STRIPE_WEBHOOK_SECRET / CMI_SECRET_KEY) to both the web server and this
 *   test process. Stripe/CMI signature verification is pure hashing against
 *   a shared secret — no real gateway account is involved — so the tests
 *   sign their own payloads and assert the valid-signature 200 happy path
 *   STRICTLY. Payloads deliberately reference non-existent orders and
 *   non-UUID clinic ids, so accepted webhooks are acknowledged without
 *   mutating payment state; DB side-effects and dedup rows are covered by
 *   the unit suites (stripe-webhook.test.ts, webhooks-dedup.test.ts).
 *
 * - UNCONFIGURED (e.g. a local run without secrets): signatures are built
 *   with an empty secret the server cannot match, so every delivery must be
 *   REJECTED — never a 2xx. This keeps the suite safe against firing real
 *   side-effects if E2E_BASE_URL points at a staging environment.
 */

// ── Stripe webhook helpers ──────────────────────────────────────────

// When set, this must match the server's STRIPE_WEBHOOK_SECRET (the CI e2e
// job exports the same value to both processes). When unset, we sign with an
// empty string so the server rejects the signature (400/503).
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
const stripeConfigured = stripeWebhookSecret.length > 0;

/** Build a Stripe-compatible webhook signature (t=<ts>,v1=<HMAC-SHA256>). */
function buildStripeSignature(payload: string, secret: string, timestamp?: number): string {
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const signedPayload = `${ts}.${payload}`;
  const signature = createHmac("sha256", secret).update(signedPayload).digest("hex");
  return `t=${ts},v1=${signature}`;
}

// ── CMI callback helpers ────────────────────────────────────────────

// Mirrors the env var the server actually reads in src/lib/cmi.ts
// (getCmiConfig). The previous CMI_STORE_KEY name matched nothing the
// server consumes, so the valid-hash path was unreachable (issue #1131).
const cmiSecretKey = process.env.CMI_SECRET_KEY ?? "";
const cmiConfigured = cmiSecretKey.length > 0;

/** Escape a value for the CMI ver3 hash payload (mirrors escapeCmiValue). */
function escapeCmiValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
}

/**
 * Build a CMI ver3 hash exactly as the server computes it in
 * src/lib/cmi.ts#generateHash:
 *   1. Sort field names case-insensitively (excluding hash/encoding/
 *      hashAlgorithm, which the server strips before reconstruction).
 *   2. Escape `\` and `|` in each value.
 *   3. Join the escaped values with `|` and append the escaped store key.
 *   4. Plain SHA-512 (NOT an HMAC), base64-encoded.
 *
 * With CMI_SECRET_KEY shared between this process and the server (CI), the
 * callback passes verification and the 200 path is exercised; without it
 * the hash cannot match and the callback is rejected.
 */
function buildCmiHash(params: Record<string, string>, storeKey: string): string {
  const sortedKeys = Object.keys(params)
    .filter((k) => {
      const lower = k.toLowerCase();
      return lower !== "hash" && lower !== "encoding" && lower !== "hashalgorithm";
    })
    .sort((a, b) =>
      a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0,
    );
  const hashInput =
    sortedKeys.map((k) => escapeCmiValue(params[k] ?? "")).join("|") +
    "|" +
    escapeCmiValue(storeKey);
  return createHash("sha512").update(hashInput, "utf8").digest("base64");
}

// ── Stripe webhook flow tests ───────────────────────────────────────

test.describe("Stripe webhook — event flow", () => {
  test("accepts a well-formed checkout.session.completed event", async ({ request }) => {
    // The non-UUID clinic_id is deliberate: assertClinicId rejects it, so
    // the handler acknowledges the event without writing payment rows.
    // What this test pins down is the transport layer — a correctly signed
    // event must reach the processing switch and be acked with 200.
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

    const signature = buildStripeSignature(payload, stripeWebhookSecret);

    const response = await request.post("/api/payments/webhook", {
      headers: {
        "content-type": "application/json",
        "stripe-signature": signature,
      },
      data: payload,
    });

    if (stripeConfigured) {
      // Valid signature — the happy path must be a real 200 acceptance,
      // not merely "didn't crash" (issue #1131).
      expect(response.status()).toBe(200);
      expect(await response.json()).toMatchObject({ ok: true, data: { received: true } });
    } else {
      // No shared secret — the server must reject: 400 (invalid signature)
      // or 503 (Stripe not configured). A 200 here would mean signature
      // verification is broken.
      expect([400, 503]).toContain(response.status());
    }
  });

  test("accepts a payment_intent.payment_failed event", async ({ request }) => {
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

    const signature = buildStripeSignature(payload, stripeWebhookSecret);

    const response = await request.post("/api/payments/webhook", {
      headers: {
        "content-type": "application/json",
        "stripe-signature": signature,
      },
      data: payload,
    });

    if (stripeConfigured) {
      expect(response.status()).toBe(200);
      expect(await response.json()).toMatchObject({ ok: true, data: { received: true } });
    } else {
      expect([400, 503]).toContain(response.status());
    }
  });

  test("acknowledges an unhandled event type (charge.refunded)", async ({ request }) => {
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

    const signature = buildStripeSignature(payload, stripeWebhookSecret);

    const response = await request.post("/api/payments/webhook", {
      headers: {
        "content-type": "application/json",
        "stripe-signature": signature,
      },
      data: payload,
    });

    if (stripeConfigured) {
      // Unhandled event types must be acked with 200 so Stripe stops
      // retrying them — a validly signed event must never be rejected
      // just because we don't process its type.
      expect(response.status()).toBe(200);
      expect(await response.json()).toMatchObject({ ok: true, data: { received: true } });
    } else {
      expect([400, 503]).toContain(response.status());
    }
  });

  test("acks a duplicate event delivery idempotently", async ({ request }) => {
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

    const signature = buildStripeSignature(payload, stripeWebhookSecret);
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

    if (stripeConfigured) {
      // Stripe retries until it receives a 2xx, so BOTH deliveries of a
      // valid event must be accepted. Row-level dedup (upsert with
      // onConflict "reference") is verified in webhooks-dedup.test.ts.
      expect(response1.status()).toBe(200);
      expect(response2.status()).toBe(200);
    } else {
      // Without a shared secret both deliveries must be rejected.
      expect(response1.status()).toBeGreaterThanOrEqual(400);
    }

    // In both modes a replayed delivery must be handled deterministically:
    // identical status AND identical body.
    expect(response1.status()).toBe(response2.status());
    expect(await response1.text()).toBe(await response2.text());
  });

  test("rejects empty JSON payload", async ({ request }) => {
    const payload = "{}";
    const signature = buildStripeSignature(payload, stripeWebhookSecret);

    const response = await request.post("/api/payments/webhook", {
      headers: {
        "content-type": "application/json",
        "stripe-signature": signature,
      },
      data: payload,
    });

    if (stripeConfigured) {
      // The signature is VALID here, so this pins down event-schema
      // validation specifically: a signed-but-shapeless payload → 400.
      expect(response.status()).toBe(400);
    } else {
      expect([400, 503]).toContain(response.status());
    }
  });

  test("rejects malformed JSON", async ({ request }) => {
    const response = await request.post("/api/payments/webhook", {
      headers: {
        "content-type": "application/json",
        "stripe-signature": "t=123,v1=abc",
      },
      data: "{not valid json",
    });

    if (stripeConfigured) {
      // Ancient timestamp + bogus v1 → signature verification fails → 400.
      expect(response.status()).toBe(400);
    } else {
      expect([400, 503]).toContain(response.status());
    }
  });

  test("rejects replay attack with reused old timestamp", async ({ request }) => {
    const payload = JSON.stringify({
      id: "evt_test_replay",
      type: "checkout.session.completed",
      data: { object: { id: "cs_replay", metadata: {}, amount_total: 100 } },
    });

    // Use a timestamp from 10 minutes ago — beyond the 5-minute tolerance
    // in verifyStripeSignature.
    const oldTimestamp = Math.floor(Date.now() / 1000) - 600;
    const signature = buildStripeSignature(payload, stripeWebhookSecret, oldTimestamp);

    const response = await request.post("/api/payments/webhook", {
      headers: {
        "content-type": "application/json",
        "stripe-signature": signature,
      },
      data: payload,
    });

    if (stripeConfigured) {
      // With the shared secret the HMAC itself is genuinely valid, so this
      // asserts the timestamp-tolerance check specifically — a stale-but-
      // correctly-signed delivery MUST be rejected (replay protection).
      expect(response.status()).toBe(400);
    } else {
      expect([400, 401, 403, 503]).toContain(response.status());
    }
  });
});

// ── CMI callback flow tests ─────────────────────────────────────────

test.describe("CMI callback — payment flow", () => {
  test("accepts an approved-payment callback with a valid ver3 hash", async ({ request }) => {
    // The order id deliberately matches no payment row: the handler
    // verifies the hash, finds nothing to update, and acks with
    // "ACTION=POSTAUTH". Hash acceptance is what's under test here;
    // payment-state transitions are unit-tested.
    const params: Record<string, string> = {
      oid: "ord_e2e_success_001",
      amount: "500.00",
      ProcReturnCode: "00",
      TransId: "txn_e2e_001",
      currency: "504",
      mdStatus: "1",
    };
    params.HASH = buildCmiHash(params, cmiSecretKey);

    const formData = new URLSearchParams(params);
    const response = await request.post("/api/payments/cmi/callback", {
      data: formData.toString(),
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });

    if (cmiConfigured) {
      // Valid hash — CMI expects the literal ACK body on success.
      expect(response.status()).toBe(200);
      expect(await response.text()).toBe("ACTION=POSTAUTH");
    } else {
      // No shared key — the hash cannot verify: 400 (invalid hash) or
      // 403 (IP allowlist). Never a 2xx for an unverified hash.
      expect([400, 403]).toContain(response.status());
    }
  });

  test("accepts a declined-payment callback with a valid ver3 hash", async ({ request }) => {
    const params: Record<string, string> = {
      oid: "ord_e2e_declined_001",
      amount: "300.00",
      ProcReturnCode: "05", // Declined
      TransId: "txn_e2e_declined",
      currency: "504",
      mdStatus: "0",
    };
    params.HASH = buildCmiHash(params, cmiSecretKey);

    const formData = new URLSearchParams(params);
    const response = await request.post("/api/payments/cmi/callback", {
      data: formData.toString(),
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });

    if (cmiConfigured) {
      // Declined payments are still valid callbacks — CMI must receive the
      // ACK so it does not retry the delivery.
      expect(response.status()).toBe(200);
      expect(await response.text()).toBe("ACTION=POSTAUTH");
    } else {
      expect([400, 403]).toContain(response.status());
    }
  });

  test("acks a duplicate callback delivery deterministically", async ({ request }) => {
    const params: Record<string, string> = {
      oid: "ord_e2e_idempotent_001",
      amount: "200.00",
      ProcReturnCode: "00",
      TransId: "txn_e2e_idempotent",
      currency: "504",
      mdStatus: "1",
    };
    params.HASH = buildCmiHash(params, cmiSecretKey);

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

    if (cmiConfigured) {
      // Both valid deliveries must be acked so CMI stops retrying. Replay
      // no-op semantics (cmi_callbacks_seen dedup) require a seeded payment
      // row and are unit-tested.
      expect(response1.status()).toBe(200);
      expect(response2.status()).toBe(200);
      expect(await response1.text()).toBe("ACTION=POSTAUTH");
    } else {
      // Unverified hash — both deliveries rejected, never a 2xx.
      expect(response1.status()).toBeGreaterThanOrEqual(400);
    }

    expect(response1.status()).toBe(response2.status());
    expect(await response1.text()).toBe(await response2.text());
  });

  test("rejects callback with empty body", async ({ request }) => {
    const response = await request.post("/api/payments/cmi/callback", {
      data: "",
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });

    expect([400, 401, 403]).toContain(response.status());
  });

  test("rejects callback with missing required fields", async ({ request }) => {
    const formData = new URLSearchParams();
    formData.append("oid", "ord_e2e_incomplete");
    // Missing amount, ProcReturnCode, HASH

    const response = await request.post("/api/payments/cmi/callback", {
      data: formData.toString(),
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });

    expect([400, 401, 403]).toContain(response.status());
  });

  test("rejects callback with a tampered field and stale hash", async ({ request }) => {
    // Sign one set of fields, then mutate a value after hashing — the
    // reconstructed hash must not match, regardless of configuration.
    const params: Record<string, string> = {
      oid: "ord_e2e_tampered_001",
      amount: "100.00",
      ProcReturnCode: "00",
      TransId: "txn_e2e_tampered",
      currency: "504",
      mdStatus: "1",
    };
    params.HASH = buildCmiHash(params, cmiSecretKey);
    params.amount = "9999.00"; // tamper after signing

    const formData = new URLSearchParams(params);
    const response = await request.post("/api/payments/cmi/callback", {
      data: formData.toString(),
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });

    expect([400, 403]).toContain(response.status());
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
