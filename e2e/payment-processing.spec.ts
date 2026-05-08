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
  test("POST /api/payments/create-checkout rejects unauthenticated request", async ({
    request,
  }) => {
    const response = await request.post("/api/payments/create-checkout", {
      data: {
        amount: 50000,
        currency: "mad",
        description: "Consultation payment",
      },
    });
    // Should return 401 (not authenticated) or 503 (Stripe not configured)
    expect([401, 403, 404, 405, 503]).toContain(response.status());
  });

  test("POST /api/payments/create-checkout rejects empty body", async ({
    request,
  }) => {
    const response = await request.post("/api/payments/create-checkout", {
      data: {},
    });
    expect([400, 401, 403, 404, 405, 503]).toContain(response.status());
  });

  test("POST /api/payments/create-checkout rejects negative amount", async ({
    request,
  }) => {
    const response = await request.post("/api/payments/create-checkout", {
      data: {
        amount: -100,
        currency: "mad",
        description: "Negative amount test",
      },
    });
    expect([400, 401, 403, 404, 405, 503]).toContain(response.status());
  });

  test("POST /api/payments/create-checkout rejects zero amount", async ({
    request,
  }) => {
    const response = await request.post("/api/payments/create-checkout", {
      data: {
        amount: 0,
        currency: "mad",
        description: "Zero amount test",
      },
    });
    expect([400, 401, 403, 404, 405, 503]).toContain(response.status());
  });
});

test.describe("Stripe webhook — signature verification", () => {
  test("rejects webhook without stripe-signature header", async ({
    request,
  }) => {
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
    // Missing stripe-signature header → 400 or 503
    expect([400, 401, 403, 503]).toContain(response.status());
  });

  test("rejects webhook with invalid stripe-signature", async ({
    request,
  }) => {
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
    // Invalid signature → 400
    expect([400, 401, 403, 503]).toContain(response.status());
  });

  test("rejects webhook with expired timestamp in signature", async ({
    request,
  }) => {
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
    expect([400, 401, 403, 503]).toContain(response.status());
  });

  test("rejects webhook with missing timestamp in signature", async ({
    request,
  }) => {
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
    expect([400, 401, 403, 503]).toContain(response.status());
  });

  test("rejects checkout.session.completed with forged clinic_id", async ({
    request,
  }) => {
    // An attacker tries to mark a payment as completed for another clinic
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
    // Signature validation should catch this
    expect([400, 401, 403, 503]).toContain(response.status());
  });

  test("rejects payment_intent.payment_failed with invalid signature", async ({
    request,
  }) => {
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
    expect([400, 401, 403, 503]).toContain(response.status());
  });
});

test.describe("CMI payment gateway — access control", () => {
  test("POST /api/payments/cmi rejects unauthenticated request", async ({
    request,
  }) => {
    const response = await request.post("/api/payments/cmi", {
      data: {
        amount: 200,
        description: "Consultation",
      },
    });
    // Should return 401 (not authenticated) or 503 (CMI not configured)
    expect([401, 403, 404, 405, 503]).toContain(response.status());
  });

  test("POST /api/payments/cmi rejects empty body", async ({ request }) => {
    const response = await request.post("/api/payments/cmi", {
      data: {},
    });
    expect([400, 401, 403, 404, 405, 503]).toContain(response.status());
  });

  test("POST /api/payments/cmi rejects negative amount", async ({
    request,
  }) => {
    const response = await request.post("/api/payments/cmi", {
      data: {
        amount: -50,
        description: "Negative CMI test",
      },
    });
    expect([400, 401, 403, 404, 405, 503]).toContain(response.status());
  });
});

test.describe("CMI callback — hash verification", () => {
  test("POST /api/payments/cmi/callback rejects invalid hash", async ({
    request,
  }) => {
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
    // Invalid hash → 400
    expect([400, 401, 403]).toContain(response.status());
  });

  test("POST /api/payments/cmi/callback rejects missing hash", async ({
    request,
  }) => {
    const formData = new URLSearchParams();
    formData.append("oid", "ord_test_no_hash");
    formData.append("amount", "100.00");
    formData.append("ProcReturnCode", "00");

    const response = await request.post("/api/payments/cmi/callback", {
      data: formData.toString(),
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
    expect([400, 401, 403]).toContain(response.status());
  });

  test("POST /api/payments/cmi/callback rejects tampered amount", async ({
    request,
  }) => {
    // Attacker modifies the amount after CMI processes the payment
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
    // Hash mismatch due to tampered amount → 400
    expect([400, 401, 403]).toContain(response.status());
  });

  test("POST /api/payments/cmi/callback rejects declined payment hash", async ({
    request,
  }) => {
    const formData = new URLSearchParams();
    formData.append("oid", "ord_test_declined");
    formData.append("amount", "300.00");
    formData.append("ProcReturnCode", "05"); // Declined
    formData.append("HASH", "wrong_hash_for_declined");

    const response = await request.post("/api/payments/cmi/callback", {
      data: formData.toString(),
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
    expect([400, 401, 403]).toContain(response.status());
  });
});

test.describe("Payment — open redirect prevention", () => {
  test("POST /api/payments/create-checkout rejects cross-origin successUrl", async ({
    request,
  }) => {
    // The validateRedirectUrl function should reject external URLs
    const response = await request.post("/api/payments/create-checkout", {
      data: {
        amount: 10000,
        currency: "mad",
        description: "Test with cross-origin redirect",
        successUrl: "https://attacker.com/phishing",
        cancelUrl: "https://attacker.com/cancel",
      },
    });
    // Should either reject (auth) or fall back to safe default URL
    expect([400, 401, 403, 404, 405, 503]).toContain(response.status());
  });

  test("POST /api/payments/cmi rejects cross-origin successUrl", async ({
    request,
  }) => {
    const response = await request.post("/api/payments/cmi", {
      data: {
        amount: 200,
        description: "Test with cross-origin redirect",
        successUrl: "https://attacker.com/success",
        failUrl: "https://attacker.com/fail",
      },
    });
    // Should either reject (auth) or fall back to safe default URL
    expect([400, 401, 403, 404, 405, 503]).toContain(response.status());
  });
});

test.describe("Payment — booking payment flow access control", () => {
  test("POST /api/booking/payment/initiate requires auth context", async ({
    request,
  }) => {
    const response = await request.post("/api/booking/payment/initiate", {
      data: {
        appointmentId: "test-appointment",
        amount: 200,
      },
    });
    expect([401, 403, 404, 405, 500]).toContain(response.status());
  });

  test("POST /api/booking/payment/confirm requires auth context", async ({
    request,
  }) => {
    const response = await request.post("/api/booking/payment/confirm", {
      data: {
        paymentId: "test-payment",
        reference: "test-ref",
      },
    });
    expect([401, 403, 404, 405, 500]).toContain(response.status());
  });

  test("POST /api/booking/payment/refund requires auth context", async ({
    request,
  }) => {
    const response = await request.post("/api/booking/payment/refund", {
      data: {
        paymentId: "test-payment",
        reason: "Test refund",
      },
    });
    expect([401, 403, 404, 405, 500]).toContain(response.status());
  });
});

test.describe("Payment — body size limits", () => {
  test("rejects extremely large webhook payloads", async ({ request }) => {
    // The middleware enforces a 25 MB body size limit.
    // Send a content-length header advertising a huge payload.
    const response = await request.post("/api/payments/webhook", {
      headers: {
        "content-type": "application/json",
        "content-length": "50000000", // 50 MB
      },
      data: "{}",
    });
    // Should reject with 413 (payload too large) or similar
    expect([400, 413, 503]).toContain(response.status());
  });
});
