import { test, expect } from "@playwright/test";

/**
 * E2E tests for the payment processing flow.
 *
 * Covers:
 * 1. Stripe checkout session creation — auth, validation, open-redirect prevention
 * 2. Stripe webhook — signature verification, event processing
 * 3. CMI payment gateway — auth, hash verification, callback processing
 * 4. Payment-related pages — unauthenticated access control
 */

test.describe("Stripe checkout — access control", () => {
  // create-checkout is withAuthValidation(..., STAFF_ROLES), but it is NOT a
  // CSRF-exempt route. Playwright's request API sends no Origin header, so the
  // CSRF middleware (src/lib/middleware/csrf.ts) rejects the mutation with 403
  // before the route's auth/validation/config even run. An authenticated
  // browser request would instead be gated by withAuth (401). Either way the
  // unauthenticated caller is denied (401/403) and never reaches validation
  // (422) or the Stripe-config (503) path — those are covered in the unit
  // tests (src/app/api/__tests__/payment-routes.test.ts).
  test("POST /api/payments/create-checkout requires authentication", async ({ request }) => {
    const response = await request.post("/api/payments/create-checkout", {
      data: { amount: 50000, currency: "mad", description: "Consultation payment" },
    });
    expect([401, 403]).toContain(response.status());
  });

  test("POST /api/payments/create-checkout requires auth even with empty body", async ({
    request,
  }) => {
    // Origin-less mutation → CSRF 403 (or 401 if it reached auth); never 422.
    const response = await request.post("/api/payments/create-checkout", { data: {} });
    expect([401, 403]).toContain(response.status());
  });

  test("POST /api/payments/create-checkout requires auth even with an invalid amount", async ({
    request,
  }) => {
    // Denied (CSRF 403 / auth 401) before amount validation runs; the
    // amount-validation teeth live in the unit tests.
    const response = await request.post("/api/payments/create-checkout", {
      data: { amount: -100, currency: "mad", description: "Negative amount test" },
    });
    expect([401, 403]).toContain(response.status());
  });
});

test.describe("Stripe webhook — signature verification", () => {
  // The webhook endpoint has NO user-auth layer, so it never returns 401/403.
  // When STRIPE_SECRET_KEY is unset (the CI default) it returns 503 before
  // reading the body; when configured, an invalid/forged/expired signature is
  // rejected with 400. The security-critical invariant is uniform: an
  // unsigned or badly-signed event must NEVER be accepted (200). The exact
  // signature-verification logic is unit-tested in
  // src/app/api/__tests__/stripe-webhook.test.ts with the secret configured.
  const WEBHOOK_REJECTED = [400, 503];

  test("rejects webhook without stripe-signature header", async ({ request }) => {
    const payload = JSON.stringify({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_123",
          metadata: { clinic_id: "test-clinic", patient_id: "test-patient" },
          amount_total: 50000,
          currency: "mad",
        },
      },
    });

    const response = await request.post("/api/payments/webhook", {
      headers: { "content-type": "application/json" },
      data: payload,
    });
    expect(response.status()).not.toBe(200);
    expect(WEBHOOK_REJECTED).toContain(response.status());
  });

  test("rejects webhook with invalid stripe-signature", async ({ request }) => {
    const payload = JSON.stringify({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_456",
          metadata: { clinic_id: "test-clinic", patient_id: "test-patient" },
          amount_total: 10000,
        },
      },
    });

    const response = await request.post("/api/payments/webhook", {
      headers: {
        "content-type": "application/json",
        "stripe-signature": "t=999999999,v1=invalidhashvalue",
      },
      data: payload,
    });
    expect(response.status()).not.toBe(200);
    expect(WEBHOOK_REJECTED).toContain(response.status());
  });

  test("rejects webhook with expired timestamp in signature", async ({ request }) => {
    const payload = JSON.stringify({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_expired",
          metadata: {},
          amount_total: 5000,
        },
      },
    });

    // Use a timestamp from 10 minutes ago (beyond 5-minute tolerance)
    const expiredTimestamp = Math.floor(Date.now() / 1000) - 600;
    const response = await request.post("/api/payments/webhook", {
      headers: {
        "content-type": "application/json",
        "stripe-signature": `t=${expiredTimestamp},v1=somesignature`,
      },
      data: payload,
    });
    expect(response.status()).not.toBe(200);
    expect(WEBHOOK_REJECTED).toContain(response.status());
  });

  test("rejects webhook with missing timestamp in signature", async ({ request }) => {
    const payload = JSON.stringify({
      type: "payment_intent.payment_failed",
      data: {
        object: {
          id: "pi_test_failed",
          metadata: { clinic_id: "clinic-1" },
        },
      },
    });

    const response = await request.post("/api/payments/webhook", {
      headers: {
        "content-type": "application/json",
        "stripe-signature": "v1=signatureonly",
      },
      data: payload,
    });
    expect(response.status()).not.toBe(200);
    expect(WEBHOOK_REJECTED).toContain(response.status());
  });

  test("rejects checkout.session.completed with forged clinic_id", async ({ request }) => {
    // An attacker tries to mark a payment as completed for another clinic.
    // Signature verification rejects the forged event before metadata is read.
    const payload = JSON.stringify({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_forged_clinic",
          metadata: {
            clinic_id: "attacker-clinic-id",
            patient_id: "victim-patient-id",
            appointment_id: "victim-appointment-id",
          },
          amount_total: 99999,
        },
      },
    });

    const response = await request.post("/api/payments/webhook", {
      headers: {
        "content-type": "application/json",
        "stripe-signature": "t=999999999,v1=forged_signature",
      },
      data: payload,
    });
    expect(response.status()).not.toBe(200);
    expect(WEBHOOK_REJECTED).toContain(response.status());
  });

  test("rejects payment_intent.payment_failed with invalid signature", async ({ request }) => {
    const payload = JSON.stringify({
      type: "payment_intent.payment_failed",
      data: {
        object: {
          id: "pi_test_failed_2",
          metadata: {
            clinic_id: "test-clinic",
            patient_id: "test-patient",
            appointment_id: "test-appt",
          },
          amount_total: 20000,
        },
      },
    });

    const response = await request.post("/api/payments/webhook", {
      headers: {
        "content-type": "application/json",
        "stripe-signature": "t=999999999,v1=bad_sig_for_failed",
      },
      data: payload,
    });
    expect(response.status()).not.toBe(200);
    expect(WEBHOOK_REJECTED).toContain(response.status());
  });
});

test.describe("CMI payment gateway — access control", () => {
  // /api/payments/cmi is withAuthValidation(..., STAFF_ROLES) and is NOT
  // CSRF-exempt, so an origin-less POST is rejected by the CSRF middleware
  // (403) before auth/validation/config run; an unauthenticated browser
  // request would be gated by withAuth (401). Either way it's denied (401/403),
  // never 422/503. Amount validation is unit-tested.
  test("POST /api/payments/cmi requires authentication", async ({ request }) => {
    const response = await request.post("/api/payments/cmi", {
      data: { amount: 200, description: "Consultation" },
    });
    expect([401, 403]).toContain(response.status());
  });

  test("POST /api/payments/cmi requires auth even with empty body", async ({ request }) => {
    const response = await request.post("/api/payments/cmi", { data: {} });
    expect([401, 403]).toContain(response.status());
  });

  test("POST /api/payments/cmi requires auth even with an invalid amount", async ({ request }) => {
    const response = await request.post("/api/payments/cmi", {
      data: { amount: -50, description: "Negative CMI test" },
    });
    expect([401, 403]).toContain(response.status());
  });
});

test.describe("CMI callback — hash verification", () => {
  // The CMI callback is unauthenticated (server-to-server) but HMAC-verified.
  // A bad/missing/tampered hash is rejected with 400 (invalid callback /
  // invalid fields), or 403 when an optional source-IP allowlist is set. It
  // must NEVER return a 2xx success for an unverified hash.
  const CMI_REJECTED = [400, 403, 422];

  test("POST /api/payments/cmi/callback rejects invalid hash", async ({ request }) => {
    const formData = new URLSearchParams();
    formData.append("oid", "ord_test_123");
    formData.append("amount", "200.00");
    formData.append("ProcReturnCode", "00");
    formData.append("TransId", "txn_fake_123");
    formData.append("HASH", "invalidhashvalue");

    const response = await request.post("/api/payments/cmi/callback", {
      data: formData.toString(),
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
    // An unverified hash must be rejected, never accepted as success (2xx).
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(CMI_REJECTED).toContain(response.status());
  });

  test("POST /api/payments/cmi/callback rejects missing hash", async ({ request }) => {
    const formData = new URLSearchParams();
    formData.append("oid", "ord_test_no_hash");
    formData.append("amount", "100.00");
    formData.append("ProcReturnCode", "00");

    const response = await request.post("/api/payments/cmi/callback", {
      data: formData.toString(),
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
    expect(CMI_REJECTED).toContain(response.status());
  });

  test("POST /api/payments/cmi/callback rejects tampered amount", async ({ request }) => {
    // Attacker modifies the amount after CMI processes the payment; the hash
    // computed over the original amount no longer matches → rejected.
    const formData = new URLSearchParams();
    formData.append("oid", "ord_test_tampered");
    formData.append("amount", "99999.00"); // Tampered from original 200.00
    formData.append("ProcReturnCode", "00");
    formData.append("TransId", "txn_real_123");
    formData.append("HASH", "hash_computed_for_original_200");

    const response = await request.post("/api/payments/cmi/callback", {
      data: formData.toString(),
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
    expect(CMI_REJECTED).toContain(response.status());
  });

  test("POST /api/payments/cmi/callback rejects declined payment hash", async ({ request }) => {
    const formData = new URLSearchParams();
    formData.append("oid", "ord_test_declined");
    formData.append("amount", "300.00");
    formData.append("ProcReturnCode", "05"); // Declined
    formData.append("HASH", "wrong_hash_for_declined");

    const response = await request.post("/api/payments/cmi/callback", {
      data: formData.toString(),
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
    expect(CMI_REJECTED).toContain(response.status());
  });
});

test.describe("Payment — open redirect prevention", () => {
  // NOTE: both routes are auth-gated and not CSRF-exempt, so an origin-less
  // caller is rejected (403 by CSRF, or 401 by auth) before successUrl/cancelUrl
  // validation runs. These confirm the gate; the same-origin redirect sanitiser
  // (validateRedirectUrl) is unit-tested directly in
  // src/app/api/__tests__/payment-routes.test.ts.
  test("POST /api/payments/create-checkout requires auth (cross-origin successUrl)", async ({
    request,
  }) => {
    const response = await request.post("/api/payments/create-checkout", {
      data: {
        amount: 10000,
        currency: "mad",
        description: "Test with cross-origin redirect",
        successUrl: "https://attacker.com/phishing",
        cancelUrl: "https://attacker.com/cancel",
      },
    });
    expect([401, 403]).toContain(response.status());
  });

  test("POST /api/payments/cmi requires auth (cross-origin successUrl)", async ({ request }) => {
    const response = await request.post("/api/payments/cmi", {
      data: {
        amount: 200,
        description: "Test with cross-origin redirect",
        successUrl: "https://attacker.com/success",
        failUrl: "https://attacker.com/fail",
      },
    });
    expect([401, 403]).toContain(response.status());
  });
});

test.describe("Payment — booking payment flow access control", () => {
  test("POST /api/booking/payment/initiate requires auth context", async ({ request }) => {
    const response = await request.post("/api/booking/payment/initiate", {
      data: {
        appointmentId: "test-appointment",
        amount: 200,
      },
    });
    expect([401, 403, 404, 405]).toContain(response.status());
  });

  test("POST /api/booking/payment/confirm requires auth context", async ({ request }) => {
    const response = await request.post("/api/booking/payment/confirm", {
      data: {
        paymentId: "test-payment",
        reference: "test-ref",
      },
    });
    expect([401, 403, 404, 405]).toContain(response.status());
  });

  test("POST /api/booking/payment/refund requires auth context", async ({ request }) => {
    const response = await request.post("/api/booking/payment/refund", {
      data: {
        paymentId: "test-payment",
        reason: "Test refund",
      },
    });
    expect([401, 403, 404, 405]).toContain(response.status());
  });
});

test.describe("Payment — body size limits", () => {
  test("does not crash on a webhook advertising an oversized content-length", async ({
    request,
  }) => {
    // NOTE: Playwright recomputes Content-Length from the actual body, so the
    // server sees a 2-byte payload here — this does NOT exercise the 413
    // payload-too-large path (that is unit-tested against readWebhookBody).
    // What this asserts: a spoofed oversized Content-Length header does not
    // crash the endpoint (no 5xx beyond the expected unconfigured-503) and is
    // never accepted as a valid event.
    const response = await request.post("/api/payments/webhook", {
      headers: {
        "content-type": "application/json",
        "content-length": "50000000", // 50 MB (advertised, not sent)
      },
      data: "{}",
    });
    expect(response.status()).not.toBe(200);
    expect([400, 413, 503]).toContain(response.status());
  });
});
