import { test, expect } from "@playwright/test";

/**
 * E2E tests for WhatsApp webhook endpoint.
 *
 * Tests the webhook verification (GET) and message handling (POST)
 * endpoints with mock payloads.
 */

test.describe("WhatsApp webhook — GET verification", () => {
  test("rejects verification without valid token", async ({ request }) => {
    const response = await request.get("/api/webhooks?hub.mode=subscribe&hub.verify_token=invalid&hub.challenge=test123");
    expect(response.status()).toBe(403);
  });

  test("rejects verification without mode parameter", async ({ request }) => {
    const response = await request.get("/api/webhooks?hub.verify_token=test&hub.challenge=test123");
    expect(response.status()).toBe(403);
  });

  test("rejects verification without challenge", async ({ request }) => {
    const response = await request.get("/api/webhooks?hub.mode=subscribe&hub.verify_token=test");
    expect(response.status()).toBe(403);
  });
});

test.describe("WhatsApp webhook — POST message handling", () => {
  test("rejects POST without signature header", async ({ request }) => {
    const response = await request.post("/api/webhooks", {
      data: {
        object: "whatsapp_business_account",
        entry: [],
      },
    });
    expect(response.status()).toBe(401);
  });

  test("rejects POST with invalid signature", async ({ request }) => {
    const response = await request.post("/api/webhooks", {
      headers: {
        "x-hub-signature-256": "sha256=invalidhash",
        "content-type": "application/json",
      },
      data: JSON.stringify({
        object: "whatsapp_business_account",
        entry: [],
      }),
    });
    expect(response.status()).toBe(401);
  });
});
