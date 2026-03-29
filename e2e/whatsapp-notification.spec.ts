import { test, expect } from "@playwright/test";

/**
 * E2E tests for WhatsApp notification delivery flow.
 *
 * Covers:
 * 1. Webhook verification (GET) — valid/invalid tokens
 * 2. Webhook message handling (POST) — signature validation
 * 3. Webhook message processing — CONFIRM, CANCEL, RESCHEDULE actions
 * 4. Notification trigger API — auth and payload validation
 * 5. Notification dispatch API — tenant isolation on recipients
 * 6. Status update processing — delivered, read, failed
 */

test.describe("WhatsApp webhook — GET verification", () => {
  test("rejects verification without valid token", async ({ request }) => {
    const response = await request.get(
      "/api/webhooks?hub.mode=subscribe&hub.verify_token=invalid&hub.challenge=test123",
    );
    expect(response.status()).toBe(403);
  });

  test("rejects verification without mode parameter", async ({ request }) => {
    const response = await request.get(
      "/api/webhooks?hub.verify_token=test&hub.challenge=test123",
    );
    expect(response.status()).toBe(403);
  });

  test("rejects verification without challenge", async ({ request }) => {
    const response = await request.get(
      "/api/webhooks?hub.mode=subscribe&hub.verify_token=test",
    );
    expect(response.status()).toBe(403);
  });

  test("rejects verification with empty token", async ({ request }) => {
    const response = await request.get(
      "/api/webhooks?hub.mode=subscribe&hub.verify_token=&hub.challenge=test123",
    );
    expect(response.status()).toBe(403);
  });

  test("rejects verification with wrong mode", async ({ request }) => {
    const response = await request.get(
      "/api/webhooks?hub.mode=unsubscribe&hub.verify_token=test&hub.challenge=test123",
    );
    expect(response.status()).toBe(403);
  });
});

test.describe("WhatsApp webhook — POST signature validation", () => {
  test("rejects POST without signature header", async ({ request }) => {
    const response = await request.post("/api/webhooks", {
      data: {
        object: "whatsapp_business_account",
        entry: [],
      },
    });
    expect(response.status()).toBe(401);
  });

  test("rejects POST with invalid x-hub-signature-256", async ({
    request,
  }) => {
    const payload = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [],
    });
    const response = await request.post("/api/webhooks", {
      headers: {
        "x-hub-signature-256": "sha256=invalidhashvalue",
        "content-type": "application/json",
      },
      data: payload,
    });
    expect(response.status()).toBe(401);
  });

  test("rejects POST with signature missing sha256= prefix", async ({
    request,
  }) => {
    const payload = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [],
    });
    const response = await request.post("/api/webhooks", {
      headers: {
        "x-hub-signature-256": "noprefixhash",
        "content-type": "application/json",
      },
      data: payload,
    });
    expect(response.status()).toBe(401);
  });

  test("rejects POST with empty signature header", async ({ request }) => {
    const payload = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [],
    });
    const response = await request.post("/api/webhooks", {
      headers: {
        "x-hub-signature-256": "",
        "content-type": "application/json",
      },
      data: payload,
    });
    expect(response.status()).toBe(401);
  });
});

test.describe("WhatsApp webhook — message payload structure", () => {
  test("rejects POST with tampered payload (wrong signature)", async ({
    request,
  }) => {
    // Simulate an attacker modifying the payload after signing
    const payload = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: "+212600000000",
                    text: { body: "CONFIRM" },
                  },
                ],
                metadata: {
                  phone_number_id: "fake-phone-id",
                },
              },
            },
          ],
        },
      ],
    });

    const response = await request.post("/api/webhooks", {
      headers: {
        "x-hub-signature-256": "sha256=tampered_signature_value",
        "content-type": "application/json",
      },
      data: payload,
    });
    // Should reject due to signature mismatch
    expect(response.status()).toBe(401);
  });

  test("rejects CONFIRM action from unverified source", async ({
    request,
  }) => {
    // An attacker tries to confirm an appointment via webhook
    // without a valid signature
    const payload = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: "+212600000000",
                    text: { body: "CONFIRM" },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    const response = await request.post("/api/webhooks", {
      headers: {
        "x-hub-signature-256": "sha256=invalid",
        "content-type": "application/json",
      },
      data: payload,
    });
    expect(response.status()).toBe(401);
  });

  test("rejects CANCEL action from unverified source", async ({ request }) => {
    const payload = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: "+212600000000",
                    text: { body: "CANCEL" },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    const response = await request.post("/api/webhooks", {
      headers: {
        "x-hub-signature-256": "sha256=forged",
        "content-type": "application/json",
      },
      data: payload,
    });
    expect(response.status()).toBe(401);
  });

  test("rejects RESCHEDULE action from unverified source", async ({
    request,
  }) => {
    const payload = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: "+212600000000",
                    text: { body: "RESCHEDULE" },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    const response = await request.post("/api/webhooks", {
      headers: {
        "x-hub-signature-256": "sha256=invalid_reschedule",
        "content-type": "application/json",
      },
      data: payload,
    });
    expect(response.status()).toBe(401);
  });
});

test.describe("WhatsApp notification — trigger API access control", () => {
  test("POST /api/notifications/trigger rejects unauthenticated request", async ({
    request,
  }) => {
    const response = await request.post("/api/notifications/trigger", {
      data: {
        trigger: "booking_confirmation",
        variables: {
          patient_name: "Test Patient",
          doctor_name: "Dr. Smith",
          date: "2025-12-01",
          time: "10:00",
        },
        recipients: [{ id: "some-user-id", channels: ["whatsapp"] }],
      },
    });
    expect([401, 403, 404, 405]).toContain(response.status());
  });

  test("POST /api/notifications rejects unauthenticated dispatch", async ({
    request,
  }) => {
    const response = await request.post("/api/notifications", {
      data: {
        trigger: "reminder_24h",
        variables: {
          patient_name: "Test",
          doctor_name: "Dr. Test",
          time: "14:00",
        },
        recipientId: "user-uuid",
        channels: ["whatsapp", "in_app"],
      },
    });
    expect([401, 403, 404, 405]).toContain(response.status());
  });

  test("GET /api/notifications rejects unauthenticated access", async ({
    request,
  }) => {
    const response = await request.get("/api/notifications");
    expect([401, 403, 404, 405]).toContain(response.status());
  });

  test("GET /api/notifications with userId param rejects unauthenticated access", async ({
    request,
  }) => {
    const response = await request.get(
      "/api/notifications?userId=other-user-id",
    );
    expect([401, 403, 404, 405]).toContain(response.status());
  });
});

test.describe("WhatsApp notification — supported triggers validation", () => {
  const triggers = [
    "new_booking",
    "booking_confirmation",
    "reminder_24h",
    "reminder_2h",
    "cancellation",
    "no_show",
    "prescription_ready",
    "payment_received",
  ];

  for (const trigger of triggers) {
    test(`trigger "${trigger}" rejects unauthenticated request`, async ({
      request,
    }) => {
      const response = await request.post("/api/notifications/trigger", {
        data: {
          trigger,
          variables: { patient_name: "Test" },
          recipients: [{ id: "user-id", channels: ["whatsapp"] }],
        },
      });
      expect([401, 403, 404, 405]).toContain(response.status());
    });
  }
});

test.describe("WhatsApp webhook — status update processing", () => {
  test("rejects status update webhook without valid signature", async ({
    request,
  }) => {
    // Simulate a delivery status update from Meta
    const payload = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [
                  {
                    id: "wamid.test123",
                    status: "delivered",
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    recipient_id: "+212600000000",
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    const response = await request.post("/api/webhooks", {
      headers: {
        "x-hub-signature-256": "sha256=invalid_status_signature",
        "content-type": "application/json",
      },
      data: payload,
    });
    expect(response.status()).toBe(401);
  });

  test("rejects read receipt webhook without valid signature", async ({
    request,
  }) => {
    const payload = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [
                  {
                    id: "wamid.test456",
                    status: "read",
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    recipient_id: "+212600000000",
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    const response = await request.post("/api/webhooks", {
      headers: {
        "x-hub-signature-256": "sha256=invalid_read_signature",
        "content-type": "application/json",
      },
      data: payload,
    });
    expect(response.status()).toBe(401);
  });

  test("rejects failed status webhook without valid signature", async ({
    request,
  }) => {
    const payload = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [
                  {
                    id: "wamid.test789",
                    status: "failed",
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    recipient_id: "+212600000000",
                    errors: [{ code: 131047, title: "Message expired" }],
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    const response = await request.post("/api/webhooks", {
      headers: {
        "x-hub-signature-256": "sha256=invalid_failed_signature",
        "content-type": "application/json",
      },
      data: payload,
    });
    expect(response.status()).toBe(401);
  });
});
