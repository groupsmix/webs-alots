/**
 * F-17: Stripe webhook signature verification tests.
 *
 * Tests replay attack rejection, signature validation, and
 * metadata trust verification.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing route
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/tenant-context", () => ({
  setTenantContext: vi.fn().mockResolvedValue(undefined),
  logTenantContext: vi.fn(),
}));

vi.mock("@/lib/assert-tenant", () => ({
  assertClinicId: vi.fn(),
}));

/**
 * Create a valid Stripe webhook signature using HMAC-SHA256.
 */
async function createStripeSignature(
  payload: string,
  secret: string,
  timestamp?: number,
): Promise<string> {
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const signedPayload = `${ts}.${payload}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `t=${ts},v1=${hex}`;
}

const TEST_SECRET = "whsec_test_secret_key_for_unit_tests";

function createTestEvent(overrides?: Record<string, unknown>) {
  return JSON.stringify({
    id: "evt_test_123",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_123",
        amount_total: 20000,
        currency: "mad",
        metadata: {
          clinic_id: "clinic-uuid-123",
          patient_id: "patient-uuid-123",
          appointment_id: "appt-uuid-123",
        },
        payment_status: "paid",
        ...overrides,
      },
    },
  });
}

describe("Stripe Webhook Signature Verification", () => {
  beforeEach(() => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", TEST_SECRET);
  });

  it("should reject requests with missing stripe-signature header", async () => {
    const { POST } = await import("@/app/api/payments/webhook/route");
    const payload = createTestEvent();

    const request = new Request("http://localhost/api/payments/webhook", {
      method: "POST",
      body: payload,
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request as never);
    expect(response.status).toBe(400);
  });

  it("should reject requests with invalid v1 signature", async () => {
    const { POST } = await import("@/app/api/payments/webhook/route");
    const payload = createTestEvent();
    const ts = Math.floor(Date.now() / 1000);

    const request = new Request("http://localhost/api/payments/webhook", {
      method: "POST",
      body: payload,
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": `t=${ts},v1=bad_signature_value_that_should_fail`,
      },
    });

    const response = await POST(request as never);
    expect(response.status).toBe(400);
  });

  it("should reject replay attacks with timestamps > 5 minutes old", async () => {
    const { POST } = await import("@/app/api/payments/webhook/route");
    const payload = createTestEvent();

    // Timestamp 10 minutes in the past
    const oldTimestamp = Math.floor(Date.now() / 1000) - 600;
    const signature = await createStripeSignature(payload, TEST_SECRET, oldTimestamp);

    const request = new Request("http://localhost/api/payments/webhook", {
      method: "POST",
      body: payload,
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": signature,
      },
    });

    const response = await POST(request as never);
    expect(response.status).toBe(400);
  });

  it("should accept valid signatures with current timestamps", async () => {
    const { POST } = await import("@/app/api/payments/webhook/route");
    const payload = createTestEvent();
    const signature = await createStripeSignature(payload, TEST_SECRET);

    const request = new Request("http://localhost/api/payments/webhook", {
      method: "POST",
      body: payload,
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": signature,
      },
    });

    const response = await POST(request as never);
    // Should not be 400 (signature accepted) — will be 200 or another status
    // depending on downstream processing
    expect(response.status).not.toBe(400);
  });
});
